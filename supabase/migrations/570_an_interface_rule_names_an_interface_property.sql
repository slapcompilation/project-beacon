-- 569's constraint could not run, and the reason is worth stating plainly.
--
-- ── THE DEFECT I SHIPPED ────────────────────────────────────────────────────
-- 569 refuses an interface rule that writes a property the interface does not
-- declare, by joining `action_type_rule_properties.property_id` against
-- `interface_properties.property_id`. Those are different types:
--
--   action_type_rule_properties.property_id  uuid  → object_type_properties(id)
--   interface_properties.property_id         text  (the property's api id)
--
-- So the guard raises `function string_agg(uuid, unknown) does not exist` the
-- moment an interface rule has any property at all. 569's own assertions
-- checked the registry and never inserted a rule property, so the guarded path
-- was never executed — which is the failure `a lesson written is not followed`
-- names, made again while that lesson was two migrations old.
--
-- ── AND THE DEEPER PROBLEM THE TYPE ERROR WAS POINTING AT ──────────────────
-- The column can only ever reference an OBJECT TYPE's property. An interface
-- rule does not write those — it writes the interface's own:
--
--   "you can use interface action rules only to modify the *interface shared
--    properties*"                        (action-types/actions-on-interfaces)
--
-- which is the point of the kind. A rule naming `Aircraft.status` is a rule
-- about Aircraft, however it is labelled. So the fix is not a cast: the table
-- needs a second reference, and each kind uses the one matching what it edits.
--
-- ── AND A THIRD GUARD NOBODY LOOKED AT ─────────────────────────────────────
-- `guard_action_rule_property` reads the rule's `object_type_id` and refuses
-- the row outright when it is null — "% does not write object properties". That
-- was right while every rule carrying properties targeted an object type. It
-- makes all five interface kinds unusable, and it is where the check belongs,
-- because it fires on the property INSERT rather than needing the rule row
-- touched afterwards.

BEGIN;

ALTER TABLE public.action_type_rule_properties
  ADD COLUMN interface_property_id uuid REFERENCES public.interface_properties(id) ON DELETE CASCADE;
-- The NOT NULL said "every rule property names an object type's property",
-- which was the same assumption stated a third way.
ALTER TABLE public.action_type_rule_properties ALTER COLUMN property_id DROP NOT NULL;

-- A rule property names exactly one thing. The existing UNIQUE (rule_id,
-- property_id) still covers object rules; interface rules get their own.
ALTER TABLE public.action_type_rule_properties
  ADD CONSTRAINT action_type_rule_properties_one_property
  CHECK (num_nonnulls(property_id, interface_property_id) = 1);
CREATE UNIQUE INDEX action_type_rule_properties_interface_property
  ON public.action_type_rule_properties (rule_id, interface_property_id)
  WHERE interface_property_id IS NOT NULL;
CREATE INDEX action_type_rule_properties_iface_prop_fk
  ON public.action_type_rule_properties (interface_property_id);

COMMENT ON COLUMN public.action_type_rule_properties.interface_property_id IS
  'The interface property an `…of interface` rule writes. Exactly one of this and property_id is set, because a rule edits either an object type''s property or an interface''s.';

-- ── the property row knows which kind of property it may name ───────────────
CREATE OR REPLACE FUNCTION public.guard_action_rule_property()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE r record; prop_owner uuid; ip_owner uuid;
BEGIN
  SELECT object_type_id, interface_id, kind INTO r
    FROM public.action_type_rules WHERE id = NEW.rule_id;

  IF r.interface_id IS NOT NULL THEN
    -- "you can use interface action rules only to modify the interface shared
    --  properties" — an object type's property would make this a rule about
    --  that one type wearing an interface label.
    IF NEW.interface_property_id IS NULL THEN
      RAISE EXCEPTION 'Ontology:InterfaceRuleWritesObjectProperty — % writes interface properties, not an object type''s', r.kind
        USING HINT = 'Set interface_property_id instead of property_id.';
    END IF;
    SELECT interface_id INTO ip_owner
      FROM public.interface_properties WHERE id = NEW.interface_property_id;
    IF ip_owner IS DISTINCT FROM r.interface_id THEN
      RAISE EXCEPTION 'Ontology:InterfaceRuleWritesUndeclaredProperty — that property belongs to another interface'
        USING HINT = 'An interface rule may only write its own interface''s properties, so the edit applies to every implementing type.';
    END IF;
    RETURN NEW;
  END IF;

  IF r.object_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:RuleWritesNoProperties — % does not write object properties', r.kind;
  END IF;
  IF NEW.interface_property_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ontology:ObjectRuleWritesInterfaceProperty — only an interface rule writes interface properties';
  END IF;

  SELECT p.object_type_id INTO prop_owner
    FROM public.object_type_properties p WHERE p.id = NEW.property_id;
  IF prop_owner IS DISTINCT FROM r.object_type_id THEN
    RAISE EXCEPTION 'Ontology:PropertyNotOnRuleTarget — a rule writes properties of the object type it edits';
  END IF;
  RETURN NEW;
END $fn$;

-- ── and the rule row re-checks, because its target can change under them ────
CREATE OR REPLACE FUNCTION public.guard_action_type_rule()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE targets text; n int; act_ont uuid; tgt_ont uuid; stray text;
BEGIN
  SELECT k.targets INTO targets FROM public.action_rule_kinds() k WHERE k.kind = NEW.kind;
  IF targets IS NULL THEN
    RAISE EXCEPTION 'Ontology:UnknownActionRuleKind — % is not a rule kind', NEW.kind
      USING HINT = 'Kinds come from action_rule_kinds(), which mirrors action-types/rules.';
  END IF;

  IF targets = 'object_type' AND NEW.object_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleNeedsObjectType — % operates on an object type', NEW.kind;
  END IF;
  IF targets = 'link_type' AND NEW.link_type_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleNeedsLinkType — % operates on a link type', NEW.kind;
  END IF;
  IF targets = 'interface' AND NEW.interface_id IS NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleNeedsInterface — % operates on an interface', NEW.kind;
  END IF;
  IF targets = 'none' AND NEW.function_name IS NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleNeedsFunction — a function rule names a function';
  END IF;
  IF targets <> 'interface' AND NEW.interface_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ontology:ActionRuleTargetMismatch — % does not operate on an interface', NEW.kind;
  END IF;
  IF targets = 'interface' AND (NEW.object_type_id IS NOT NULL OR NEW.link_type_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Ontology:ActionRuleTargetMismatch — % names an interface, not an object or link type', NEW.kind;
  END IF;

  -- "When this rule is present, NO OTHER RULE may be configured since function
  --  code alone is capable of handling everything that other rules can do."
  SELECT count(*) INTO n FROM public.action_type_rules r
   WHERE r.action_type_id = NEW.action_type_id AND r.id IS DISTINCT FROM NEW.id;
  IF NEW.kind = 'function' AND n > 0 THEN
    RAISE EXCEPTION 'Ontology:FunctionRuleIsExclusive — a function rule is the only rule an action may have';
  END IF;
  IF NEW.kind <> 'function' AND EXISTS (
       SELECT 1 FROM public.action_type_rules r
        WHERE r.action_type_id = NEW.action_type_id AND r.kind = 'function'
          AND r.id IS DISTINCT FROM NEW.id) THEN
    RAISE EXCEPTION 'Ontology:FunctionRuleIsExclusive — this action is already backed by a function rule';
  END IF;

  -- An action edits its own ontology.
  SELECT ontology_id INTO act_ont FROM public.action_types WHERE id = NEW.action_type_id;
  IF NEW.object_type_id IS NOT NULL THEN
    SELECT ontology_id INTO tgt_ont FROM public.object_types WHERE id = NEW.object_type_id;
  ELSIF NEW.link_type_id IS NOT NULL THEN
    SELECT ontology_id INTO tgt_ont FROM public.link_types WHERE id = NEW.link_type_id;
  ELSIF NEW.interface_id IS NOT NULL THEN
    SELECT ontology_id INTO tgt_ont FROM public.ontology_interfaces WHERE id = NEW.interface_id;
  END IF;
  IF tgt_ont IS NOT NULL AND tgt_ont IS DISTINCT FROM act_ont THEN
    RAISE EXCEPTION 'Ontology:ActionCrossesOntologies — an action type edits its own ontology';
  END IF;

  -- Repointing a rule at another interface would strand the properties the old
  -- one declared, so they are re-checked here and not only on insert.
  IF NEW.interface_id IS NOT NULL THEN
    SELECT string_agg(coalesce(ip.api_name, 'an object type property'), ', ') INTO stray
      FROM public.action_type_rule_properties p
      LEFT JOIN public.interface_properties ip ON ip.id = p.interface_property_id
     WHERE p.rule_id = NEW.id
       AND ip.interface_id IS DISTINCT FROM NEW.interface_id;
    IF stray IS NOT NULL THEN
      RAISE EXCEPTION 'Ontology:InterfaceRuleWritesUndeclaredProperty — % is not a property of this interface', stray
        USING HINT = 'An interface rule may only write its own interface''s properties, so the edit applies to every implementing type.';
    END IF;
  END IF;

  RETURN NEW;
END $fn$;

-- ── assertions, which insert rule properties — the thing 569 never did ──────
DO $do$
DECLARE
  org uuid; sp uuid; ont uuid; proj uuid; usr uuid;
  iface uuid; other_iface uuid; ip uuid; other_ip uuid;
  act uuid; ot uuid; op uuid; rule uuid; n int; ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe570') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('probe570') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (org, sp, 'probe570', 'Probe570') RETURNING id INTO proj;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
              'authenticated', 'authenticated', 'probe570@beacon.test') RETURNING id INTO usr;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (sp, 'probe570', 'Probe570', false) RETURNING id INTO ont;

    INSERT INTO public.ontology_interfaces (ontology_id, api_name, label, created_by_user_id)
      VALUES (ont, 'Serviceable', 'Serviceable', usr) RETURNING id INTO iface;
    INSERT INTO public.interface_properties (interface_id, property_id, api_name, display_name, base_type)
      VALUES (iface, 'status', 'status', 'Status', 'string') RETURNING id INTO ip;
    INSERT INTO public.ontology_interfaces (ontology_id, api_name, label, created_by_user_id)
      VALUES (ont, 'Other', 'Other', usr) RETURNING id INTO other_iface;
    INSERT INTO public.interface_properties (interface_id, property_id, api_name, display_name, base_type)
      VALUES (other_iface, 'elsewhere', 'elsewhere', 'Elsewhere', 'string') RETURNING id INTO other_ip;

    INSERT INTO public.action_types (ontology_id, api_name, label)
      VALUES (ont, 'mark-serviced', 'Mark serviced') RETURNING id INTO act;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (ont, proj, 'Aircraft570', 'Aircraft') RETURNING id INTO ot;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, backing_column)
      VALUES (ot, 'tail', 'tail', 'Tail', 'string', 'tail') RETURNING id INTO op;

    -- An interface rule writing its own interface's property is accepted. This
    -- is the insert 569 could not survive.
    INSERT INTO public.action_type_rules (action_type_id, kind, position, interface_id)
      VALUES (act, 'modify_object_of_interface', 1, iface) RETURNING id INTO rule;
    INSERT INTO public.action_type_rule_properties (rule_id, interface_property_id, value_source, static_value)
      VALUES (rule, ip, 'static', '"serviced"'::jsonb);
    SELECT count(*) INTO n FROM public.action_type_rule_properties WHERE rule_id = rule;
    IF n <> 1 THEN RAISE EXCEPTION 'the interface property did not stick'; END IF;

    -- Another interface's property is refused — the check 569 meant to make.
    ok := false;
    BEGIN
      INSERT INTO public.action_type_rule_properties (rule_id, interface_property_id, value_source, static_value)
        VALUES (rule, other_ip, 'static', '"x"'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%InterfaceRuleWritesUndeclaredProperty%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'an interface rule wrote another interface''s property'; END IF;

    -- And an object type's property is refused on an interface rule.
    ok := false;
    BEGIN
      INSERT INTO public.action_type_rule_properties (rule_id, property_id, value_source, static_value)
        VALUES (rule, op, 'static', '"x"'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%InterfaceRuleWritesObjectProperty%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'an interface rule wrote an object type property'; END IF;

    -- Repointing the rule strands the property it already carries, and the
    -- rule-level check is what catches that.
    ok := false;
    BEGIN
      UPDATE public.action_type_rules SET interface_id = other_iface WHERE id = rule;
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%InterfaceRuleWritesUndeclaredProperty%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a rule was repointed away from the property it writes'; END IF;

    -- Exactly one reference, by constraint.
    ok := false;
    BEGIN
      INSERT INTO public.action_type_rule_properties (rule_id, property_id, interface_property_id, value_source, static_value)
        VALUES (rule, op, ip, 'static', '"x"'::jsonb);
    EXCEPTION WHEN check_violation THEN ok := true;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'a rule property named both a property and an interface property'; END IF;

    -- An object rule is untouched: this widens the table, it does not loosen it.
    INSERT INTO public.action_type_rules (action_type_id, kind, position, object_type_id)
      VALUES (act, 'modify_object', 2, ot) RETURNING id INTO rule;
    INSERT INTO public.action_type_rule_properties (rule_id, property_id, value_source, static_value)
      VALUES (rule, op, 'static', '"N1"'::jsonb);
    ok := false;
    BEGIN
      INSERT INTO public.action_type_rule_properties (rule_id, interface_property_id, value_source, static_value)
        VALUES (rule, ip, 'static', '"x"'::jsonb);
    EXCEPTION WHEN OTHERS THEN
      IF sqlerrm LIKE '%ObjectRuleWritesInterfaceProperty%' THEN ok := true; ELSE RAISE; END IF;
    END;
    IF NOT ok THEN RAISE EXCEPTION 'an object rule wrote an interface property'; END IF;

    RAISE EXCEPTION 'probe570:done';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm <> 'probe570:done' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO n FROM public.organizations WHERE name = 'probe570';
  IF n <> 0 THEN RAISE EXCEPTION 'the probe fixture survived'; END IF;

  RAISE NOTICE '570: an interface rule names an interface property';
END $do$;

COMMIT;
