-- 803 — a notification can find its recipients on the objects that fired
--
-- Reading: docs/foundry-reference/readings/notifications.md, extended by a read
-- of the Recipients section and its permission requirements. 794 built the
-- static recipient list and recorded dynamic recipients as blocked on the
-- multi-object shape 630 named. 797 through 802 built that shape, so this is
-- the last thing it was holding up.
--
--   "This configuration option requires an object set condition that exposes effect inputs."
--   — automate/effect-notification.md
--
-- ── WHAT A DYNAMIC DEFINITION IS ───────────────────────────────────────────
-- Property names on the object type the condition watches, whose values are
-- principal ids. The type restriction is published and exact:
--
--   "Therefore, object property types must be either `String` or `Array of String`."
--   — automate/effect-notification.md
--
-- TWO bindings, not one, and this is image-only: the prose says properties
-- "contain user IDs or group IDs" as a single idea, and the configuration form
-- splits it into separate pickers.
--
--   "Define the recipients for your notification. You can select both static and object-property-backed recipients."
--   — automate/images/effect-notifications-effect-object-backed-recipients.png
--
-- That sentence settles a second question too: static and dynamic COEXIST on
-- one effect rather than excluding each other. Both captures of the form show
-- it — one with the static field filled beside a filled property picker, the
-- other with static empty — so the union is the behaviour, not an assumption.
-- The two-field split is corroborated on a second page's capture of the same
-- form, which is why it is built rather than merely recorded.
--
-- ── WHAT HAPPENS TO SOMEONE INELIGIBLE, WHICH THE MAIN PAGE NEVER SAYS ─────
-- The effect page lists viewer requirements and never states a failure
-- mechanism. The worked example does, and it is silent non-delivery:
--
--   "Note that all recipients require at least **Viewer** permission on the automation or they will not receive the notification."
--   — automate/example-dynamic-contract-owner.md
--
-- which is what 794 already does: an ineligible recipient is dropped, not an
-- error. So this file changes nothing about that, and the sentence is recorded
-- here because 794 inferred the behaviour and this page states it.
--
-- ── THE THREE REQUIREMENTS THIS DOES NOT ENFORCE, AND WHY ──────────────────
-- Beside viewer on the automation, the page requires viewer on the triggering
-- object INSTANCES, on all their properties where the type is multi-datasource,
-- and on every object a function-backed notification touched. All three are
-- per-recipient tests against rows rather than against a resource we own, and
-- the model behind them is explicit:
--
--   "* **Notification effects** continue to use each recipient's individual permissions."
--   — automate/third-party-app-ownership.md
--
-- Evaluating that means re-reading the fired objects once per recipient under
-- that recipient's own claims, which no path here can do: our reads resolve
-- `auth.uid()` from the caller's own JWT, and an automation runs on a heartbeat
-- with no recipient's credentials to assume. Recorded rather than half-built —
-- a permission check that silently passes is worse than one that is absent and
-- named. It becomes buildable the day something can evaluate a read AS another
-- principal, which is the same thing 553 concluded when it inverted rather than
-- elevated the scheduled path.
--
-- ── AND ONE THING THAT IS NOT A PERMISSION AT ALL ──────────────────────────
-- A capture of the effect describes it as sending to recipients that have
-- notifications turned on, which is a per-user preference sitting beside the
-- four permission checks. The string appears nowhere in the mirror's prose —
-- only inside that screenshot — so it is recorded and not built, for the same
-- reason 793 refused to build the preference matrix from one experimental
-- capture.

BEGIN;

-- ── the two bindings ────────────────────────────────────────────────────────

ALTER TABLE public.automation_effects
  ADD COLUMN recipient_user_properties  text[],
  ADD COLUMN recipient_group_properties text[];

COMMENT ON COLUMN public.automation_effects.recipient_user_properties IS
  'Property api names on the condition''s object type whose values are user ids. automate/effect-notification restricts such a property to String or Array of String. Separate from the group binding because the configuration form has two pickers, which is image-only and corroborated on a second page.';
COMMENT ON COLUMN public.automation_effects.recipient_group_properties IS
  'The same, for properties whose values are group ids. A group still expands to users before delivery, because the permission check is per person.';

-- ── what they must be true of ───────────────────────────────────────────────

CREATE FUNCTION public.guard_dynamic_recipients()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE v_cond jsonb; v_subject uuid; p text; prop record;
BEGIN
  IF NEW.recipient_user_properties IS NULL AND NEW.recipient_group_properties IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.kind <> 'notification' THEN
    RAISE EXCEPTION 'Automate:DynamicRecipientsNeedANotification — only a notification effect has recipients';
  END IF;

  SELECT a.condition INTO v_cond FROM public.automations a WHERE a.id = NEW.automation_id;

  -- "requires an object set condition that exposes effect inputs" — the same
  -- three 630 admits, because they are the ones that expose one.
  IF (v_cond ->> 'type') NOT IN ('objects_added', 'objects_removed', 'objects_modified') THEN
    RAISE EXCEPTION 'Automate:ConditionExposesNoInput — a % condition exposes no effect input to read recipients from', v_cond ->> 'type';
  END IF;

  SELECT s.subject_type_id INTO v_subject
    FROM public.object_sets s WHERE s.id = (v_cond ->> 'object_set_id')::uuid;

  FOREACH p IN ARRAY coalesce(NEW.recipient_user_properties, '{}')
                     || coalesce(NEW.recipient_group_properties, '{}') LOOP
    SELECT op.base_type, op.array_element_type INTO prop
      FROM public.object_type_properties op
     WHERE op.object_type_id = v_subject AND op.api_name = p;
    IF prop IS NULL THEN
      RAISE EXCEPTION 'Automate:RecipientPropertyNotOnType — % is not a property of the object type the condition watches', p;
    END IF;
    -- String, or Array of String, and nothing else.
    IF NOT (prop.base_type = 'string'
         OR (prop.base_type = 'array' AND prop.array_element_type = 'string')) THEN
      RAISE EXCEPTION 'Automate:RecipientPropertyType — % is a %, and a recipient property is a String or an Array of String',
        p, coalesce(prop.array_element_type || ' array', prop.base_type);
    END IF;
  END LOOP;

  RETURN NEW;
END $fn$;

CREATE TRIGGER guard_dynamic_recipients
  BEFORE INSERT OR UPDATE ON public.automation_effects
  FOR EACH ROW EXECUTE FUNCTION public.guard_dynamic_recipients();

-- ── reading them off what fired ─────────────────────────────────────────────

CREATE FUNCTION public.dynamic_recipients(p_effect uuid, p_object_type uuid, p_keys text[])
RETURNS uuid[] LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE e record; props text[]; found uuid[] := '{}'; r jsonb; p text; pid text; v jsonb;
BEGIN
  SELECT * INTO e FROM public.automation_effects WHERE id = p_effect;
  props := coalesce(e.recipient_user_properties, '{}')
        || coalesce(e.recipient_group_properties, '{}');
  IF array_length(props, 1) IS NULL OR coalesce(array_length(p_keys, 1), 0) = 0 THEN
    RETURN found;
  END IF;

  FOR r IN
    SELECT * FROM public.evaluate_object_set(
      p_object_type,
      public.fired_object_set_value(p_object_type, p_keys) -> 'filters',
      NULL, 100000, 0, NULL)
  LOOP
    FOREACH p IN ARRAY props LOOP
      SELECT op.property_id INTO pid FROM public.object_type_properties op
       WHERE op.object_type_id = p_object_type AND op.api_name = p;
      v := r -> pid;
      CONTINUE WHEN v IS NULL OR jsonb_typeof(v) = 'null';
      IF jsonb_typeof(v) = 'array' THEN
        -- An Array of String holds several ids; a String holds one.
        found := found || ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(v) x
                                 WHERE x ~ '^[0-9a-fA-F-]{36}$');
      ELSIF jsonb_typeof(v) = 'string' AND (v #>> '{}') ~ '^[0-9a-fA-F-]{36}$' THEN
        found := found || (v #>> '{}')::uuid;
      END IF;
    END LOOP;
  END LOOP;

  RETURN ARRAY(SELECT DISTINCT u FROM unnest(found) u);
END $fn$;

COMMENT ON FUNCTION public.dynamic_recipients(uuid, uuid, text[]) IS
  'The principal ids held by the named properties of the objects that fired. A value that is not a principal id is skipped rather than refused: automate/effect-notification says the property holds user or group ids and says nothing about what a malformed one does, and failing the whole notification over one bad row would be stricter than the page.';

-- ── the send, which now unions both halves ──────────────────────────────────
-- DROP and CREATE rather than replace, because the signature gains an argument.
-- The comment and the grant are restored below, which is the half of DROP+CREATE
-- that gets forgotten.

DROP FUNCTION public.send_automation_notification(uuid, uuid);

CREATE FUNCTION public.send_automation_notification(
  p_automation uuid, p_effect uuid, p_keys text[] DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE e record; a record; eligible uuid[]; configured uuid[]; cfg jsonb; subject uuid;
BEGIN
  SELECT * INTO e FROM public.automation_effects WHERE id = p_effect;
  SELECT * INTO a FROM public.automations WHERE id = p_automation;
  IF e.id IS NULL OR a.id IS NULL THEN
    RAISE EXCEPTION 'Automate:AutomationNotFound — no such automation or effect';
  END IF;
  cfg := e.parameters;

  -- Static and object-property-backed recipients COEXIST: the form's own
  -- subtitle says both may be selected, so this is a union rather than a choice.
  configured := ARRAY(SELECT (jsonb_array_elements_text(cfg -> 'recipients'))::uuid);

  IF e.recipient_user_properties IS NOT NULL OR e.recipient_group_properties IS NOT NULL THEN
    SELECT s.subject_type_id INTO subject
      FROM public.object_sets s WHERE s.id = (a.condition ->> 'object_set_id')::uuid;
    configured := configured || public.dynamic_recipients(p_effect, subject, p_keys);
  END IF;

  configured := ARRAY(SELECT DISTINCT u FROM unnest(configured) u);

  -- "At least Viewer permission on the automation. This is required for both
  --  static and dynamic recipients." A principal who fails it is dropped, which
  --  automate/example-dynamic-contract-owner states as not receiving it.
  SELECT array_agg(DISTINCT p) INTO eligible
    FROM (SELECT unnest(configured) AS p) r
   WHERE public.role_rank(
           (SELECT g.role FROM public.project_role_grants g
             WHERE g.project_id = a.project_id
               AND (g.user_id = r.p OR g.group_id = r.p)
             ORDER BY public.role_rank(g.role) DESC LIMIT 1)) >= public.role_rank('viewer');

  IF eligible IS NULL OR array_length(eligible, 1) IS NULL THEN
    RAISE EXCEPTION 'Automate:NoEligibleRecipients — no configured recipient has at least Viewer on this automation';
  END IF;

  RETURN public.send_notification(
    cfg ->> 'heading',
    coalesce(cfg ->> 'content', ''),
    eligible,
    cfg ->> 'subject',
    cfg ->> 'body',
    coalesce(cfg -> 'links', '[]'::jsonb),
    NULL);
END $fn$;

COMMENT ON FUNCTION public.send_automation_notification(uuid, uuid, text[]) IS
  'One notification per event to each eligible recipient, where the recipients are the static list UNIONED with whatever the named object properties hold — automate/effect-notification''s two halves, which its own form says may both be selected. Eligibility is at least Viewer on the automation; the page''s three other viewer requirements are about the triggering rows and are recorded unbuilt in 803''s header, because evaluating them means reading as each recipient and nothing here can. NOT BUILT and recorded rather than inferred: a notification names no producer, because automations carry no rid.';

REVOKE EXECUTE ON FUNCTION public.send_automation_notification(uuid, uuid, text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.send_automation_notification(uuid, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dynamic_recipients(uuid, uuid, text[]) TO authenticated;

-- ── the dispatcher hands over what fired ────────────────────────────────────

DO $do$
DECLARE src text; anchored int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'run_automations';

  SELECT count(*) INTO anchored FROM regexp_matches(src,
    'PERFORM public\.send_automation_notification\(a\.id, e\.id\);', 'g');
  IF anchored <> 1 THEN
    RAISE EXCEPTION 'expected one notification dispatch, found %', anchored;
  END IF;

  src := replace(src,
    'PERFORM public.send_automation_notification(a.id, e.id);',
    'PERFORM public.send_automation_notification(a.id, e.id, fired);');

  EXECUTE src;
END $do$;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE
  org uuid; usr uuid; seen uuid; sp uuid; proj uuid; ont uuid; ot uuid;
  oset uuid; auto uuid; eff uuid; n integer; got uuid[];
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m803 probe') RETURNING id INTO org;
  usr := gen_random_uuid(); seen := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (usr,  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','m803a-'||usr||'@beacon.test'),
    (seen, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','m803b-'||seen||'@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (usr,  'm803a-'||usr||'@beacon.test',  'admin', org),
    (seen, 'm803b-'||seen||'@beacon.test', 'admin', org);
  SELECT public.create_space('M803 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m803proj', 'm803proj', sp, org) RETURNING id INTO proj;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = sp;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M803Contract', 'Contract') RETURNING id INTO ot;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ot, 'pk', 'Pk', 'pk', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, array_element_type,
     source, backing_column, position)
  VALUES (ot, 'owners', 'Owners', 'owners', 'array', 'string', 'column', 'owners', 1);
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source, backing_column, position)
  VALUES (ot, 'seats', 'Seats', 'seats', 'integer', 'column', 'seats', 2);
  INSERT INTO public.object_sets (name, api_name, subject_type_id, project_id, ontology_id, filters)
  VALUES ('M803 set', 'm803_set', ot, proj, ont, '[]'::jsonb) RETURNING id INTO oset;
  INSERT INTO public.automations (project_id, display_name, owner_id, condition)
  VALUES (proj, 'M803 watch', usr,
          jsonb_build_object('type', 'objects_added', 'object_set_id', oset))
  RETURNING id INTO auto;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, seen, 'viewer', org);

  -- 1. a well-formed dynamic binding lands, beside a static list
  INSERT INTO public.automation_effects
    (automation_id, position, kind, parameters, recipient_user_properties)
  VALUES (auto, 0, 'notification',
          jsonb_build_object('recipients', jsonb_build_array(seen),
                             'heading', 'Contract changed', 'content', 'Owners, look.'),
          ARRAY['owners'])
  RETURNING id INTO eff;

  -- 2. the published type restriction
  BEGIN
    UPDATE public.automation_effects SET recipient_user_properties = ARRAY['seats'] WHERE id = eff;
    RAISE EXCEPTION 'an integer property was accepted as a recipient property';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Automate:RecipientPropertyType%' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.automation_effects SET recipient_user_properties = ARRAY['nosuch'] WHERE id = eff;
    RAISE EXCEPTION 'a property that is not on the type was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Automate:RecipientPropertyNotOnType%' THEN RAISE; END IF;
  END;
  -- a plain String property is the other permitted type
  UPDATE public.automation_effects SET recipient_user_properties = ARRAY['pk'] WHERE id = eff;
  UPDATE public.automation_effects SET recipient_user_properties = ARRAY['owners'] WHERE id = eff;

  -- 3. only a notification effect has recipients at all
  BEGIN
    INSERT INTO public.automation_effects
      (automation_id, position, kind, parameters, recipient_user_properties)
    VALUES (auto, 1, 'action', '{}'::jsonb, ARRAY['owners']);
    RAISE EXCEPTION 'an action effect was given recipient properties';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Automate:DynamicRecipientsNeedANotification%' THEN RAISE; END IF;
  END;

  -- 4. a condition that exposes nothing cannot back recipients
  DECLARE timed uuid;
  BEGIN
    INSERT INTO public.automations (project_id, display_name, owner_id, condition)
    VALUES (proj, 'M803 timed', usr, jsonb_build_object('type', 'time', 'cron', '0 2 * * *'))
    RETURNING id INTO timed;
    BEGIN
      INSERT INTO public.automation_effects
        (automation_id, position, kind, parameters, recipient_user_properties)
      VALUES (timed, 0, 'notification',
              jsonb_build_object('recipients', jsonb_build_array(seen),
                                 'heading', 'h', 'content', 'c'),
              ARRAY['owners']);
      RAISE EXCEPTION 'a time condition backed dynamic recipients';
    EXCEPTION WHEN others THEN
      IF SQLERRM NOT LIKE 'Automate:ConditionExposesNoInput%' THEN RAISE; END IF;
    END;
    UPDATE public.automations SET execution = 'parallel' WHERE id = timed;
    DELETE FROM public.automations WHERE id = timed;
  END;

  -- 5. with nothing indexed there is nobody to find, and that is not an error
  got := public.dynamic_recipients(eff, ot, ARRAY['C1']);
  IF coalesce(array_length(got, 1), 0) <> 0 THEN
    RAISE EXCEPTION 'no objects are indexed, so no recipient can be read off them';
  END IF;

  -- 6. and the static half still delivers on its own
  PERFORM public.send_automation_notification(auto, eff, ARRAY['C1']);
  SELECT count(*) INTO n FROM public.notification_deliveries d
    JOIN public.notifications nt ON nt.id = d.notification_id
   WHERE nt.heading = 'Contract changed';
  IF n <> 1 THEN
    RAISE EXCEPTION 'the static recipient should still receive it; got % deliver(ies)', n;
  END IF;

  -- 7. the dispatcher hands the fired keys over
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
                  WHERE ns.nspname = 'public' AND p.proname = 'run_automations'
                    AND p.prosrc LIKE '%send_automation_notification(a.id, e.id, fired)%') THEN
    RAISE EXCEPTION 'the dispatcher still calls the notification without the objects that fired';
  END IF;

  DELETE FROM public.automation_effects WHERE automation_id = auto;
  UPDATE public.automations SET execution = 'parallel' WHERE project_id = proj;
  DELETE FROM public.automations WHERE project_id = proj;
  DELETE FROM public.object_sets WHERE project_id = proj;
  DELETE FROM public.object_type_properties WHERE object_type_id = ot;
  DELETE FROM public.object_types WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE space_id = sp;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  RAISE NOTICE '803 proved: two bindings, the published type rule, the exposing-condition gate, and the union';
END $do$;

COMMIT;
