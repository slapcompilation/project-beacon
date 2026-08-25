-- Property formatting, from readings/property-formatting.md (built after a
-- human read its Decisions block): conditional rules and value formatters as
-- two validated columns on the property.
--
-- ── CONDITIONAL RULES ARE AN ORDERED LIST ────────────────────────────────────
--
--   "**Conditional formatting** enables the configuration of rules for any property and dictates how that property's values will be rendered (e.g. coloring, alignment, etc.) in user facing applications. When you configure conditional formatting in the Ontology Manager, the formatting rules will apply in Object Explorer, Object Views, Quiver, and Workshop."
--   — object-link-types/conditional-formatting.md
--
-- The pane's own caption is the storage rule: rules are evaluated from top
-- to bottom (paraphrased from conditional-formatting-type-rules.png), and
-- the Always-true fallback advice only works when the first match wins — so
-- format_rules is a jsonb ARRAY whose order is the semantics. A rule's
-- condition may watch another property:
--
--   "The rule will always be applied to the property from which you selected **Add a rule**; however, this dropdown allows you to choose to apply the rule based on the value of another property."
--   — object-link-types/conditional-formatting.md
--
-- and references it by the sibling's property_id TEXT — stable across saves,
-- which is what makes the copy semantics free:
--
--   "Copied rules will continue referencing their original properties. For example, if a rule states that `wifi` values should appear green when "true," and that rule is copied to the `customer experience` property, values of the `customer experience` property will also be green when the object's `wifi` value is "true.""
--   — object-link-types/conditional-formatting.md
--
-- Formatting is a Blueprint intent or a custom colour, plus alignment:
--
--   "Use Blueprint colors and intents or add your own custom color. You can also switch alignment."
--   — object-link-types/conditional-formatting.md
--
-- The Math rule kind is EXCLUDED with its reason: one sentence, no grammar.
-- Operators hold only the stated tokens (is exactly, contains, starts with —
-- the page's "etc." stays unenumerated, the emit-only rule).
--
-- ── VALUE FORMATTING IS ONE FORMATTER, TYPED BY THE BASE TYPE ────────────────
--
--   "**Value formatting** refers to applying a special formatter to the value of a property, transforming the raw value to a more readable version."
--   — object-link-types/value-formatting.md
--
-- Kinds from the page's table: numeric, date and time, Foundry ID
-- (Multipass username), resource RID. Artifact GID is excluded — artifacts
-- are a product we do not have. The numeric options include the capture-only
-- Negative to parenthesis switch (value-formatting-numeric-formatting.png,
-- paraphrased); the datetime styles are the published six with the capture's
-- spellings, and a timezone that is static or the user's:
--
--   "If you are formatting a timestamp, you can specify which timezone to render the timestamp, either as a static timezone that you input, or as the application user's current timezone."
--   — object-link-types/value-formatting.md
--
-- ── THE IMPORT GUARD CLOSES 634'S CAVEAT ─────────────────────────────────────
--
--   "An exported Ontology working state with conditional formatting rules configured on its properties cannot be imported to an Ontology other than the one it was exported from."
--   — ontology-manager/export-import.md
--
--   "If you receive the error `OntologyMetadata:UnreferencedRuleSets`, you are trying to import an Ontology working state with conditional formatting rules that are not defined in that Ontology and cannot be transferred over."
--   — ontology-manager/export-import.md
--
-- import_working_state refuses, by that name, a file whose format rules
-- reference properties held neither by the target ontology nor by the file
-- itself. Every live-patch anchor asserts it occurs exactly once.

-- ── THE VALIDATORS ───────────────────────────────────────────────────────────

CREATE FUNCTION public.format_rule_valid(r jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(r) = 'object'
     AND r ->> 'kind' IN ('standard', 'always_true')
     AND jsonb_typeof(r -> 'formatting') = 'object'
     AND r -> 'formatting' ->> 'type' IN ('intent', 'custom')
     AND (r -> 'formatting' ->> 'type' <> 'intent'
          OR r -> 'formatting' ->> 'intent' IN ('primary', 'success', 'warning', 'danger'))
     AND (r -> 'formatting' ->> 'type' <> 'custom'
          OR r -> 'formatting' ->> 'color' ~ '^#[0-9a-fA-F]{6}$')
     AND (NOT r -> 'formatting' ? 'alignment'
          OR r -> 'formatting' ->> 'alignment' IN ('left', 'right'))
     AND (r ->> 'kind' = 'always_true' OR (
          jsonb_typeof(r -> 'condition') = 'object'
      AND r -> 'condition' ? 'property'
      AND r -> 'condition' ->> 'comparison' IN
            ('string', 'exact_numeric', 'numeric_range', 'boolean', 'is_null')
      AND (r -> 'condition' ->> 'comparison' <> 'string'
           OR r -> 'condition' ->> 'operator' IN ('is_exactly', 'contains', 'starts_with'))))
$$;

COMMENT ON FUNCTION public.format_rule_valid(jsonb) IS
  'One conditional formatting rule (object-link-types/conditional-formatting): standard or always_true (Math is excluded — one sentence, no grammar); a condition watching a sibling property by its property_id, with the stated comparisons and the stated string operators only; formatting as a Blueprint intent or a custom colour, optionally aligned.';

CREATE FUNCTION public.format_rules_valid(j jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(j) = 'array'
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(j) r
                      WHERE NOT public.format_rule_valid(r.value))
$$;

CREATE FUNCTION public.value_formatting_valid(p_base text, j jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(j) = 'object'
     AND CASE j ->> 'kind'
       WHEN 'numeric' THEN
            p_base IN ('integer', 'long', 'short', 'double', 'float', 'decimal', 'byte')
        AND (NOT j ? 'base'
             OR j ->> 'base' IN ('currency', 'unit', 'percentage', 'prefix_suffix'))
        AND (NOT j ? 'notation'
             OR j ->> 'notation' IN ('compact', 'scientific', 'engineering'))
       WHEN 'datetime' THEN
            p_base IN ('date', 'timestamp')
        AND j ->> 'style' IN
              ('date', 'datetime', 'datetime_short', 'iso_instant', 'relative', 'time')
        AND (NOT j ? 'timezone'
             OR (j -> 'timezone' ->> 'kind' = 'user'
                 OR (j -> 'timezone' ->> 'kind' = 'static' AND j -> 'timezone' ? 'tz')))
       WHEN 'user'         THEN p_base = 'string'
       WHEN 'resource_rid' THEN p_base = 'string'
       ELSE false END
$$;

COMMENT ON FUNCTION public.value_formatting_valid(text, jsonb) IS
  'One value formatter, typed by the property''s base type (object-link-types/value-formatting): numeric (currency/unit/percentage/prefix-suffix, notation, digit options and the capture''s negative-to-parenthesis ride free-form keys), datetime (the published six styles, timezone static or the user''s), Multipass username, resource RID. Artifact GID excluded — no artifacts here.';

-- ── THE COLUMNS ──────────────────────────────────────────────────────────────

ALTER TABLE public.object_type_properties
  ADD COLUMN format_rules jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (public.format_rules_valid(format_rules)),
  ADD COLUMN value_formatting jsonb
    CHECK (value_formatting IS NULL OR public.value_formatting_valid(base_type, value_formatting));

COMMENT ON COLUMN public.object_type_properties.format_rules IS
  'Conditional formatting rules, an ORDERED array — evaluated from top to bottom, first match wins (the pane''s own caption plus the Always-true fallback advice). Conditions reference sibling properties by property_id text, which keeps copied rules pointing at their originals.';

COMMENT ON COLUMN public.object_type_properties.value_formatting IS
  'The property''s one value formatter, or NULL. Shape per kind in value_formatting_valid.';

-- ── THE SAVE PATH CARRIES BOTH ───────────────────────────────────────────────
DO $do$
DECLARE src text; a text; anchors text[]; i int;
BEGIN
  src := replace(pg_get_functiondef('public.apply_object_type(jsonb,jsonb,jsonb)'::regprocedure), chr(13), '');
  anchors := ARRAY[
    'shared_property_id, required, allow_empty_arrays, visibility, position, is_primary_key, is_title_key,',
    'coalesce((e->>''allow_empty_arrays'')::boolean, false),'];
  FOREACH a IN ARRAY anchors LOOP
    i := position(a in src);
    IF i = 0 OR position(a in substring(src from i + length(a))) > 0 THEN
      RAISE EXCEPTION 'an anchor moved or repeats: apply_object_type is not the text 673 read: %', left(a, 60);
    END IF;
  END LOOP;
  src := replace(src, anchors[1],
    'shared_property_id, required, allow_empty_arrays, format_rules, value_formatting, visibility, position, is_primary_key, is_title_key,');
  src := replace(src, anchors[2],
    'coalesce((e->>''allow_empty_arrays'')::boolean, false),
    coalesce(e->''format_rules'', ''[]''::jsonb),
    nullif(e->''value_formatting'', ''null''::jsonb),');
  EXECUTE src;
END $do$;

-- ── THE IMPORT REFUSES DANGLING RULES, BY NAME ───────────────────────────────
DO $do$
DECLARE src text; a text; i int;
BEGIN
  src := replace(pg_get_functiondef('public.import_working_state(jsonb)'::regprocedure), chr(13), '');
  a := '  -- "recreate the ENTIRE working state" — a replacement, not a merge.';
  i := position(a in src);
  IF i = 0 OR position(a in substring(src from i + length(a))) > 0 THEN
    RAISE EXCEPTION 'an anchor moved or repeats: import_working_state is not the text 673 read';
  END IF;
  src := replace(src, a,
'  -- A format rule names sibling properties; a rule pointing at a property
  -- held neither by this ontology nor by the file itself is the documented
  -- refusal.
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(p_file->''changes'') ch
      CROSS JOIN LATERAL jsonb_array_elements(
        coalesce(ch.value->''fields''->''properties'', ''[]''::jsonb)) pr
      CROSS JOIN LATERAL jsonb_array_elements(
        coalesce(pr.value->''format_rules'', ''[]''::jsonb)) fr
     WHERE fr.value->''condition''->>''property'' IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(
             coalesce(ch.value->''fields''->''properties'', ''[]''::jsonb)) pr2
          WHERE pr2.value->>''property_id'' = fr.value->''condition''->>''property'')
       AND NOT EXISTS (
         SELECT 1 FROM public.object_type_properties op
           JOIN public.object_types ot ON ot.id = op.object_type_id
          WHERE ot.ontology_id = v_ont
            AND op.object_type_id = (ch.value->>''resource_id'')::uuid
            AND op.property_id = fr.value->''condition''->>''property'')) THEN
    RAISE EXCEPTION ''OntologyMetadata:UnreferencedRuleSets — the file carries conditional formatting rules that reference properties this Ontology does not hold'';
  END IF;

' || a);
  EXECUTE src;
END $do$;

-- ── PROVED BY DOING ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_ont uuid; v_usr uuid;
  v_ds uuid; v_br uuid; v_ot uuid; v_dsid uuid; v_rules jsonb; v_vf jsonb; v_n int;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe673') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe673') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe673', 'Probe673') RETURNING id INTO v_proj;
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_sp, 'probe673', 'Probe 673', false) RETURNING id INTO v_ont;
    v_usr := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              'probe673-' || v_usr || '@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, 'probe673-' || v_usr || '@beacon.test', 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe673', 'Probe673') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (v_ds, 'master') RETURNING id INTO v_br;

    -- the page's own example, through the save path: wifi green when true,
    -- red when false; type prefilled from another property's value; and a
    -- unit formatter on a numeric
    v_rules := jsonb_build_array(
      jsonb_build_object('kind', 'standard',
        'condition', jsonb_build_object('property', 'wifi', 'comparison', 'boolean',
                                        'values', jsonb_build_array(true)),
        'formatting', jsonb_build_object('type', 'intent', 'intent', 'success')),
      jsonb_build_object('kind', 'always_true',
        'formatting', jsonb_build_object('type', 'custom', 'color', '#cd4246',
                                         'alignment', 'right')));
    -- the type is born with its datasource and key; the formatted properties
    -- follow in a second save, referencing the datasource row that now exists
    v_ot := public.save_object_type(
      jsonb_build_object('api_name', 'Probe673Plane', 'label', 'Probe673 Plane',
        'ontology_id', v_ont::text,
        'datasources', jsonb_build_array(jsonb_build_object(
          'dataset_id', v_ds::text, 'branch_id', v_br::text))),
      jsonb_build_array(
        jsonb_build_object('property_id', 'pk', 'display_name', 'Id', 'api_name', 'pk',
          'base_type', 'string', 'source', 'column', 'backing_column', 'pk',
          'is_primary_key', true, 'is_title_key', true, 'required', true)));
    PERFORM public.save_working_state();
    SELECT d.id INTO v_dsid FROM public.object_type_datasources d
     WHERE d.object_type_id = v_ot;
    PERFORM public.save_object_type(
      jsonb_build_object('id', v_ot::text, 'api_name', 'Probe673Plane',
        'label', 'Probe673 Plane', 'ontology_id', v_ont::text,
        'datasources', jsonb_build_array(jsonb_build_object(
          'dataset_id', v_ds::text, 'branch_id', v_br::text))),
      jsonb_build_array(
        jsonb_build_object('property_id', 'pk', 'display_name', 'Id', 'api_name', 'pk',
          'base_type', 'string', 'source', 'column', 'backing_column', 'pk',
          'is_primary_key', true, 'is_title_key', true, 'required', true),
        jsonb_build_object('property_id', 'wifi', 'display_name', 'Wifi', 'api_name', 'wifi',
          'base_type', 'boolean', 'source', 'column', 'backing_column', 'wifi',
          'datasource_id', v_dsid::text,
          'format_rules', v_rules),
        jsonb_build_object('property_id', 'capacity', 'display_name', 'Capacity',
          'api_name', 'capacity', 'base_type', 'integer', 'source', 'column',
          'backing_column', 'capacity', 'datasource_id', v_dsid::text,
          'value_formatting', jsonb_build_object('kind', 'numeric', 'base', 'unit',
            'unit', 'lb', 'use_grouping', true))));
    PERFORM public.save_working_state();

    SELECT p.format_rules INTO v_rules FROM public.object_type_properties p
     WHERE p.object_type_id = v_ot AND p.property_id = 'wifi';
    IF jsonb_array_length(v_rules) <> 2
       OR v_rules -> 0 -> 'formatting' ->> 'intent' IS DISTINCT FROM 'success'
       OR v_rules -> 1 ->> 'kind' IS DISTINCT FROM 'always_true' THEN
      RAISE EXCEPTION 'the save path should carry the ordered rules, got %', v_rules;
    END IF;
    SELECT p.value_formatting INTO v_vf FROM public.object_type_properties p
     WHERE p.object_type_id = v_ot AND p.property_id = 'capacity';
    IF v_vf ->> 'kind' IS DISTINCT FROM 'numeric' OR v_vf ->> 'unit' IS DISTINCT FROM 'lb' THEN
      RAISE EXCEPTION 'the save path should carry the formatter, got %', v_vf;
    END IF;

    -- refusals: a bogus rule kind, a bad intent, a bad colour, numeric
    -- formatting on a string, a bogus datetime style
    BEGIN
      UPDATE public.object_type_properties
         SET format_rules = '[{"kind": "math", "formatting": {"type": "intent", "intent": "success"}}]'
       WHERE object_type_id = v_ot AND property_id = 'wifi';
      RAISE EXCEPTION 'a math rule was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      UPDATE public.object_type_properties
         SET format_rules = '[{"kind": "always_true", "formatting": {"type": "intent", "intent": "cobalt"}}]'
       WHERE object_type_id = v_ot AND property_id = 'wifi';
      RAISE EXCEPTION 'a bogus intent was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      UPDATE public.object_type_properties
         SET format_rules = '[{"kind": "always_true", "formatting": {"type": "custom", "color": "red"}}]'
       WHERE object_type_id = v_ot AND property_id = 'wifi';
      RAISE EXCEPTION 'a non-hex colour was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      UPDATE public.object_type_properties
         SET value_formatting = '{"kind": "numeric", "base": "unit"}'
       WHERE object_type_id = v_ot AND property_id = 'pk';
      RAISE EXCEPTION 'numeric formatting on a string was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      UPDATE public.object_type_properties
         SET value_formatting = '{"kind": "datetime", "style": "cosmic"}'
       WHERE object_type_id = v_ot AND property_id = 'capacity';
      RAISE EXCEPTION 'a bogus datetime style was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;

    -- the import guard: a file whose rule references a property nobody holds
    -- refuses by the documented name; referencing a live sibling passes
    BEGIN
      PERFORM public.import_working_state(jsonb_build_object(
        'format', 'beacon.working-state.v1', 'ontology_id', v_ont::text,
        'changes', jsonb_build_array(jsonb_build_object(
          'resource_kind', 'object_type', 'resource_id', v_ot::text,
          'operation', 'modified',
          'fields', jsonb_build_object('properties', jsonb_build_array(
            jsonb_build_object('property_id', 'wifi', 'display_name', 'Wifi',
              'api_name', 'wifi', 'base_type', 'boolean', 'source', 'column',
              'backing_column', 'wifi',
              'format_rules', jsonb_build_array(jsonb_build_object(
                'kind', 'standard',
                'condition', jsonb_build_object('property', 'ghost', 'comparison', 'is_null'),
                'formatting', jsonb_build_object('type', 'intent', 'intent', 'danger'))))))))));
      RAISE EXCEPTION 'a dangling rule reference was imported';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'OntologyMetadata:UnreferencedRuleSets%' THEN RAISE; END IF;
    END;
    SELECT public.import_working_state(jsonb_build_object(
      'format', 'beacon.working-state.v1', 'ontology_id', v_ont::text,
      'changes', jsonb_build_array(jsonb_build_object(
        'resource_kind', 'object_type', 'resource_id', v_ot::text,
        'operation', 'modified',
        'fields', jsonb_build_object('properties', jsonb_build_array(
          jsonb_build_object('property_id', 'wifi', 'display_name', 'Wifi',
            'api_name', 'wifi', 'base_type', 'boolean', 'source', 'column',
            'backing_column', 'wifi',
            'format_rules', jsonb_build_array(jsonb_build_object(
              'kind', 'standard',
              'condition', jsonb_build_object('property', 'capacity', 'comparison', 'is_null'),
              'formatting', jsonb_build_object('type', 'intent', 'intent', 'warning'))))))))))
      INTO v_n;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'the well-referenced import should land one change, got %', v_n;
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '673 proved: the save path carries ordered rules and a unit formatter, five malformed shapes refuse, a dangling rule reference refuses the import by the documented name, and a well-referenced one lands';
  END;
END $$;
