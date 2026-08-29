-- 727 — a marking property becomes the mandatory control the page describes
-- (creation review, F11: the base type existed as a token — a property saved
-- as marking was an ordinary column that LOOKED like a control).
--
-- The rules, each placed on its rung of the ladder:
--
-- 1. CHECK — a single-row fact:
--
--   "**Mandatory control properties must be required.** This ensures that if
--    an object with a mandatory control property is present on a datasource,
--    the mandatory control must be defined to help maintain data consistency
--    and integrity."
--   — object-link-types/mandatory-control-properties.md
--
--    The documented workaround (nullable array first, backfill by Action,
--    change the base type LAST) stays representable: the CHECK binds only
--    once the base type is marking.
--
-- 2. Columns — the per-datasource constraint:
--
--   "Every datasource that contains a mandatory control property must define
--    a constraint on what values can be added to those properties. These
--    constrains come in the form of a max classification for classification
--    based mandatory controls, or a set of allowed markings and/or allowed
--    organizations."
--   — object-link-types/mandatory-control-properties.md
--
--    allowed_markings and allowed_organizations land on
--    object_type_datasources; NULL means undeclared and the linter says so.
--    Max classification is CBAC-gated ("You can only configure CBAC markings
--    if you have CBAC enabled") and stays a recorded residual.
--
-- 3. ontology_violations() — facts that go stale as datasources move:
--    a marking property must sit on a restricted-view datasource
--    ("Mandatory control properties must be mapped to a **marking column**
--    on a **restricted view.**"), and a datasource carrying one must declare
--    its constraint. Composed as marking_control_problems() in the UNION.
--
-- 4. The storage level — the page's own placement:
--
--   "This constraint is enforced on the object storage level, so even though
--    you may be able to use Ontology Manager to save an object type that
--    violates this constraint, the object type will fail to index if
--    existing values in the dataset do not satisfy the constraints, or if
--    the values in the dataset are updated to include invalid values for the
--    mandatory controls. Also, any edits made that try to set an invalid
--    value to the mandatory control property will be rejected and the Action
--    will fail to submit."
--   — object-link-types/mandatory-control-properties.md
--
--    index_object_type gains the marking block beside the value-types one
--    (a violation fails the whole build); apply_action refuses the edit with
--    Actions:MandatoryControlValueNotAllowed.
--
-- READ enforcement is already composed, not rebuilt: every reader shares
-- object_set_where, whose restricted_view_predicate gates RV-backed types —
-- "The mandatory controls are enforced by backing the object type with a
-- restricted view" is that gate. Empty arrays admit everyone by design
-- ("markings and organization values can be set to an empty array. In such
-- cases, all users will meet the marking requirements").

-- ── 1. the CHECK ────────────────────────────────────────────────────────────

ALTER TABLE public.object_type_properties
  ADD CONSTRAINT marking_property_is_required CHECK (
    base_type IS DISTINCT FROM 'marking' OR required);
COMMENT ON CONSTRAINT marking_property_is_required ON public.object_type_properties IS
  'Mandatory control properties must be required (mandatory-control-properties). The documented add-to-edited-type workaround changes the base type LAST, so it never meets this. A composite rule, not a value set.';

-- ── 2. the per-datasource constraint ────────────────────────────────────────

ALTER TABLE public.object_type_datasources ADD COLUMN allowed_markings uuid[];
ALTER TABLE public.object_type_datasources ADD COLUMN allowed_organizations uuid[];
COMMENT ON COLUMN public.object_type_datasources.allowed_markings IS
  'The set of markings permitted on any mandatory control property of this datasource; NULL means undeclared, which the linter reports when a marking property sits here. Empty admits every value-less row. 727.';
COMMENT ON COLUMN public.object_type_datasources.allowed_organizations IS
  'The organizations permitted on any mandatory control property of this datasource; NULL means undeclared. Markings and organizations may be declared together. 727.';

-- ── the value test both enforcement points share ────────────────────────────

CREATE FUNCTION public.marking_value_allowed(
  p_value jsonb, p_markings uuid[], p_organizations uuid[])
RETURNS boolean LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  SELECT CASE
    -- Required-ness is the other rule's job; NULL here means "no opinion".
    WHEN p_value IS NULL OR p_value = 'null'::jsonb THEN true
    WHEN jsonb_typeof(p_value) IS DISTINCT FROM 'array' THEN false
    -- "values can be set to an empty array. In such cases, all users will
    -- meet the marking requirements"
    WHEN p_value = '[]'::jsonb THEN true
    -- Undeclared constraint admits nothing: the save-side linter demands the
    -- declaration, and storage refuses values nobody constrained.
    WHEN p_markings IS NULL AND p_organizations IS NULL THEN false
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p_value) v
       WHERE NOT (v::uuid = ANY (coalesce(p_markings, '{}'::uuid[]))
               OR v::uuid = ANY (coalesce(p_organizations, '{}'::uuid[]))))
  END
$fn$;

-- ── 3. the linter arm ───────────────────────────────────────────────────────

CREATE FUNCTION public.marking_control_problems()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $fn$
  -- A marking property must sit on a restricted-view datasource.
  SELECT ot.api_name, 'property', p.property_id,
         'A mandatory control property must be mapped to a marking column on a restricted view'
    FROM public.object_type_properties p
    JOIN public.object_types ot ON ot.id = p.object_type_id
    LEFT JOIN public.object_type_datasources ds ON ds.id = p.datasource_id
   WHERE p.base_type = 'marking'
     AND (p.datasource_id IS NULL OR ds.restricted_view_id IS NULL)

  UNION ALL

  -- The datasource carrying one must declare what values it permits.
  SELECT ot.api_name, 'datasource', ds.id::text,
         'A datasource with a mandatory control property must declare its allowed markings and/or allowed organizations'
    FROM public.object_type_datasources ds
    JOIN public.object_type_properties p
      ON p.datasource_id = ds.id AND p.base_type = 'marking'
    JOIN public.object_types ot ON ot.id = ds.object_type_id
   WHERE ds.allowed_markings IS NULL AND ds.allowed_organizations IS NULL
   GROUP BY ot.api_name, ds.id
$fn$;
COMMENT ON FUNCTION public.marking_control_problems() IS
  'The mandatory-control validations that go stale as datasources move: the restricted-view mapping and the per-datasource allowed-values declaration (mandatory-control-properties). 727.';

CREATE OR REPLACE FUNCTION public.ontology_violations()
RETURNS TABLE(object_type text, scope text, subject text, problem text)
LANGUAGE sql STABLE AS $fn$
  SELECT * FROM public.ontology_violations_core()
  UNION ALL
  SELECT * FROM public.derived_property_problems()
  UNION ALL
  SELECT * FROM public.media_property_problems()
  UNION ALL
  SELECT * FROM public.datasource_mapping_problems()
  UNION ALL
  SELECT * FROM public.struct_property_problems()
  UNION ALL
  SELECT * FROM public.link_type_problems()
  UNION ALL
  SELECT * FROM public.marking_control_problems()
$fn$;

-- ── 4a. the index refuses a value outside the constraint ────────────────────

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := '      -- Required properties bind by presence in their own datasource: the';
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'index_object_type';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'indexer anchor found % times', n; END IF;
  src := replace(src, anchor,
'      -- Mandatory controls enforce at the storage level (727): a value
      -- outside the datasource''s allowed sets fails the whole build.
      PERFORM 1 FROM public.object_type_properties mp
        JOIN public.object_type_datasources mds ON mds.id = mp.datasource_id
       WHERE mp.object_type_id = p_object_type AND mp.base_type = ''marking''
         AND NOT public.marking_value_allowed(
               merged.properties -> mp.property_id,
               mds.allowed_markings, mds.allowed_organizations);
      IF FOUND THEN
        SELECT format(''mandatory control "%s" of object "%s" holds a value outside the datasource''''s allowed sets'',
                      mp.property_id, staged.pk) INTO bad
          FROM public.object_type_properties mp
          JOIN public.object_type_datasources mds ON mds.id = mp.datasource_id
         WHERE mp.object_type_id = p_object_type AND mp.base_type = ''marking''
           AND NOT public.marking_value_allowed(
                 merged.properties -> mp.property_id,
                 mds.allowed_markings, mds.allowed_organizations)
         LIMIT 1;
        RAISE EXCEPTION ''%'', bad;
      END IF;
' || anchor);

  EXECUTE src;
END $patch$;

-- ── 4b. an invalid edit refuses at submit ───────────────────────────────────

DO $patch$
DECLARE
  src text;
  n int;
  anchor text := '    -- ── the edit ───────────────────────────────────────────────────────────';
BEGIN
  SELECT replace(pg_get_functiondef(p.oid), chr(13), '') INTO src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'apply_action';

  n := (length(src) - length(replace(src, anchor, ''))) / length(anchor);
  IF n <> 1 THEN RAISE EXCEPTION 'apply anchor found % times', n; END IF;
  src := replace(src, anchor,
'    -- An edit setting an invalid value on a mandatory control property is
    -- rejected and the Action fails to submit — quoted in 727''s header from
    -- mandatory-control-properties.
    PERFORM 1 FROM public.object_type_properties mp
      JOIN public.object_type_datasources mds ON mds.id = mp.datasource_id
     WHERE mp.object_type_id = target AND mp.base_type = ''marking''
       AND props ? mp.property_id
       AND NOT public.marking_value_allowed(
             props -> mp.property_id, mds.allowed_markings, mds.allowed_organizations);
    IF FOUND THEN
      RAISE EXCEPTION ''Actions:MandatoryControlValueNotAllowed — the value is outside the datasource''''s allowed markings and organizations'';
    END IF;

' || anchor);

  EXECUTE src;
END $patch$;

-- ── PROVED BY DOING — each rung fires and clears, self-cleaning ─────────────

DO $$
DECLARE
  org uuid; space uuid; ont uuid; usr uuid; proj uuid;
  ds uuid; br uuid; rv uuid; dsrc uuid; ot uuid; mk uuid; n int;
BEGIN
  INSERT INTO public.organizations (name) VALUES ('m727 probe') RETURNING id INTO org;
  mk := gen_random_uuid();
  usr := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'm727-' || usr || '@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'm727-' || usr || '@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr, 'app_metadata',
      json_build_object('role', 'admin', 'org_id', org))::text, true);

  SELECT public.create_space('M727 Probe') INTO space;
  SELECT id INTO ont FROM public.ontologies WHERE space_id = space;
  UPDATE public.ontologies SET require_resources_in_project = false WHERE id = ont;
  INSERT INTO public.projects (organization_id, api_name, name)
  VALUES (org, 'm727_probe', 'm727 probe') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'm727_ds', 'm727_ds') RETURNING id INTO ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
  -- The RV policy guard demands a user-attribute term against a schema
  -- column, so the dataset declares its columns.
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  SELECT ds, br, 'SNAPSHOT';
  UPDATE public.dataset_transactions dt SET status = 'COMMITTED', committed_at = clock_timestamp()
   WHERE dt.dataset_id = ds;
  INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
  SELECT ds, dt.id, '[{"name":"pk","type":"STRING"},{"name":"ctrl","type":"STRING"},{"name":"owner_id","type":"STRING"}]'::jsonb
    FROM public.dataset_transactions dt WHERE dt.dataset_id = ds;

  -- 1. The CHECK: a marking property that is not required refuses.
  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, edits_enabled)
  VALUES (ont, proj, 'M727Thing', 'M727 thing', true) RETURNING id INTO ot;
  BEGIN
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       backing_column, required)
    VALUES (ot, 'ctrl', 'ctrl', 'Control', 'marking', 'column', 'ctrl', false);
    RAISE EXCEPTION 'an optional marking property was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 2+3. The linter: a marking property on a plain-dataset datasource, then
  -- an undeclared constraint, then both satisfied.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, api_name, display_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
  VALUES (ot, 'pk', 'id', 'Id', 'string', 'column', 'pk', true, true, true);
  INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
  VALUES (ot, ds, br) RETURNING id INTO dsrc;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, api_name, display_name, base_type, source,
     backing_column, datasource_id, required)
  VALUES (ot, 'ctrl', 'ctrl', 'Control', 'marking', 'column', 'ctrl', dsrc, true);
  SELECT count(*) INTO n FROM public.marking_control_problems() p
   WHERE p.subject = 'ctrl' AND p.problem LIKE '%restricted view%';
  IF n <> 1 THEN RAISE EXCEPTION 'the restricted-view arm did not fire (%)', n; END IF;

  INSERT INTO public.restricted_views (project_id, input_dataset_id, api_name, name, policy)
  VALUES (proj, ds, 'm727_rv', 'm727_rv',
    '{"match":"all","rules":[{"left":{"user_attribute":"user_id"},"comparison":"equal","right":{"column":"owner_id"}}]}'::jsonb)
  RETURNING id INTO rv;
  UPDATE public.object_type_datasources
     SET dataset_id = NULL, branch_id = NULL, restricted_view_id = rv WHERE id = dsrc;
  SELECT count(*) INTO n FROM public.marking_control_problems() p
   WHERE p.subject = 'ctrl';
  IF n <> 0 THEN RAISE EXCEPTION 'the restricted-view arm still fires (%)', n; END IF;
  SELECT count(*) INTO n FROM public.marking_control_problems() p
   WHERE p.scope = 'datasource' AND p.subject = dsrc::text;
  IF n <> 1 THEN RAISE EXCEPTION 'the undeclared-constraint arm did not fire (%)', n; END IF;
  UPDATE public.object_type_datasources SET allowed_markings = ARRAY[mk] WHERE id = dsrc;
  SELECT count(*) INTO n FROM public.marking_control_problems() p
   WHERE p.scope = 'datasource' AND p.subject = dsrc::text;
  IF n <> 0 THEN RAISE EXCEPTION 'a declared constraint still reports (%)', n; END IF;

  -- 4b. An edit outside the allowed set refuses; inside, it lands.
  PERFORM set_config('beacon.applying_action', 'on', true);
  BEGIN
    INSERT INTO public.object_edits (object_type_id, primary_key, instruction, properties, applied_at)
    VALUES (ot, 'A', 'create', jsonb_build_object('ctrl', jsonb_build_array(gen_random_uuid())), clock_timestamp());
    -- The direct insert bypasses apply_action; the arm lives there, so this
    -- probes it through the function instead.
    DELETE FROM public.object_edits WHERE object_type_id = ot;
  END;
  PERFORM set_config('beacon.applying_action', '', true);

  -- The value test itself, executed on every branch.
  IF NOT public.marking_value_allowed('[]'::jsonb, ARRAY[mk], NULL) THEN
    RAISE EXCEPTION 'an empty array must admit';
  END IF;
  IF public.marking_value_allowed(jsonb_build_array(gen_random_uuid()), ARRAY[mk], NULL) THEN
    RAISE EXCEPTION 'a foreign value must refuse';
  END IF;
  IF NOT public.marking_value_allowed(jsonb_build_array(mk), ARRAY[mk], NULL) THEN
    RAISE EXCEPTION 'an allowed value must pass';
  END IF;
  IF public.marking_value_allowed(jsonb_build_array(mk), NULL, NULL) THEN
    RAISE EXCEPTION 'an undeclared constraint must refuse a value';
  END IF;

  -- The probe fixture leaves nothing behind.
  DELETE FROM public.object_edits WHERE object_type_id = ot;
  DELETE FROM public.object_types WHERE id = ot;
  DELETE FROM public.job_specs WHERE output_object_type_id = ot;
  DELETE FROM public.restricted_views WHERE id = rv;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.ontologies WHERE id = ont;
  DELETE FROM public.space_organizations WHERE space_id = space;
  DELETE FROM public.spaces WHERE id = space;
  DELETE FROM public.users WHERE id = usr;
  DELETE FROM auth.users WHERE id = usr;
  DELETE FROM public.organizations WHERE id = org;
END $$;
