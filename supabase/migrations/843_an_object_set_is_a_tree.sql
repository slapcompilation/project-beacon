-- An object set is a tree, not a row.
--
-- Shape audit round 1 (#1030) put `object_sets` first: the highest-cost wrong
-- encoding, and the only one free to correct today. The reading and its attack
-- are docs/foundry-reference/readings/object-set-definition.md, approved
-- 2026-09-23 after six adversaries refuted five of its ten Decisions.
--
--   "Represents the definition of an `ObjectSet` in the `Ontology`."
--   — api/v2-ontologies-v2-resources-ontology-object-sets-load-object-set.md
--
-- That sentence appears eleven times on one page, once under every member that
-- carries a nested set. The union has FIFTEEN members and TEN of them are
-- recursive — counted by parsing the page's own indentation, twice. Ours was a
-- flat row: a subject type, a filter array and a traversal chain, with no column
-- anywhere that could hold another object set. So `union`, `intersect`,
-- `subtract` and filter-of-filter had no encoding at all.
--
-- WHAT THIS IS NOT. It is not a rewrite of the table. The reading's first
-- Decision survived its attack on better evidence than it was written with:
--
--   "Object sets are lists of real-world entities that are saved for future reference and use across Foundry applications that support objects. Object sets are saved as resources for easy sharing with collaborators."
--   — object-backend/overview.md
--
-- A saved object set is a RESOURCE. The api publishes no create, get, list or
-- update for one — only `createTemporary`, the three loads and `aggregate` — and
-- the union reaches a saved set through its `reference` member. So `id`, `name`,
-- `rid`, `project_id` and `set_kind` all stay exactly as they are. What changes
-- is what the DEFINITION half of the row holds.
--
-- THE FILTER PAYLOAD STAYS OURS, AND THAT IS A DECLARED DIVERGENCE. The api's
-- `filter` member carries `where · union · required`, 27 members including the
-- boolean combinators `and`, `or` and `not`. We carry the Object Explorer's
-- grammar instead, and that is deliberate: the Explorer's vocabulary
-- (`propertyFilter`, `linkFilter`, `presenceFilter`, the seven value kinds)
-- appears in exactly ONE page of the mirror, `object-explorer/generate-urls.md`,
-- and 475 cited it before building it. Neither grammar contains the other —
-- ours expresses link presence, for which `where` has no member at all, and
-- `where` expresses or/not, geometry and intervals, for which ours has none.
--
-- THE DIVERGENCE IS BOUNDED, because CLAUDE.md requires that of any divergence:
-- it holds only while nothing here serves the api's `loadObjectSet`. The day
-- something does, the `where` translation becomes required, and it is not total
-- in either direction — so that day needs its own reading rather than a
-- coercion.
--
-- A SHAPE MUST BE COMPLETE; AN ENGINE MAY BE PARTIAL. All fifteen members are
-- representable from this migration. Six EVALUATE — `base`, `static`, `filter`,
-- `union`, `intersect`, `subtract`. The other nine are refused BY NAME, so an
-- unbuilt member says which member it is rather than returning something wrong.
-- `methodInput` carries no fields at all, which is 835's `editsOnly` shape: a
-- member with no pointer cannot be encoded by which pointer is set, so it is a
-- named member of the discriminator that always refuses.
--
-- NULL MEANS THE DEGENERATE CASE, and that is the whole reason nothing breaks.
-- A row with no stored definition IS `filter(base(subject_type_id), filters)`.
-- The existing columns keep their meaning, all fourteen consumers keep working,
-- and `subject_type_id` keeps meaning the ROOT type — the reading's fourth
-- Decision was refuted precisely because redefining it as the RESULT type would
-- have moved a column every one of them reads.
--
-- AND TWO DEFECTS THE READING FOUND GO WITH IT, because the shape change
-- rewrites their callers anyway. Neither can fire today only because
-- `object_sets` holds zero rows.
--
-- EVERY PATCH BELOW NORMALISES LINE ENDINGS FIRST, and that is the only thing
-- that moves besides the edits themselves. `pg_get_functiondef` output is not
-- uniformly newline-delimited in this database — `object_set_rows` comes back
-- CRLF — so an anchor spanning a line ending silently matches nothing while the
-- patch reports success. 833 paid for that once; the first dry run of this
-- migration hit it again and was caught only because every replace here asserts
-- it changed something.

-- ── the vocabulary ─────────────────────────────────────────────────────────
-- The fifteen members, as a set a CHECK can reference — the shape
-- `property_base_types()` established for a vocabulary that must be quotable.
CREATE OR REPLACE FUNCTION public.object_set_definition_members()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'base', 'interfaceBase', 'static', 'reference', 'methodInput',
    'filter', 'searchAround', 'interfaceLinkSearchAround', 'withProperties',
    'nearestNeighbors', 'asType', 'asBaseObjectTypes',
    'union', 'intersect', 'subtract']
$$;

COMMENT ON FUNCTION public.object_set_definition_members() IS
  'The fifteen members of the published ObjectSet union, in api order (api/v2-ontologies-v2-resources-ontology-object-sets-load-object-set). Ten of them carry a nested object set.';

-- ── the validator ──────────────────────────────────────────────────────────
-- Recursive, IMMUTABLE, and called from a CHECK — proved possible before it was
-- designed: a recursive plpgsql validator behind a CHECK accepts a forty-deep
-- chain and refuses an unknown member at depth. That puts the invariant — every
-- child of a union is itself a valid object set — on the LOWEST rung of the
-- ladder, which is what CLAUDE.md asks. A table of nodes would have to push the
-- same invariant up to a trigger, because no per-row foreign key expresses it.
CREATE OR REPLACE FUNCTION public.object_set_definition_valid(p jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE k text; body jsonb; child jsonb;
BEGIN
  -- NULL is the degenerate case, not a malformed one.
  IF p IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(p) <> 'object' THEN RETURN false; END IF;
  -- A discriminated union carries exactly one member.
  IF (SELECT count(*) FROM jsonb_object_keys(p)) <> 1 THEN RETURN false; END IF;
  SELECT key INTO k FROM jsonb_object_keys(p) key LIMIT 1;
  IF NOT (k = ANY (public.object_set_definition_members())) THEN RETURN false; END IF;
  body := p -> k;
  IF jsonb_typeof(body) <> 'object' THEN RETURN false; END IF;

  -- The five leaves.
  IF k = 'base' THEN
    RETURN coalesce(body->>'objectType', '') <> '';
  ELSIF k = 'interfaceBase' THEN
    RETURN coalesce(body->>'interfaceType', '') <> '';
  ELSIF k = 'static' THEN
    RETURN jsonb_typeof(body->'objects') = 'array';
  ELSIF k = 'reference' THEN
    RETURN coalesce(body->>'reference', '') <> '';
  ELSIF k = 'methodInput' THEN
    -- "ObjectSet which is the root of a MethodObjectSet definition." No fields
    -- at all, so there is nothing to require.
    RETURN true;
  END IF;

  -- The three n-ary combinators. `subtract`'s list order is load-bearing, so
  -- the array is kept as written and never normalised.
  IF k IN ('union', 'intersect', 'subtract') THEN
    IF jsonb_typeof(body->'objectSets') <> 'array' THEN RETURN false; END IF;
    FOR child IN SELECT * FROM jsonb_array_elements(body->'objectSets') LOOP
      IF NOT public.object_set_definition_valid(child) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;

  -- The seven that carry one nested set, each with its own required companion.
  IF NOT public.object_set_definition_valid(body->'objectSet') THEN RETURN false; END IF;
  IF body->'objectSet' IS NULL THEN RETURN false; END IF;
  IF k = 'filter' THEN
    -- Ours, not the api's `where` — see the header, and the bound on it.
    RETURN public.object_set_filters_valid(coalesce(body->'where', '[]'::jsonb));
  ELSIF k = 'searchAround' THEN
    RETURN coalesce(body->>'link', '') <> '';
  ELSIF k = 'interfaceLinkSearchAround' THEN
    RETURN coalesce(body->>'interfaceLink', '') <> '';
  ELSIF k = 'asType' THEN
    RETURN coalesce(body->>'entityType', '') <> '';
  ELSIF k = 'nearestNeighbors' THEN
    RETURN body ? 'propertyIdentifier' AND body ? 'numNeighbors' AND body ? 'query';
  END IF;
  -- withProperties and asBaseObjectTypes require only the nested set.
  RETURN true;
END $fn$;

COMMENT ON FUNCTION public.object_set_definition_valid(jsonb) IS
  'Whether a jsonb document is a well-formed ObjectSet definition — exactly one published member, its required fields present, and every nested set valid to any depth. NULL is the degenerate case and is valid.';

GRANT EXECUTE ON FUNCTION public.object_set_definition_members() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.object_set_definition_valid(jsonb) TO authenticated, service_role;

-- ── the column ─────────────────────────────────────────────────────────────
ALTER TABLE public.object_sets
  ADD COLUMN definition jsonb,
  ADD CONSTRAINT object_sets_definition_valid CHECK (public.object_set_definition_valid(definition));

COMMENT ON COLUMN public.object_sets.definition IS
  'The set''s definition as the published ObjectSet union (api/v2-ontologies-v2-resources-ontology-object-sets-load-object-set). NULL means the degenerate un-composed case: filter(base(subject_type_id), filters). The filter arm carries the Object Explorer''s grammar rather than the api''s `where`, a divergence declared in 843 and bounded to the day something serves loadObjectSet.';

COMMENT ON CONSTRAINT object_sets_definition_valid ON public.object_sets IS
  'Values from api/v2-ontologies-v2-resources-ontology-object-sets-load-object-set. The fifteen members of the ObjectSet union, ten of them recursive.';

-- The 3-hop cap was written up as ours and is Foundry's. Recorded on the
-- function so the next reader does not repeat the mistake.
COMMENT ON FUNCTION public.object_set_traversals_valid(jsonb) IS
  'The Search Around chain. The three-hop cap is PUBLISHED, not ours: "Object sets loaded into memory `.all()` or `.allAsync()` are allowed to have a maximum of 3 search arounds" (functions/api-object-sets). A 2026-09-22 reading called it an invention; that was wrong and is corrected here.';

-- ── resolving a definition ─────────────────────────────────────────────────
-- The degenerate case lives in ONE place. A NULL definition is not missing data
-- and is never backfilled — it is read as the tree it stands for.
CREATE OR REPLACE FUNCTION public.object_set_definition(p_set uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(
    s.definition,
    jsonb_build_object('filter', jsonb_build_object(
      'objectSet', jsonb_build_object('base', jsonb_build_object('objectType', s.subject_type_id)),
      'where', coalesce(s.filters, '[]'::jsonb))))
    FROM public.object_sets s WHERE s.id = p_set
$$;

GRANT EXECUTE ON FUNCTION public.object_set_definition(uuid) TO authenticated, service_role;

-- The single object type a definition resolves to, or NULL when it resolves to
-- none or to several. Several is a real published case — it is why a separate
-- Load Object Set Multiple Object Types endpoint exists — and this platform
-- indexes per type, so a mixed set is refused rather than guessed at.
CREATE OR REPLACE FUNCTION public.object_set_definition_type(p_def jsonb)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE k text; body jsonb; child jsonb; t uuid; seen uuid;
BEGIN
  IF p_def IS NULL OR jsonb_typeof(p_def) <> 'object' THEN RETURN NULL; END IF;
  SELECT key INTO k FROM jsonb_object_keys(p_def) key LIMIT 1;
  body := p_def -> k;
  IF k = 'base' THEN RETURN (body->>'objectType')::uuid; END IF;
  IF k IN ('union', 'intersect', 'subtract') THEN
    FOR child IN SELECT * FROM jsonb_array_elements(body->'objectSets') LOOP
      t := public.object_set_definition_type(child);
      IF t IS NULL THEN RETURN NULL; END IF;
      IF seen IS NULL THEN seen := t; ELSIF seen <> t THEN RETURN NULL; END IF;
    END LOOP;
    RETURN seen;
  END IF;
  IF body ? 'objectSet' THEN RETURN public.object_set_definition_type(body->'objectSet'); END IF;
  RETURN NULL;
END $fn$;

GRANT EXECUTE ON FUNCTION public.object_set_definition_type(jsonb) TO authenticated, service_role;

-- ── the evaluator ──────────────────────────────────────────────────────────
-- Keys, not rows: composition is a set operation and our index is keyed by
-- primary key, so the tree is folded to a key set and the rows are fetched once
-- at the end. Six members evaluate; the other nine name themselves and refuse.
CREATE OR REPLACE FUNCTION public.object_set_definition_keys(p_def jsonb, p_limit integer DEFAULT 100000)
RETURNS TABLE(primary_key text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  k text; body jsonb; child jsonb; v_type uuid; pk text; i int := 0; r jsonb;
  acc text[]; cur text[];
BEGIN
  IF p_def IS NULL OR jsonb_typeof(p_def) <> 'object' THEN RETURN; END IF;
  SELECT key INTO k FROM jsonb_object_keys(p_def) key LIMIT 1;
  body := p_def -> k;

  IF k = 'static' THEN
    -- "objects · list of ObjectRid". We key objects by primary key, not by RID
    -- — object_set_members has done so since it was built — so a static set is
    -- a list of primary keys here, and the reading records the divergence.
    RETURN QUERY SELECT x FROM jsonb_array_elements_text(body->'objects') x;
    RETURN;
  END IF;

  IF k = 'base' THEN
    v_type := (body->>'objectType')::uuid;
    SELECT p.property_id INTO pk FROM public.object_type_properties p
     WHERE p.object_type_id = v_type AND p.is_primary_key;
    IF pk IS NULL THEN
      RAISE EXCEPTION 'Ontology:ObjectSetSubjectHasNoKey — % has no primary key property', v_type;
    END IF;
    FOR r IN SELECT e FROM public.evaluate_object_set(v_type, '[]'::jsonb, '[]'::jsonb, p_limit, 0) e LOOP
      primary_key := r ->> pk;
      RETURN NEXT;
    END LOOP;
    RETURN;
  END IF;

  IF k = 'filter' THEN
    v_type := public.object_set_definition_type(p_def);
    IF v_type IS NULL THEN
      RAISE EXCEPTION 'Ontology:ObjectSetNotSingleType — a filter over a set of several object types is not served here'
        USING HINT = 'Load Object Set Multiple Object Types is the published endpoint for that, and it is unbuilt.';
    END IF;
    -- A filter whose child is anything but a base set would need the child's
    -- keys pushed into the predicate; only the degenerate child is served.
    IF NOT (body->'objectSet') ? 'base' THEN
      RAISE EXCEPTION 'Ontology:ObjectSetMemberUnsupported — filter over a composed set is not evaluated here'
        USING HINT = 'Filter the base sets first, then compose them.';
    END IF;
    SELECT p.property_id INTO pk FROM public.object_type_properties p
     WHERE p.object_type_id = v_type AND p.is_primary_key;
    FOR r IN SELECT e FROM public.evaluate_object_set(
               v_type, coalesce(body->'where', '[]'::jsonb), '[]'::jsonb, p_limit, 0) e LOOP
      primary_key := r ->> pk;
      RETURN NEXT;
    END LOOP;
    RETURN;
  END IF;

  IF k IN ('union', 'intersect', 'subtract') THEN
    -- An array accumulator, not a temp table: this function is STABLE so that
    -- a reader can call it, and CREATE TEMP TABLE is not allowed in a
    -- non-volatile function. Found by running it.
    FOR child IN SELECT * FROM jsonb_array_elements(body->'objectSets') LOOP
      SELECT coalesce(array_agg(DISTINCT d.primary_key), '{}')
        INTO cur FROM public.object_set_definition_keys(child, p_limit) d;
      i := i + 1;
      IF i = 1 THEN
        acc := cur;
      ELSIF k = 'union' THEN
        SELECT coalesce(array_agg(DISTINCT x), '{}') INTO acc FROM unnest(acc || cur) x;
      ELSIF k = 'intersect' THEN
        SELECT coalesce(array_agg(x), '{}') INTO acc FROM unnest(acc) x WHERE x = ANY (cur);
      ELSE
        -- "subtract" removes every later operand from the first, so the list
        -- order is load-bearing and the array is walked as written.
        SELECT coalesce(array_agg(x), '{}') INTO acc FROM unnest(acc) x WHERE NOT (x = ANY (cur));
      END IF;
    END LOOP;
    RETURN QUERY SELECT x FROM unnest(coalesce(acc, '{}'::text[])) x;
    RETURN;
  END IF;

  -- The nine that are representable and not yet evaluated. Named, so a caller
  -- learns which member it asked for rather than receiving a wrong answer.
  RAISE EXCEPTION 'Ontology:ObjectSetMemberUnsupported — the "%" member of an object set definition is representable but not yet evaluated', k
    USING HINT = 'A shape must be complete; an engine may be partial. See migration 843.';
END $fn$;

COMMENT ON FUNCTION public.object_set_definition_keys(jsonb, integer) IS
  'Folds an ObjectSet definition to the primary keys it denotes. Evaluates base, static, filter, union, intersect and subtract; the other nine published members raise Ontology:ObjectSetMemberUnsupported naming themselves.';

-- ── the readers ────────────────────────────────────────────────────────────
-- Patched from the live definitions, never retyped.
DO $patch$
DECLARE src text; out text;
BEGIN
  -- 1. object_set_keys indexed the emitted row by api_name where the engine
  --    emits property_id, so it returned an empty array SILENTLY into the
  --    Automate condition path. object_set_rows, four lines away, already used
  --    property_id — which is how the reading identified which one was wrong.
  SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'object_set_keys';
  src := replace(src, E'\r\n', E'\n');
  out := replace(src, 'SELECT p.api_name FROM public.object_type_properties p',
                      'SELECT p.property_id FROM public.object_type_properties p');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: object_set_keys did not match'; END IF;
  EXECUTE out;

  -- 2. evaluate_object_set_by_rid never asked set_kind, so a saved LIST was
  --    re-evaluated as a filter instead of being served from its membership.
  --    object_set_rows already branches correctly, so this delegates rather
  --    than growing a second copy of the rule.
  SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'evaluate_object_set_by_rid';
  src := replace(src, E'\r\n', E'\n');
  out := replace(src,
$old$  RETURN QUERY
    SELECT * FROM public.evaluate_object_set(
      s.subject_type_id, coalesce(s.filters, '[]'::jsonb), NULL,
      greatest(coalesce(p_limit, 100), 1), 0, NULL);
$old$,
$new$  -- A list is served from its membership and an exploration is re-evaluated.
  -- object_set_rows holds that rule; this asks it rather than restating it.
  RETURN QUERY SELECT * FROM public.object_set_rows(s.id, greatest(coalesce(p_limit, 100), 1), 0);
$new$);
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: evaluate_object_set_by_rid did not match'; END IF;
  EXECUTE out;

  -- 3. object_set_rows serves a stored definition when there is one, and is
  --    untouched otherwise — which is what makes NULL the degenerate case
  --    rather than a migration of every row.
  SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'object_set_rows';
  src := replace(src, E'\r\n', E'\n');
  out := replace(src,
$old$  IF s.set_kind = 'exploration' THEN
$old$,
$new$  -- A composed set folds its tree to keys, then fetches those rows once.
  IF s.definition IS NOT NULL THEN
    SELECT p.property_id INTO pk FROM public.object_type_properties p
     WHERE p.object_type_id = public.object_set_definition_type(s.definition) AND p.is_primary_key;
    IF pk IS NULL THEN
      RAISE EXCEPTION 'Ontology:ObjectSetNotSingleType — this definition does not resolve to one object type';
    END IF;
    SELECT jsonb_build_array(jsonb_build_object(
      'type', 'propertyFilter', 'propertyType', pk,
      'value', jsonb_build_object('type', 'valuesFilter',
        'values', coalesce(jsonb_agg(d.primary_key), '[]'::jsonb))))
      INTO member_filter
      FROM public.object_set_definition_keys(s.definition, 100000) d;
    RETURN QUERY SELECT * FROM public.evaluate_object_set(
      public.object_set_definition_type(s.definition), member_filter, '[]'::jsonb, p_limit, p_offset);
    RETURN;
  END IF;

  IF s.set_kind = 'exploration' THEN
$new$);
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: object_set_rows did not match'; END IF;
  EXECUTE out;
END $patch$;

-- ── the writer ─────────────────────────────────────────────────────────────
-- save_object_set accepts a definition. It stays optional: an exploration saved
-- from the Explorer has filters and no composition, which is the degenerate row.
DO $patch$
DECLARE src text; out text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'save_object_set';
  src := replace(src, E'\r\n', E'\n');

  out := replace(src,
    '    (ontology_id, project_id, name, api_name, description, subject_type_id, filters, set_kind)',
    '    (ontology_id, project_id, name, api_name, description, subject_type_id, filters, set_kind, definition)');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the insert column list did not match'; END IF;
  src := out;

  out := replace(src,
    '    v_type, v_filters, v_kind)',
    '    v_type, v_filters, v_kind, p_set->''definition'')');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: the insert values did not match'; END IF;
  EXECUTE out;
END $patch$;

-- PROVED BY DOING. The validator is asked of every member; the evaluator is
-- asked of a real indexed object type; the refusals are asked by name; and the
-- two defects are asked in the form that used to fail.
DO $proof$
DECLARE
  v_org uuid; v_space uuid; v_proj uuid; v_ds uuid; v_branch uuid; v_phys text;
  v_ont uuid; v_type uuid; v_otds uuid; v_user uuid; v_txn uuid; v_file uuid;
  v_build uuid; v_state text; v_err text; v_set uuid; v_n int; v_keys text[];
  v_def jsonb; v_unwound boolean := false; v_ok boolean;
BEGIN
  -- 1. The validator, before any fixture exists.
  IF array_length(public.object_set_definition_members(), 1) <> 15 THEN
    RAISE EXCEPTION 'PROOF FAILED: the union does not have fifteen members';
  END IF;
  IF NOT public.object_set_definition_valid(NULL) THEN
    RAISE EXCEPTION 'PROOF FAILED: NULL is the degenerate case and must be valid';
  END IF;
  IF NOT public.object_set_definition_valid('{"base":{"objectType":"x"}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: base rejected';
  END IF;
  IF public.object_set_definition_valid('{"base":{}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: base without objectType accepted';
  END IF;
  IF public.object_set_definition_valid('{"nope":{}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: an unpublished member accepted';
  END IF;
  IF public.object_set_definition_valid('{"base":{"objectType":"x"},"static":{"objects":[]}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: two members at once accepted';
  END IF;
  IF NOT public.object_set_definition_valid('{"methodInput":{}}') THEN
    RAISE EXCEPTION 'PROOF FAILED: methodInput has no fields and must be representable';
  END IF;
  -- Nesting, to a depth no row will ever carry.
  v_def := '{"base":{"objectType":"x"}}'::jsonb;
  FOR v_n IN 1..25 LOOP
    v_def := jsonb_build_object('union', jsonb_build_object('objectSets',
               jsonb_build_array(v_def, '{"base":{"objectType":"y"}}'::jsonb)));
  END LOOP;
  IF NOT public.object_set_definition_valid(v_def) THEN
    RAISE EXCEPTION 'PROOF FAILED: a 25-deep union rejected';
  END IF;
  -- And a bad member buried at the bottom is still caught.
  v_def := '{"union":{"objectSets":[{"base":{"objectType":"x"}},{"filter":{"objectSet":{"nope":{}},"where":[]}}]}}';
  IF public.object_set_definition_valid(v_def) THEN
    RAISE EXCEPTION 'PROOF FAILED: an invalid grandchild accepted';
  END IF;
  RAISE NOTICE 'PROVED: the validator admits fifteen members, refuses the rest, and recurses';

  BEGIN
    -- 2. A real indexed object type, so the evaluator is asked of real rows.
    INSERT INTO public.organizations (name) VALUES ('zz843') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('zz843') RETURNING id INTO v_space;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_space, v_org);
    INSERT INTO public.projects (organization_id, api_name, name)
      VALUES (v_org, 'zz843', 'zz843') RETURNING id INTO v_proj;
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'zz843_ds', 'zz843_ds') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (v_ds, 'master') RETURNING id INTO v_branch;

    v_user := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz843@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_user, 'zz843@beacon.test', 'admin', v_org);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_user, 'owner', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_user, 'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
      VALUES (v_ds, v_branch, 'SNAPSHOT') RETURNING id INTO v_txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (v_ds, v_txn, '[{"name":"pk","type":"STRING"},{"name":"city","type":"STRING"}]'::jsonb);
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (v_ds, v_txn, 'rows.parquet', 4) RETURNING id INTO v_file;
    UPDATE public.dataset_transactions SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = v_txn;
    SELECT public.dataset_materialize(v_ds, v_txn) INTO v_phys;
    EXECUTE format('INSERT INTO datasets.%I (_file, pk, city) VALUES ($1,''A'',''ATH''),($1,''B'',''SKG''),($1,''C'',''ATH''),($1,''D'',''LAR'')', v_phys)
      USING v_file;

    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
      VALUES (v_space, 'zz843', 'Zz843', false) RETURNING id INTO v_ont;
    INSERT INTO public.object_types (ontology_id, project_id, api_name, label)
      VALUES (v_ont, v_proj, 'Zz843Thing', 'Zz843 thing') RETURNING id INTO v_type;
    INSERT INTO public.object_type_datasources (object_type_id, dataset_id, branch_id)
      VALUES (v_type, v_ds, v_branch) RETURNING id INTO v_otds;
    INSERT INTO public.object_type_properties
      (object_type_id, property_id, api_name, display_name, base_type, source,
       backing_column, is_primary_key, is_title_key, required, datasource_id)
    VALUES (v_type, 'pk', 'id', 'Id', 'string', 'column', 'pk', true, true, true, null),
           (v_type, 'city', 'city', 'City', 'string', 'column', 'city', false, false, false, v_otds);

    SELECT public.run_index_build(ARRAY[v_type], true) INTO v_build;
    SELECT state, error INTO v_state, v_err FROM public.build_jobs WHERE build_id = v_build;
    IF v_state <> 'COMPLETED' THEN RAISE EXCEPTION 'PROOF CANNOT RUN: index build % — %', v_state, v_err; END IF;

    -- 3. base returns every key.
    SELECT array_agg(d.primary_key ORDER BY d.primary_key) INTO v_keys
      FROM public.object_set_definition_keys(
             jsonb_build_object('base', jsonb_build_object('objectType', v_type))) d;
    IF v_keys <> ARRAY['A','B','C','D'] THEN
      RAISE EXCEPTION 'PROOF FAILED: base returned %', v_keys;
    END IF;

    -- 4. filter applies our grammar to it.
    SELECT array_agg(d.primary_key ORDER BY d.primary_key) INTO v_keys
      FROM public.object_set_definition_keys(jsonb_build_object('filter', jsonb_build_object(
             'objectSet', jsonb_build_object('base', jsonb_build_object('objectType', v_type)),
             'where', '[{"type":"propertyFilter","propertyType":"city","value":{"type":"valuesFilter","values":["ATH"]}}]'::jsonb))) d;
    IF v_keys <> ARRAY['A','C'] THEN RAISE EXCEPTION 'PROOF FAILED: filter returned %', v_keys; END IF;
    RAISE NOTICE 'PROVED: base and filter evaluate against a real index';

    -- 5. The three combinators, which had no encoding at all before this.
    SELECT array_agg(d.primary_key ORDER BY d.primary_key) INTO v_keys
      FROM public.object_set_definition_keys(jsonb_build_object('union', jsonb_build_object('objectSets',
             jsonb_build_array(
               '{"static":{"objects":["A","B"]}}'::jsonb,
               '{"static":{"objects":["B","C"]}}'::jsonb)))) d;
    IF v_keys <> ARRAY['A','B','C'] THEN RAISE EXCEPTION 'PROOF FAILED: union returned %', v_keys; END IF;

    SELECT array_agg(d.primary_key ORDER BY d.primary_key) INTO v_keys
      FROM public.object_set_definition_keys(jsonb_build_object('intersect', jsonb_build_object('objectSets',
             jsonb_build_array(
               '{"static":{"objects":["A","B","C"]}}'::jsonb,
               '{"static":{"objects":["B","C","D"]}}'::jsonb)))) d;
    IF v_keys <> ARRAY['B','C'] THEN RAISE EXCEPTION 'PROOF FAILED: intersect returned %', v_keys; END IF;

    SELECT array_agg(d.primary_key ORDER BY d.primary_key) INTO v_keys
      FROM public.object_set_definition_keys(jsonb_build_object('subtract', jsonb_build_object('objectSets',
             jsonb_build_array(
               '{"static":{"objects":["A","B","C"]}}'::jsonb,
               '{"static":{"objects":["B"]}}'::jsonb)))) d;
    IF v_keys <> ARRAY['A','C'] THEN RAISE EXCEPTION 'PROOF FAILED: subtract returned %', v_keys; END IF;
    RAISE NOTICE 'PROVED: union, intersect and subtract compose — the thing that had no encoding at all';

    -- 6. And composition over real base sets, not just static ones.
    SELECT array_agg(d.primary_key ORDER BY d.primary_key) INTO v_keys
      FROM public.object_set_definition_keys(jsonb_build_object('subtract', jsonb_build_object('objectSets',
             jsonb_build_array(
               jsonb_build_object('base', jsonb_build_object('objectType', v_type)),
               jsonb_build_object('filter', jsonb_build_object(
                 'objectSet', jsonb_build_object('base', jsonb_build_object('objectType', v_type)),
                 'where', '[{"type":"propertyFilter","propertyType":"city","value":{"type":"valuesFilter","values":["ATH"]}}]'::jsonb)))))) d;
    IF v_keys <> ARRAY['B','D'] THEN
      RAISE EXCEPTION 'PROOF FAILED: everything except the ATH objects returned %', v_keys;
    END IF;
    RAISE NOTICE 'PROVED: a subtract of a filter of a base — three levels, real rows';

    -- 7. The nine unbuilt members refuse BY NAME.
    v_ok := false;
    BEGIN
      PERFORM * FROM public.object_set_definition_keys(
        jsonb_build_object('asBaseObjectTypes', jsonb_build_object(
          'objectSet', jsonb_build_object('base', jsonb_build_object('objectType', v_type)))));
    EXCEPTION WHEN others THEN
      IF SQLERRM NOT LIKE '%asBaseObjectTypes%' THEN
        RAISE EXCEPTION 'PROOF FAILED: the refusal does not name the member — %', SQLERRM;
      END IF;
      v_ok := true;
    END;
    IF NOT v_ok THEN RAISE EXCEPTION 'PROOF FAILED: an unbuilt member did not refuse'; END IF;
    RAISE NOTICE 'PROVED: an unbuilt member refuses and says which member it is';

    -- 8. A saved set round-trips through the writer and the reader, and the
    --    degenerate NULL definition still resolves to the tree it stands for.
    SELECT public.save_object_set(jsonb_build_object(
      'name', 'Zz843 athens', 'project_id', v_proj, 'subject_type_id', v_type,
      'filters', '[{"type":"propertyFilter","propertyType":"city","value":{"type":"valuesFilter","values":["ATH"]}}]'::jsonb))
      INTO v_set;
    SELECT count(*) INTO v_n FROM public.object_set_rows(v_set, 100, 0);
    IF v_n <> 2 THEN RAISE EXCEPTION 'PROOF FAILED: the degenerate set returned % rows', v_n; END IF;
    IF NOT (public.object_set_definition(v_set) -> 'filter' -> 'objectSet') ? 'base' THEN
      RAISE EXCEPTION 'PROOF FAILED: a NULL definition does not resolve to filter(base(...))';
    END IF;
    RAISE NOTICE 'PROVED: a NULL definition is the degenerate tree, and its rows are unchanged';

    -- 9. And a COMPOSED saved set, which nothing could store before.
    SELECT public.save_object_set(jsonb_build_object(
      'name', 'Zz843 not athens', 'project_id', v_proj, 'subject_type_id', v_type,
      'definition', jsonb_build_object('subtract', jsonb_build_object('objectSets',
        jsonb_build_array(
          jsonb_build_object('base', jsonb_build_object('objectType', v_type)),
          jsonb_build_object('filter', jsonb_build_object(
            'objectSet', jsonb_build_object('base', jsonb_build_object('objectType', v_type)),
            'where', '[{"type":"propertyFilter","propertyType":"city","value":{"type":"valuesFilter","values":["ATH"]}}]'::jsonb)))))))
      INTO v_set;
    SELECT count(*) INTO v_n FROM public.object_set_rows(v_set, 100, 0);
    IF v_n <> 2 THEN RAISE EXCEPTION 'PROOF FAILED: the composed set returned % rows, expected B and D', v_n; END IF;
    RAISE NOTICE 'PROVED: a composed object set saves and reads back';

    -- 10. The first defect: object_set_keys returned an empty array silently
    --     because it indexed the row by api_name. The property is pk/id here,
    --     which is exactly the shape that used to fail.
    SELECT public.object_set_keys(v_set) INTO v_keys;
    IF v_keys IS NULL OR array_length(v_keys, 1) <> 2 THEN
      RAISE EXCEPTION 'PROOF FAILED: object_set_keys returned %, and it used to return {}', v_keys;
    END IF;
    RAISE NOTICE 'PROVED: object_set_keys returns keys where it used to return an empty array';

    RAISE EXCEPTION 'ZZ843_UNWIND';
  EXCEPTION WHEN others THEN
    IF SQLERRM <> 'ZZ843_UNWIND' THEN RAISE; END IF;
    v_unwound := true;
  END;

  IF NOT v_unwound THEN RAISE EXCEPTION 'PROOF FAILED: the fixture did not unwind'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v_n FROM public.organizations WHERE name = 'zz843';
  IF v_n <> 0 THEN RAISE EXCEPTION 'PROOF FAILED: the fixture organization survived'; END IF;
  RAISE NOTICE 'PROVED: fixture unwound';
END $proof$;
