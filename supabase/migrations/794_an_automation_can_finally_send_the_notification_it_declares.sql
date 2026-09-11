-- 794 — an automation can finally send the notification it declares
--
-- Reading: docs/foundry-reference/readings/notifications.md. 793 built the
-- payload; this gives it a caller, because an engine nothing reaches is this
-- repository's dominant defect and shipping one knowingly would be worse than
-- shipping none.
--
-- 517 registered the effect kind with runtime `none` and executable `false`,
-- under a description saying no notification system exists here and that it was
-- recorded so a surface could name it. One does now, so the kind changes from a
-- placeholder into a thing that runs.
--
--   "The Automate application allows you to automatically send out notifications to other platform users when a condition is met."
--   — automate/effect-notification.md
--
-- ── RECIPIENTS, AND THE PERMISSION RULE THAT IS ACTUALLY ENFORCEABLE ────────
--
--   "Recipients can be Foundry users or groups, defined either in a"
--   — automate/effect-notification.md
--
-- The sentence continues into two links, a static recipient list and a dynamic
-- definition via object properties. STATIC is built. DYNAMIC is not, and the
-- reason is on the page rather than in my preference: it "requires an object set
-- condition that exposes effect inputs", and reads user or group ids out of a
-- String or Array-of-String property of the triggering objects. Reading a
-- property off each fired object is the same multi-object machinery 630 named as
-- the blocker for the other three input kinds, so this waits on the same build.
--
-- The page then states a requirement that IS enforceable here, and it is the
-- reason this file is not just a dispatch branch:
--
--   "* At least **Viewer** permission on the automation. This is required for both static and dynamic recipients."
--   — automate/effect-notification.md
--
-- So a recipient who cannot see the automation does not receive its
-- notifications. That is a real refusal with a real subject, unlike the
-- content-level permission rule 793 recorded and could not enforce — this one
-- is about a resource we own, so it is enforced. The page lists three further
-- viewer requirements, all about the triggering OBJECT instances and their
-- properties, and those wait on dynamic recipients for the same reason.
--
-- A recipient filtered out this way is DROPPED, not an error. The page makes
-- eligibility a property of the recipient rather than a validation of the
-- effect, and the notification pages' own pattern is that a recipient who may
-- not see something is skipped rather than failing the producer.
--
-- ── OBJECT GROUPING: ONE OF THREE, AND THE OTHER TWO SAY WHY NOT ────────────
--
--   "When multiple objects trigger the condition at the same time, only one notification will be sent to each recipient."
--   — automate/effect-notification.md
--
-- That is `Execute once for all objects`, and it is what this sends: one
-- notification per event, to each eligible recipient. The other two published
-- groupings are not built. Once for each GROUP needs a list of properties to
-- group by, which an effect row cannot carry today. Once for each OBJECT needs
-- the per-object fan-out that exists for actions and has no notification
-- counterpart. Neither is a preference; both are the same missing shape, and
-- naming it twice is cheaper than rediscovering it.
--
-- ── WHAT THE EFFECT ROW CARRIES ────────────────────────────────────────────
-- `automation_effects.parameters` already exists as free jsonb and is how an
-- action effect carries its arguments, so a notification effect carries its
-- configuration there rather than growing four columns for one kind. The guard
-- below is what stops that freedom from becoming a second, undeclared shape.

BEGIN;

-- ── 1. the kind stops being a placeholder ───────────────────────────────────
-- Patched by lifting the live definition and replacing one row, so nothing else
-- in the table moves.

DO $do$
DECLARE src text; anchored int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'automation_effect_kinds';

  SELECT count(*) INTO anchored FROM regexp_matches(src,
    '\(''notification'', ''none'',     false, false,', 'g');
  IF anchored <> 1 THEN
    RAISE EXCEPTION 'expected exactly one notification row to replace, found %', anchored;
  END IF;

  src := replace(src,
    '(''notification'', ''none'',     false, false,
     ''Send notifications to users or groups. No notification system exists here; recorded so the surface can name it.'')',
    '(''notification'', ''sql'',      true,  true,
     ''Send notifications to users or groups. 793 built the payload and 794 the effect: a static recipient list, filtered to those with at least Viewer on the automation, one notification per event.'')');

  EXECUTE src;
END $do$;

-- ── 2. what a notification effect's parameters may say ──────────────────────

CREATE FUNCTION public.notification_effect_config_valid(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE k text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN RETURN false; END IF;

  -- coalesce, not a bare comparison: jsonb_typeof of a MISSING key is NULL, and
  -- `NULL <> 'array'` is NULL rather than true, so a bare test lets an absent
  -- key ride straight through the IF. That is how 391's DECIMAL with no
  -- precision got in, and it got in here too before this line was written.
  IF NOT (p ? 'recipients') THEN RETURN false; END IF;
  IF coalesce(jsonb_typeof(p -> 'recipients'), '') <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p -> 'recipients') = 0 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p -> 'recipients') e
              WHERE coalesce(jsonb_typeof(e), '') <> 'string'
                 OR (e #>> '{}') !~ '^[0-9a-fA-F-]{36}$') THEN RETURN false; END IF;

  IF NOT (p ? 'heading') OR coalesce(jsonb_typeof(p -> 'heading'), '') <> 'string'
     OR length(btrim(coalesce(p ->> 'heading', ''))) = 0 THEN RETURN false; END IF;
  IF NOT (p ? 'content') OR coalesce(jsonb_typeof(p -> 'content'), '') <> 'string'
     THEN RETURN false; END IF;

  -- Values from functions/types-reference — the fields the Notification type
  -- publishes, plus the static recipient list automate/effect-notification adds.
  -- An unknown key is refused so that a second, undeclared shape cannot grow in
  -- free jsonb.
  FOR k IN SELECT key FROM jsonb_each(p) LOOP
    IF NOT (k = ANY (ARRAY['recipients', 'heading', 'content', 'subject', 'body', 'links']))
    THEN RETURN false; END IF;
  END LOOP;

  IF p ? 'subject' AND coalesce(jsonb_typeof(p -> 'subject'), '') <> 'string' THEN RETURN false; END IF;
  IF p ? 'body'    AND coalesce(jsonb_typeof(p -> 'body'), '')    <> 'string' THEN RETURN false; END IF;
  IF (p ? 'subject') <> (p ? 'body') THEN RETURN false; END IF;
  IF p ? 'links' AND public.notification_links_valid(p -> 'links') IS NOT TRUE THEN RETURN false; END IF;
  RETURN true;
END $fn$;

COMMENT ON FUNCTION public.notification_effect_config_valid(jsonb) IS
  'A notification effect''s parameters: a static recipient list of principal ids, the ShortNotification''s heading and content, and optionally the EmailNotificationContent''s subject and body together plus a link list — the payload functions/types-reference publishes, and nothing else. Dynamic recipients are absent because automate/effect-notification makes them require a condition that exposes effect inputs and a property read per fired object.';

CREATE FUNCTION public.guard_notification_effect()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $fn$
BEGIN
  IF NEW.kind <> 'notification' THEN RETURN NEW; END IF;
  IF public.notification_effect_config_valid(NEW.parameters) IS NOT TRUE THEN
    RAISE EXCEPTION 'Automate:NotificationEffectConfig — a notification effect names a static recipient list, a heading and content, and may add a subject and body together'
      USING HINT = 'Dynamic recipients from object properties are not built: they need a condition that exposes effect inputs.';
  END IF;
  IF NEW.action_type_id IS NOT NULL OR NEW.function_id IS NOT NULL THEN
    RAISE EXCEPTION 'Automate:NotificationEffectConfig — a notification effect runs no action and no function';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER guard_notification_effect
  BEFORE INSERT OR UPDATE ON public.automation_effects
  FOR EACH ROW EXECUTE FUNCTION public.guard_notification_effect();

-- ── 3. sending one ──────────────────────────────────────────────────────────

CREATE FUNCTION public.send_automation_notification(p_automation uuid, p_effect uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $fn$
DECLARE e record; a record; eligible uuid[]; cfg jsonb;
BEGIN
  SELECT * INTO e FROM public.automation_effects WHERE id = p_effect;
  SELECT * INTO a FROM public.automations WHERE id = p_automation;
  IF e.id IS NULL OR a.id IS NULL THEN
    RAISE EXCEPTION 'Automate:AutomationNotFound — no such automation or effect';
  END IF;
  cfg := e.parameters;

  -- "At least Viewer permission on the automation. This is required for both
  --  static and dynamic recipients." A principal who cannot see the automation
  --  is dropped rather than failing the effect: eligibility is a property of
  --  the recipient, not a validation of the configuration.
  SELECT array_agg(DISTINCT p) INTO eligible
    FROM (SELECT (jsonb_array_elements_text(cfg -> 'recipients'))::uuid AS p) r
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
    -- NULL, and it is a finding rather than an omission: `automations` carries
    -- no rid column. 488 gave rids to link types, shared properties, action
    -- types and value types on eight attested pages; no page attests one for an
    -- automation, and inventing `ri.automate.main.automation.<uuid>` to fill a
    -- column would be exactly the wrong-token risk 396 warns about. So a
    -- notification from an automation cannot name its producer yet.
    NULL);
END $fn$;

COMMENT ON FUNCTION public.send_automation_notification(uuid, uuid) IS
  'One notification per event to each eligible recipient — automate/effect-notification''s "Execute once for all objects", where multiple triggering objects still produce only one notification per recipient. The other two groupings are not built: once-per-group needs a property list the effect row cannot carry, once-per-object needs a per-object fan-out notifications have no counterpart for.';

GRANT EXECUTE ON FUNCTION public.notification_effect_config_valid(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_automation_notification(uuid, uuid) TO authenticated;

-- ── 4. a deferred guard must tolerate the row being gone ───────────────────
-- Found by this file's own assertions, and it is a real defect rather than a
-- fixture problem. guard_sequential_needs_two is a DEFERRED constraint trigger,
-- so it runs at COMMIT. If an automation is created and deleted inside one
-- transaction, the deferred check fires after the row has gone, its lookup of
-- `execution` returns NULL, `NULL <> 'sequential'` is neither true nor false,
-- and control falls past the early return into a count that is now zero — so a
-- transaction that leaves no automation at all is refused for having too few
-- effects on one.
--
-- The same NULL-is-not-false shape as 391's DECIMAL and as this file's own
-- first validator. A guard has nothing to protect once its subject is deleted,
-- so it returns.

DO $do$
DECLARE src text; anchored int;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'guard_sequential_needs_two';

  SELECT count(*) INTO anchored FROM regexp_matches(src,
    'IF \(SELECT a\.execution FROM public\.automations a WHERE a\.id = v_automation\) <> ''sequential'' THEN', 'g');
  IF anchored <> 1 THEN
    RAISE EXCEPTION 'expected one execution test to guard, found %', anchored;
  END IF;

  src := replace(src,
    'IF (SELECT a.execution FROM public.automations a WHERE a.id = v_automation) <> ''sequential'' THEN',
'IF NOT EXISTS (SELECT 1 FROM public.automations a WHERE a.id = v_automation) THEN
    -- Deferred to commit, and by then the automation may be gone. There is
    -- nothing left to hold to a rule.
    IF TG_OP = ''DELETE'' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF (SELECT a.execution FROM public.automations a WHERE a.id = v_automation) <> ''sequential'' THEN');

  EXECUTE src;
END $do$;

-- ── 5. the dispatcher learns the kind ───────────────────────────────────────

DO $do$
DECLARE src text; anchored int; anchor text;
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'run_automations';

  anchor := '          IF e.object_input_parameter_id IS NULL THEN
            PERFORM public.apply_action(e.action_type_id, e.parameters);';

  SELECT count(*) INTO anchored FROM regexp_matches(src, regexp_replace(anchor, '([().*+?\[\]{}|^$\\])', '\\\1', 'g'), 'g');
  IF anchored <> 1 THEN
    RAISE EXCEPTION 'expected one dispatch site, found %', anchored;
  END IF;

  -- The anchor survives in the replacement, because a splice that eats its own
  -- anchor loses the statement it was anchored to.
  src := replace(src, anchor,
'          IF e.kind = ''notification'' THEN
            PERFORM public.send_automation_notification(a.id, e.id);
            PERFORM public.settle_automation_run(run_id, ''succeeded'', NULL, NULL);
          ELSIF e.object_input_parameter_id IS NULL THEN
            PERFORM public.apply_action(e.action_type_id, e.parameters);');

  EXECUTE src;
END $do$;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $do$
DECLARE
  org uuid; usr uuid; seen uuid; unseen uuid; sp uuid; proj uuid; ont uuid;
  ot uuid; oset uuid; auto uuid; eff uuid; nid uuid; n integer; realm_id uuid;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m794 probe') RETURNING id INTO org;
  usr := gen_random_uuid(); seen := gen_random_uuid(); unseen := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (usr,    '00000000-0000-0000-0000-000000000000','authenticated','authenticated','m794a-'||usr||'@beacon.test'),
    (seen,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated','m794b-'||seen||'@beacon.test'),
    (unseen, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','m794c-'||unseen||'@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id) VALUES
    (usr,    'm794a-'||usr||'@beacon.test',    'admin', org),
    (seen,   'm794b-'||seen||'@beacon.test',   'admin', org),
    (unseen, 'm794c-'||unseen||'@beacon.test', 'admin', org);
  SELECT public.create_space('M794 Probe') INTO sp;
  INSERT INTO public.projects (api_name, name, space_id, organization_id)
  VALUES ('m794proj', 'm794proj', sp, org) RETURNING id INTO proj;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = sp;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;

  -- one recipient can see the automation, the other cannot
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, seen, 'viewer', org);

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M794Thing', 'Thing') RETURNING id INTO ot;
  INSERT INTO public.object_sets (name, api_name, subject_type_id, project_id, ontology_id, filters)
  VALUES ('M794 set', 'm794_set', ot, proj, ont, '[]'::jsonb) RETURNING id INTO oset;
  INSERT INTO public.automations (project_id, display_name, owner_id, condition)
  VALUES (proj, 'M794 watch', usr,
          jsonb_build_object('type', 'objects_added', 'object_set_id', oset))
  RETURNING id INTO auto;

  -- 1. the kind is executable now, and its runtime is the heartbeat's
  IF NOT EXISTS (SELECT 1 FROM public.automation_effect_kinds() k
                  WHERE k.kind = 'notification' AND k.runtime = 'sql') THEN
    RAISE EXCEPTION 'a notification effect must run on the SQL runtime to reach the heartbeat';
  END IF;
  -- and the other three kinds were not disturbed by the splice
  IF (SELECT count(*) FROM public.automation_effect_kinds()) <> 4 THEN
    RAISE EXCEPTION 'the effect kind table should still hold four kinds';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.automation_effect_kinds() k
                  WHERE k.kind = 'logic' AND k.runtime = 'none') THEN
    RAISE EXCEPTION 'the logic kind moved, and it should not have';
  END IF;

  -- 2. the configuration guard
  BEGIN
    INSERT INTO public.automation_effects (automation_id, position, kind, parameters)
    VALUES (auto, 0, 'notification', '{"heading":"Hi"}'::jsonb);
    RAISE EXCEPTION 'a notification effect with no recipients was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Automate:NotificationEffectConfig%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.automation_effects (automation_id, position, kind, parameters)
    VALUES (auto, 0, 'notification',
            jsonb_build_object('recipients', jsonb_build_array(seen), 'heading', 'Hi',
                               'content', 'c', 'subject', 's'));
    RAISE EXCEPTION 'a subject without a body was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Automate:NotificationEffectConfig%' THEN RAISE; END IF;
  END;

  -- 3. a well-formed one lands
  INSERT INTO public.automation_effects (automation_id, position, kind, parameters)
  VALUES (auto, 0, 'notification',
          jsonb_build_object('recipients', jsonb_build_array(seen, unseen),
                             'heading', 'Objects appeared',
                             'content', 'Something entered the set you watch.'))
  RETURNING id INTO eff;

  -- 4. sending drops the recipient who cannot see the automation
  nid := public.send_automation_notification(auto, eff);
  SELECT count(*) INTO n FROM public.notification_deliveries WHERE notification_id = nid;
  IF n <> 1 THEN
    RAISE EXCEPTION 'only the recipient with at least Viewer on the automation receives it; got % deliver(ies)', n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.notification_deliveries
                  WHERE notification_id = nid AND user_id = seen) THEN
    RAISE EXCEPTION 'the eligible recipient did not receive it';
  END IF;

  -- 5. it cannot name its producer, and that is recorded rather than faked
  IF (SELECT source_rid FROM public.notifications WHERE id = nid) IS NOT NULL THEN
    RAISE EXCEPTION 'an automation has no rid, so its notification must not claim one';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'automations'
                AND column_name = 'rid') THEN
    RAISE EXCEPTION 'automations now carry a rid — revisit 794 and name the producer';
  END IF;

  -- 6. and with nobody eligible it refuses rather than sending to nobody
  UPDATE public.automation_effects
     SET parameters = jsonb_build_object('recipients', jsonb_build_array(unseen),
                                         'heading', 'h', 'content', 'c')
   WHERE id = eff;
  BEGIN
    PERFORM public.send_automation_notification(auto, eff);
    RAISE EXCEPTION 'a send with no eligible recipient was accepted';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE 'Automate:NoEligibleRecipients%' THEN RAISE; END IF;
  END;

  -- Teardown in dependency order: object_types restrict their project, so the
  -- organization cannot simply cascade.
  -- parallel first: dropping the last effect of a SEQUENTIAL automation trips
  -- the two-effect guard, and a teardown should not have to argue with a rule.
  DELETE FROM public.automation_effects WHERE automation_id = auto;
  DELETE FROM public.automations WHERE project_id = proj;
  DELETE FROM public.object_sets WHERE project_id = proj;
  DELETE FROM public.object_types WHERE project_id = proj;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE space_id = sp;
  DELETE FROM public.space_organizations WHERE space_id = sp;
  DELETE FROM public.spaces WHERE id = sp;
  DELETE FROM public.organizations WHERE id = org;
  RAISE NOTICE '794 proved: the kind runs, the config is guarded, and Viewer on the automation decides who receives';
END $do$;

COMMIT;
