-- 738 — a rule says what it compares against, and fails closed when it does not.
--
-- The conditional half of 673, reconciled against its page the way 736
-- reconciled the value half against the api. Four defects, each measured on the
-- live database before this migration by calling `format_rule_valid` directly.
--
-- 1. It failed OPEN, the same way 736 did and for the same reason. A missing
--    key makes `jsonb_typeof` return NULL, NULL rides the AND chain, and the
--    CHECK reads `format_rules_valid(...)` — a NULL there is not a violation.
--    Measured:
--
--      {"kind":"always_true"}                        -> NULL   (no formatting)
--      {"kind":"standard","formatting":{...}}        -> NULL   (no condition)
--      {"kind":"always_true","formatting":{"type":"custom"}} -> NULL (no colour)
--
--    737 fixed this for the value half hours ago; this is the same lesson in
--    the neighbouring function, which is why it is worth writing down twice.
--
-- 2. A rule could say nothing about what it compares against. Measured: a
--    `standard` rule with `operator` and no operand at all was ACCEPTED, and so
--    was one whose property name was the empty string. The page is explicit:
--
--      "Compare against a constant or a property reference."
--      — object-link-types/conditional-formatting.md
--
--    That is the same two-member shape the api publishes for an affix or a
--    currency code, so it gets the same treatment — except that a comparison's
--    constant is typed by the property it compares, so a number and a boolean
--    are admitted where the api's operand takes only a string. Hence a sibling
--    function rather than a reuse.
--
-- 3. A custom colour could only be hex. The page names three notations:
--
--      "Switch between hex, RGB or Blueprint colors based on need"
--      — object-link-types/conditional-formatting.md
--
--    so RGB is admitted. Blueprint colours are NOT admitted as names, and that
--    is the scoped divergence: a Blueprint colour picked in the editor resolves
--    to a value, and no page publishes the palette's tokens. If a page ever
--    lists them, this is the line to widen.
--
-- 4. The True/False switch had no form at all:
--
--      "Toggle between a True or False rule."
--      — object-link-types/conditional-formatting.md
--
--    stored now as an optional boolean, defaulting to a True rule, which is
--    what the editor opens with.
--
-- And the missing sibling of an existing family. `derived-properties.md` lists
-- what a derived property cannot have, and four of its bullets are already
-- CHECKs here — `derived_is_not_required`, `derived_takes_no_value_type`,
-- `derived_is_not_a_primary_key`, `derived_fields_only_when_derived`. This one
-- was skipped:
--
--   "**Display formatting:** Derived properties cannot have rule set bindings
--    or base formatters."
--   — object-link-types/derived-properties.md
--
-- "Rule set binding" and "base formatter" are the docs' own names for the two
-- columns 673 added, which is the vocabulary that reading never adopted.
--
-- WHAT THIS DOES NOT DO. The page's comparison list is typed — "Types of
-- comparisons available are based on the type of the property" — and a rule may
-- read a DIFFERENT property than the one it colours, so checking it means
-- resolving that reference. A CHECK cannot; this belongs on the
-- ontology_violations() rung and is recorded, unbuilt. The Math rule kind stays
-- excluded for the reason 673 recorded — its expression grammar is one sentence
-- on one page — and the string operator set stays at the three the page names,
-- which is stricter than a page that says "etc." and is scoped below rather
-- than guessed at.
--
-- Live exposure: zero. No property carries a rule.

CREATE FUNCTION public.format_condition_operand_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT coalesce(
    jsonb_typeof(j) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(j)) = 1
    AND CASE
      WHEN j ? 'constant' THEN
        jsonb_typeof(j -> 'constant' -> 'value') IN ('string', 'number', 'boolean')
      WHEN j ? 'propertyType' THEN
        jsonb_typeof(j -> 'propertyType' -> 'propertyApiName') = 'string'
      ELSE false
    END, false)
$fn$;

COMMENT ON FUNCTION public.format_condition_operand_valid(jsonb) IS
  'What a conditional formatting rule compares against: "Compare against a constant or a property reference" (conditional-formatting). The api''s own two-member operand shape, except that a comparison''s constant is typed by the property, so a number and a boolean are admitted where formatting_operand_valid takes only a string. 738.';

CREATE OR REPLACE FUNCTION public.format_rule_valid(r jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT coalesce(
    jsonb_typeof(r) = 'object'
    -- "Switch between a Standard rule, an Always true rule, or a Math rule."
    -- Math is excluded; see 738's header.
    AND r ->> 'kind' IN ('standard', 'always_true')
    -- "Toggle between a True or False rule." Absent is a True rule.
    AND (NOT r ? 'is_true' OR jsonb_typeof(r -> 'is_true') = 'boolean')
    AND jsonb_typeof(r -> 'formatting') = 'object'
    AND r -> 'formatting' ->> 'type' IN ('intent', 'custom')
    AND (r -> 'formatting' ->> 'type' <> 'intent'
         OR r -> 'formatting' ->> 'intent' IN ('primary', 'success', 'warning', 'danger'))
    -- Switch between hex, RGB or Blueprint colors, quoted in 738's header.
    AND (r -> 'formatting' ->> 'type' <> 'custom'
         OR r -> 'formatting' ->> 'color' ~ '^#[0-9a-fA-F]{6}$'
         OR r -> 'formatting' ->> 'color' ~ '^#[0-9a-fA-F]{3}$'
         OR r -> 'formatting' ->> 'color' ~
              '^rgba?\(\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*,\s*[0-9]{1,3}\s*(,\s*(0|1|0?\.[0-9]+)\s*)?\)$')
    AND (NOT r -> 'formatting' ? 'alignment'
         OR r -> 'formatting' ->> 'alignment' IN ('left', 'right'))
    AND (r ->> 'kind' = 'always_true' OR (
         jsonb_typeof(r -> 'condition') = 'object'
         -- The rule may read another property than the one it colours, so the
         -- reference is named rather than assumed — but it must be named.
     AND length(coalesce(r -> 'condition' ->> 'property', '')) > 0
     AND r -> 'condition' ->> 'comparison' IN
           ('string', 'exact_numeric', 'numeric_range', 'boolean', 'is_null')
     AND (r -> 'condition' ->> 'comparison' <> 'string'
          OR (r -> 'condition' ->> 'operator' IN ('is_exactly', 'contains', 'starts_with')
              AND (NOT r -> 'condition' ? 'case_sensitive'
                   OR jsonb_typeof(r -> 'condition' -> 'case_sensitive') = 'boolean')))
         -- Is null compares against nothing; a range's two ends are a shape no
         -- page publishes, so it is required to be an object and no more.
     AND CASE r -> 'condition' ->> 'comparison'
           WHEN 'is_null'       THEN true
           WHEN 'numeric_range' THEN jsonb_typeof(r -> 'condition' -> 'value') = 'object'
           ELSE public.format_condition_operand_valid(r -> 'condition' -> 'value')
         END
    )), false)
$fn$;

CREATE OR REPLACE FUNCTION public.format_rules_valid(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT coalesce(
    jsonb_typeof(j) = 'array'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) r
                     WHERE NOT public.format_rule_valid(r.value)), false)
$fn$;

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT derived_takes_no_display_formatting CHECK (
    source <> 'linked_objects'
    OR (format_rules = '[]'::jsonb AND value_formatting IS NULL));

COMMENT ON CONSTRAINT derived_takes_no_display_formatting ON public.object_type_properties IS
  'Derived properties cannot have rule set bindings or base formatters (derived-properties) — the missing sibling of derived_is_not_required, derived_takes_no_value_type and derived_is_not_a_primary_key, which are the same bullet list. A composite rule, not a value set. 738.';

-- ── PROVED BY DOING — each defect, on the arm that had it ──────────────────

DO $$
DECLARE
  c jsonb;
  bad jsonb := jsonb_build_array(
    '{"kind":"always_true"}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"}}',
    '{"kind":"always_true","formatting":{"type":"custom"}}',
    '{"kind":"always_true","formatting":{"type":"custom","color":"cobalt4"}}',
    '{"kind":"math","formatting":{"type":"intent","intent":"primary"}}',
    '{"kind":"always_true","formatting":{"type":"intent","intent":"chartreuse"}}',
    '{"kind":"always_true","formatting":{"type":"intent","intent":"primary"},"is_true":"yes"}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"p","comparison":"string","operator":"is_exactly"}}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"","comparison":"is_null"}}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"p","comparison":"string","operator":"ends_with","value":{"constant":{"value":"x"}}}}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"p","comparison":"string","operator":"is_exactly","value":{"constant":{"value":"A320"},"propertyType":{"propertyApiName":"other"}}}}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"p","comparison":"exact_numeric","value":{"constant":{}}}}'
  );
  good jsonb := jsonb_build_array(
    '{"kind":"always_true","formatting":{"type":"intent","intent":"success"}}',
    '{"kind":"always_true","formatting":{"type":"custom","color":"#137cbd"}}',
    '{"kind":"always_true","formatting":{"type":"custom","color":"#abc"}}',
    '{"kind":"always_true","formatting":{"type":"custom","color":"rgb(19, 124, 189)"}}',
    '{"kind":"always_true","formatting":{"type":"custom","color":"rgba(19,124,189,0.5)"}}',
    '{"kind":"always_true","formatting":{"type":"intent","intent":"danger","alignment":"right"},"is_true":false}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"type","comparison":"string","operator":"is_exactly","case_sensitive":false,"value":{"constant":{"value":"A320"}}}}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"performanceFactor","comparison":"exact_numeric","value":{"constant":{"value":0.8}}}}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"wifi","comparison":"boolean","value":{"constant":{"value":true}}}}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"type","comparison":"is_null"}}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"capacity","comparison":"numeric_range","value":{"min":0,"max":10}}}',
    '{"kind":"standard","formatting":{"type":"intent","intent":"warning"},"condition":{"property":"type","comparison":"string","operator":"contains","value":{"propertyType":{"propertyApiName":"model"}}}}'
  );
BEGIN
  -- IS NOT FALSE, deliberately: three of these were NULL before 738, and an
  -- assertion written as `IF valid(...) THEN RAISE` would have passed on each.
  FOR c IN SELECT * FROM jsonb_array_elements(bad) LOOP
    IF public.format_rule_valid((c #>> '{}')::jsonb) IS NOT FALSE THEN
      RAISE EXCEPTION 'a bad rule did not fail closed: %', c;
    END IF;
  END LOOP;

  FOR c IN SELECT * FROM jsonb_array_elements(good) LOOP
    IF NOT public.format_rule_valid((c #>> '{}')::jsonb) THEN
      RAISE EXCEPTION 'a good rule was refused: %', c;
    END IF;
  END LOOP;

  -- The array wrapper carries the same verdict, and fails closed on a non-array.
  IF public.format_rules_valid('{"kind":"always_true"}'::jsonb) IS NOT FALSE THEN
    RAISE EXCEPTION 'a non-array rule set was not refused';
  END IF;
  IF NOT public.format_rules_valid('[]'::jsonb) THEN
    RAISE EXCEPTION 'the empty rule set was refused';
  END IF;
END $$;

-- ── and the derived rule, through the front door ───────────────────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid; ds uuid; br uuid; txn uuid;
  t uuid; src_id uuid; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m738 probe') RETURNING id INTO org;
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm738-' || usr || '@beacon.test');
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm738-' || usr || '@beacon.test', 'admin', org);

  SELECT public.create_space('M738 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, space, 'm738p', 'm738 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm738ds', 'm738ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  VALUES (ds, txn, '[{"name":"pk","type":"STRING"}]'::jsonb);
  UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE id = txn;

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
  VALUES (ont, proj, 'M738Thing', 'M738 thing') RETURNING id INTO t;
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (t, ds, br) RETURNING id INTO src_id;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (t, 'pk', 'Id', 'id', 'string', 'column', 'pk', true, true, true);

  -- A derived property may carry neither of the two.
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, display_name, api_name, base_type, source,
       derived_aggregation, format_rules)
    VALUES (t, 'cnt', 'Count', 'cnt', 'integer', 'linked_objects', 'count',
            '[{"kind":"always_true","formatting":{"type":"intent","intent":"primary"}}]'::jsonb);
    RAISE EXCEPTION 'a derived property was given a rule set binding';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.object_type_properties
    (object_type_id, property_id, display_name, api_name, base_type, source,
     derived_aggregation)
  VALUES (t, 'cnt', 'Count', 'cnt', 'integer', 'linked_objects', 'count');
  BEGIN
    UPDATE public.object_type_properties
       SET value_formatting = '{"number":{"numberType":{"standard":{"baseFormatOptions":{}}}}}'::jsonb
     WHERE object_type_id = t AND property_id = 'cnt';
    RAISE EXCEPTION 'a derived property was given a base formatter';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- A column-backed one still may, and in the notation the page names.
  UPDATE public.object_type_properties
     SET format_rules = '[{"kind":"always_true","formatting":{"type":"custom","color":"rgb(19,124,189)"}}]'::jsonb
   WHERE object_type_id = t AND property_id = 'pk';
  SELECT count(*) INTO n FROM public.object_type_properties
   WHERE object_type_id = t AND property_id = 'pk' AND format_rules <> '[]'::jsonb;
  IF n <> 1 THEN RAISE EXCEPTION 'a column property could not take an rgb rule'; END IF;

  DELETE FROM public.job_specs WHERE output_object_type_id = t;
  DELETE FROM public.object_types WHERE id = t;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
