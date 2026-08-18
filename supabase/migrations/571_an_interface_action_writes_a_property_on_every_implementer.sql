-- `action_editable_properties` answers Phase C's design sentence:
--
--   "Because we've only defined one action that touches only the Root Cause
--    property, this is the only property that users can edit."
--
-- It does it with an inner join through `action_type_rule_properties.property_id`
-- to `object_type_properties`. After 570 an interface rule's properties sit in
-- `interface_property_id` and `property_id` is null, so **every interface action
-- reports an empty set** — not an error, a silent zero. The question "what can
-- this action write" started answering "nothing" for a whole rule family, which
-- is the worst way for a permission answer to be wrong.
--
-- ── WHAT AN INTERFACE ACTION ACTUALLY WRITES ───────────────────────────────
-- Not the interface property — that is a declaration, and no row has one. It
-- writes the concrete property each implementing type mapped it onto:
--
--   "You can use interface action rules whenever the edits can apply to all the
--    object types that implement the interface."
--
-- 450 stores that mapping in `interface_implementation_mappings`, one row per
-- (object type, interface, interface property), and `object_property_id` is the
-- concrete property for the two resolutions that name one. So the answer is a
-- join, not a new column.
--
-- Three resolutions name no property and are therefore not editable *yet*:
-- `choose_backing_column` and `edit_only` "create a property on the implementing
-- type at apply time; that creation is the surface's job" (450's own comment),
-- and `skip` is a stored refusal. A row whose property does not exist cannot be
-- reported as writable.
--
-- ── AND THE GATE 450 BUILT WITH NO READER ──────────────────────────────────
-- 450 added `object_type_interfaces.interface_actions_enabled`, citing this
-- page:
--
--   "disable interface actions for specific object types… in the Interface
--    action control section"
--
-- Nothing has ever read it. It is the one per-object-type control Foundry
-- offers over interface actions, and it exists because the criteria do not
-- discriminate:
--
--   "Submission criteria apply uniformly across all object types that implement
--    the interface, so you cannot configure different permissions per object
--    type within a single interface action."
--
-- An object type that has opted out is not edited by the action, so its
-- properties are not in the answer. That is this column's first caller — and by
-- CLAUDE.md's fourth question, what makes it built rather than declared.

BEGIN;

CREATE OR REPLACE FUNCTION public.action_editable_properties(p_action uuid)
RETURNS TABLE (object_type text, property text, rule_kind text)
LANGUAGE sql STABLE AS $$
  -- Object and link rules: the rule names the property directly.
  SELECT t.api_name, p.api_name, r.kind
    FROM public.action_type_rules r
    JOIN public.action_type_rule_properties rp ON rp.rule_id = r.id
    JOIN public.object_type_properties p ON p.id = rp.property_id
    JOIN public.object_types t ON t.id = p.object_type_id
   WHERE r.action_type_id = p_action
  UNION ALL
  -- Interface rules: the rule names an interface property, and each implementer
  -- resolved it onto one of its own. One row per implementing type, which is
  -- what "the edits can apply to all the object types" means when made concrete.
  SELECT t.api_name, p.api_name, r.kind
    FROM public.action_type_rules r
    JOIN public.action_type_rule_properties rp ON rp.rule_id = r.id
    JOIN public.object_type_interfaces oti ON oti.interface_id = r.interface_id
    JOIN public.interface_implementation_mappings m
      ON m.object_type_id = oti.object_type_id
     AND m.interface_id = oti.interface_id
     AND m.interface_property_id = rp.interface_property_id
    JOIN public.object_type_properties p ON p.id = m.object_property_id
    JOIN public.object_types t ON t.id = p.object_type_id
   WHERE r.action_type_id = p_action
     AND oti.interface_actions_enabled
$$;

COMMENT ON FUNCTION public.action_editable_properties(uuid) IS
  'Every property this action type can write. An interface rule expands to the concrete property each implementing type mapped its interface property onto, skipping types that turned interface actions off — because the action edits objects, and an interface has none.';

-- ── assertions, which build both arms and watch the gate close ──────────────
DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; usr uuid;
  iface uuid; ip uuid; act uuid; rule uuid;
  bug uuid; bug_title uuid; fr uuid; fr_summary uuid; n int;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe571') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe571') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe571', 'Probe571') RETURNING id INTO proj;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe571@beacon.test') RETURNING id INTO usr;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe571', 'Probe571', false) RETURNING id INTO ont;

    -- The page's own example: a Ticket interface, a Bug and a Feature request.
    INSERT INTO public.ontology_interfaces (ontology_id, api_name, label, created_by_user_id)
      VALUES (ont, 'Ticket', 'Ticket', usr) RETURNING id INTO iface;
    INSERT INTO public.interface_properties (interface_id, property_id, api_name, display_name, base_type)
      VALUES (iface, 'subject', 'subject', 'Subject', 'string') RETURNING id INTO ip;

    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Bug', 'Bug') RETURNING id INTO bug;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (bug, 'title', 'title', 'Title', 'string', 'title') RETURNING id INTO bug_title;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'FeatureRequest', 'Feature request') RETURNING id INTO fr;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (fr, 'summary', 'summary', 'Summary', 'string', 'summary') RETURNING id INTO fr_summary;

    -- The same interface property lands on differently-named properties, which
    -- is the whole point of the mapping.
    INSERT INTO public.object_type_interfaces (object_type_id, interface_id) VALUES (bug, iface);
    INSERT INTO public.interface_implementation_mappings
      (object_type_id, interface_id, interface_property_id, resolution, object_property_id)
      VALUES (bug, iface, ip, 'choose_existing', bug_title);
    INSERT INTO public.object_type_interfaces (object_type_id, interface_id) VALUES (fr, iface);
    INSERT INTO public.interface_implementation_mappings
      (object_type_id, interface_id, interface_property_id, resolution, object_property_id)
      VALUES (fr, iface, ip, 'choose_existing', fr_summary);

    INSERT INTO public.action_types (ontology_id, api_name, label)
      VALUES (ont, 'edit-ticket', 'Edit ticket') RETURNING id INTO act;
    INSERT INTO public.action_type_rules (action_type_id, kind, position, interface_id)
      VALUES (act, 'modify_object_of_interface', 1, iface) RETURNING id INTO rule;
    INSERT INTO public.action_type_rule_properties (rule_id, interface_property_id, value_source, static_value)
      VALUES (rule, ip, 'static', '"x"'::jsonb);

    -- One interface rule, two implementers, two concrete properties.
    SELECT count(*) INTO n FROM public.action_editable_properties(act);
    IF n <> 2 THEN
      RAISE EXCEPTION 'an interface action reported % editable propertie(s), expected 2', n;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.action_editable_properties(act)
                    WHERE object_type = 'Bug' AND property = 'title')
       OR NOT EXISTS (SELECT 1 FROM public.action_editable_properties(act)
                    WHERE object_type = 'FeatureRequest' AND property = 'summary') THEN
      RAISE EXCEPTION 'the interface property did not resolve per implementer';
    END IF;

    -- Interface action control: the opted-out type leaves the answer.
    UPDATE public.object_type_interfaces SET interface_actions_enabled = false
     WHERE object_type_id = bug AND interface_id = iface;
    SELECT count(*) INTO n FROM public.action_editable_properties(act);
    IF n <> 1 THEN
      RAISE EXCEPTION 'the disabled implementer stayed writable (% rows)', n;
    END IF;
    IF EXISTS (SELECT 1 FROM public.action_editable_properties(act) WHERE object_type = 'Bug') THEN
      RAISE EXCEPTION 'Bug turned interface actions off and is still editable';
    END IF;

    -- A mapping that names no property yet cannot be reported as writable.
    UPDATE public.object_type_interfaces SET interface_actions_enabled = true
     WHERE object_type_id = bug AND interface_id = iface;
    UPDATE public.interface_implementation_mappings
       SET resolution = 'skip', object_property_id = NULL
     WHERE object_type_id = bug AND interface_property_id = ip;
    SELECT count(*) INTO n FROM public.action_editable_properties(act);
    IF n <> 1 THEN
      RAISE EXCEPTION 'a skipped mapping was reported writable (% rows)', n;
    END IF;

    -- And the object arm is unchanged, which is what a UNION had better mean.
    INSERT INTO public.action_type_rules (action_type_id, kind, position, object_type_id)
      VALUES (act, 'modify_object', 2, fr) RETURNING id INTO rule;
    INSERT INTO public.action_type_rule_properties (rule_id, property_id, value_source, static_value)
      VALUES (rule, fr_summary, 'static', '"y"'::jsonb);
    SELECT count(*) INTO n FROM public.action_editable_properties(act);
    IF n <> 2 THEN
      RAISE EXCEPTION 'the object rule arm did not survive the union (% rows)', n;
    END IF;

    RAISE EXCEPTION 'probe571:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe571:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe571';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '571: an interface action writes a property on every implementer';
END $do$;

COMMIT;
