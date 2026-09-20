-- A collection comparison meets a jsonb property, and cannot cast it.
--
-- A LIVE DEFECT 821 OPENED, found by an adversary attacking a plan to build the
-- surface that would have reached it. Latent today — measured: 0 security
-- policies, 0 marking or array properties — and it is the last moment where
-- fixing it costs nothing.
--
-- THE CHAIN, each step executed rather than reasoned about:
--
--   1. 821 widened granular_term_shape's column arm so a MARKING field counts as
--      a collection: `(f->>'type') IN ('ARRAY', 'MARKING')`. That is what lets
--      `satisfies` find its right-hand term, and it was the point.
--   2. It also makes the three COLLECTION comparisons legal against such a
--      field. granular_policy_check ACCEPTS
--      `marking_ids intersects <marking property>` — probed, returns accepted.
--   3. granular_comparison_sql then casts the non-attribute side to text[]:
--      `((public.auth_marking_ids() && (o.vip)::text[]))`.
--   4. property_column_type('marking') is `jsonb`, and so is ('array') —
--      eight of the twenty-two base types are stored as jsonb.
--   5. `('["a"]'::jsonb)::text[]` raises `42846: cannot cast type jsonb to text[]`.
--
-- So a well-formed, accepted, saved policy compiles to SQL that cannot execute.
-- The object type is not filtered — it becomes UNREADABLE, through
-- object_read_predicate, in all four readers, with a raw Postgres error carrying
-- no `Policies:` namespace for a caller to branch on. Nothing in the composer,
-- the guards, the platform suite or CI would have caught it, because every one
-- of them stops at the policy being well-formed.
--
-- BOUNDED, AND THE MEASUREMENT IS WHAT BOUNDS IT. The restricted view path is
-- fine: a dataset's physical array columns are `text[]`, so the existing cast
-- works there and always has. Only the OBJECT path is affected, because
-- index_object_type stores a marking or array property as jsonb. This migration
-- therefore changes the emitter, not the grammar, and restricted views are
-- untouched by construction.
--
-- NOT REFUSED, FIXED. Refusing a collection comparison against an array property
-- would be stricter than Foundry, whose comparison list permits exactly this:
--
--   "**Intersects:** At least one side must be a collection, and both must be of the same type (or collection of that type)."
--   — platform-security-management/manage-granular-policies.md
--
-- An array property IS a collection. The defect is in how we spell it, not in
-- whether it is allowed.
--
-- AND THE NULL RULE IS PRESERVED RATHER THAN REDISCOVERED. The replacement emits
-- NULL for a null column, exactly as a real text[] column would, so a null
-- policy column still fails every comparison:
--
--   "**Make sure policy columns are non-null:** Rows with null values in a policy column will be inaccessible to all users."
--   — platform-security-management/manage-granular-policies.md
--
-- Probed across all three inputs before writing: `["a","b"]` becomes `{a,b}` and
-- compares as expected, `[]` becomes `{}`, and NULL stays NULL so `&&` and `<@`
-- both yield NULL rather than true. An `ARRAY(...)` without the NULL arm would
-- have turned a null column into `{}`, and `{} <@ anything` is TRUE — the
-- fail-open direction, and the same set-algebra trap 568 recorded.

-- PATCHED, NOT RETYPED: pg_get_functiondef with two anchors.
DO $patch$
DECLARE src text; out text; prev text;
BEGIN
  src := pg_get_functiondef('public.granular_term_sql(jsonb,jsonb,text)'::regprocedure);

  prev := src;
  src := replace(src,
    'DECLARE s record; el jsonb; parts text[] := ''{}'';',
    'DECLARE s record; el jsonb; parts text[] := ''{}''; fld text; col text;');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the DECLARE anchor did not match'; END IF;

  prev := src;
  src := replace(src,
    'o_sql := format(''%s.%I'', p_alias, p_term->>''column'');',
    'col := p_term->>''column'';' || E'\n' ||
    '    SELECT x->>''type'' INTO fld' || E'\n' ||
    '      FROM jsonb_array_elements(coalesce(p_fields, ''[]''::jsonb)) x' || E'\n' ||
    '     WHERE x->>''name'' = col;' || E'\n' ||
    '    IF fld IN (''ARRAY'', ''MARKING'') THEN' || E'\n' ||
    '      -- Stored as jsonb by index_object_type, so a text[] cast is impossible.' || E'\n' ||
    '      -- The NULL arm is load-bearing: without it a null column becomes {},' || E'\n' ||
    '      -- and {} <@ anything is TRUE, which fails open.' || E'\n' ||
    '      o_sql := format(' || E'\n' ||
    '        ''CASE WHEN %s.%I IS NULL THEN NULL::text[]''' || E'\n' ||
    '        '' ELSE ARRAY(SELECT jsonb_array_elements_text(%s.%I)) END'',' || E'\n' ||
    '        p_alias, col, p_alias, col);' || E'\n' ||
    '    ELSE' || E'\n' ||
    '      o_sql := format(''%s.%I'', p_alias, col);' || E'\n' ||
    '    END IF;');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the column arm anchor did not match'; END IF;

  EXECUTE src;
  RAISE NOTICE 'PATCHED: a jsonb-backed collection property compiles to text[]';
END $patch$;

-- ── The other asymmetry the same review found ─────────────────────────────
-- The combined weight limit is stated for the PAIR, and only one of the pair
-- checks it:
--
--   "For granular policies configured on property security policies, the combined [comparison weights](/docs/foundry/platform-security-management/manage-granular-policies/#policy-limitations) of the property security policy's granular policy and the object security policy's granular policy must stay under the granular policy comparison limit of 10,000."
--   — object-permissioning/object-security-policies.md
--
-- 826 put that check in guard_property_security_policy and 821's object guard
-- has none — measured, not assumed. So editing the OBJECT policy upward can push
-- the pair past the limit with no refusal, and the property policy is then
-- blamed on its next save for a change it did not make.
create or replace function public.guard_object_security_policy()
returns trigger language plpgsql
set search_path to 'public', 'pg_temp' as $$
DECLARE cmp text; v_fields jsonb; v_total int;
BEGIN
  IF NEW.policy IS NULL THEN RETURN NEW; END IF;

  v_fields := public.object_type_policy_fields(NEW.object_type_id);
  PERFORM public.granular_policy_check(NEW.policy, v_fields);

  -- Both levels, because the grammar nests exactly one deep and an ordering
  -- comparison hidden inside a nested group is still an ordering comparison.
  FOR cmp IN
    SELECT r->>'comparison'
      FROM jsonb_array_elements(NEW.policy->'rules') r
     WHERE NOT (r ? 'rules')
    UNION ALL
    SELECT r2->>'comparison'
      FROM jsonb_array_elements(NEW.policy->'rules') g,
           jsonb_array_elements(g->'rules') r2
     WHERE g ? 'rules'
  LOOP
    IF cmp IN ('less_than', 'less_than_or_equal', 'greater_than_or_equal', 'greater_than') THEN
      RAISE EXCEPTION 'Policies:ComparisonNotOnObjectPolicies — % is not available on an object security policy', cmp
        USING HINT = 'Object security policies do not support less/greater than comparison operators.';
    END IF;
  END LOOP;

  -- The limit is on the PAIR, so the object policy has to count its property
  -- policies' weight too — the mirror image of what 826 already does.
  SELECT public.granular_policy_weight(NEW.policy, v_fields)
       + coalesce(sum(public.granular_policy_weight(p.policy, v_fields)), 0)
    INTO v_total
    FROM public.property_security_policies p
   WHERE p.object_type_id = NEW.object_type_id;
  IF v_total >= 10000 THEN
    RAISE EXCEPTION 'Policies:CombinedPolicyOverweight — this policy and its property security policies weigh % together, the limit is under 10,000', v_total;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- PROVED BY DOING.
--
-- The first assertion is the defect: the same policy that used to compile to an
-- impossible cast must now compile to something Postgres will run, and must
-- still answer correctly for a present value, an empty array and a null.
DO $$
DECLARE
  v_fields jsonb := '[{"name":"vip","type":"MARKING"},{"name":"tags","type":"ARRAY"},{"name":"model","type":"STRING"}]'::jsonb;
  v_sql text; v_ok boolean;
BEGIN
  -- 1. No cast to text[] survives against a jsonb-backed field.
  v_sql := public.granular_policy_sql(jsonb_build_object(
    'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
      'left',  jsonb_build_object('user_attribute', 'marking_ids'),
      'comparison', 'intersects',
      'right', jsonb_build_object('column', 'vip')))), v_fields, 'o');
  IF v_sql LIKE '%(o.vip)::text[]%' THEN
    RAISE EXCEPTION 'PROOF FAILED: the impossible cast is still emitted: %', v_sql;
  END IF;
  IF v_sql NOT LIKE '%jsonb_array_elements_text%' THEN
    RAISE EXCEPTION 'PROOF FAILED: the jsonb-aware form was not emitted: %', v_sql;
  END IF;
  RAISE NOTICE 'PROVED: emitted %', v_sql;

  -- 2. AND IT RUNS, which is the whole point — asked of Postgres, against each
  --    of the three values a marking property can hold.
  EXECUTE format(
    'SELECT %s FROM (SELECT ''["a","b"]''::jsonb AS vip) o',
    replace(v_sql, 'public.auth_marking_ids()', 'ARRAY[''a'']::text[]')) INTO v_ok;
  IF v_ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'PROOF FAILED: a held marking did not match (got %)', v_ok;
  END IF;

  EXECUTE format(
    'SELECT %s FROM (SELECT ''[]''::jsonb AS vip) o',
    replace(v_sql, 'public.auth_marking_ids()', 'ARRAY[''a'']::text[]')) INTO v_ok;
  IF v_ok IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'PROOF FAILED: an empty marking set matched (got %)', v_ok;
  END IF;

  -- The null rule: "Rows with null values in a policy column will be
  -- inaccessible to all users." NULL, not false, exactly as a text[] column.
  EXECUTE format(
    'SELECT %s FROM (SELECT NULL::jsonb AS vip) o',
    replace(v_sql, 'public.auth_marking_ids()', 'ARRAY[''a'']::text[]')) INTO v_ok;
  IF v_ok IS NOT NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: a null policy column answered % rather than NULL', v_ok;
  END IF;
  RAISE NOTICE 'PROVED: it runs — held matches, empty does not, null is inaccessible';

  -- 3. An ARRAY property takes the same path.
  v_sql := public.granular_policy_sql(jsonb_build_object(
    'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
      'left',  jsonb_build_object('user_attribute', 'group_names'),
      'comparison', 'intersects',
      'right', jsonb_build_object('column', 'tags')))), v_fields, 'o');
  IF v_sql NOT LIKE '%jsonb_array_elements_text%' THEN
    RAISE EXCEPTION 'PROOF FAILED: an ARRAY property still casts: %', v_sql;
  END IF;

  -- 4. A scalar property is UNCHANGED, or this migration would have rewritten
  --    every restricted view policy in the platform.
  v_sql := public.granular_policy_sql(jsonb_build_object(
    'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
      'left',  jsonb_build_object('column', 'model'),
      'comparison', 'equal',
      'right', jsonb_build_object('user_attribute', 'username')))), v_fields, 'o');
  IF v_sql LIKE '%jsonb_array_elements_text%' OR v_sql NOT LIKE '%o.model%' THEN
    RAISE EXCEPTION 'PROOF FAILED: a scalar column was rewritten: %', v_sql;
  END IF;
  RAISE NOTICE 'PROVED: an ARRAY property is fixed and a scalar one is untouched';

  -- 5. And a real dataset field list — the restricted view path — still emits
  --    exactly what it did, because its array columns are genuinely text[].
  v_sql := public.granular_policy_sql(jsonb_build_object(
    'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
      'left',  jsonb_build_object('user_attribute', 'username'),
      'comparison', 'equal',
      'right', jsonb_build_object('column', 'owner')))),
    '[{"name":"owner","type":"STRING"}]'::jsonb, 'd');
  IF v_sql NOT LIKE '%d.owner%' OR v_sql LIKE '%jsonb_array_elements_text%' THEN
    RAISE EXCEPTION 'PROOF FAILED: the restricted view path changed: %', v_sql;
  END IF;
  RAISE NOTICE 'PROVED: the restricted view path is untouched';
END $$;

-- And the combined weight limit now binds from both sides.
DO $$
DECLARE
  v_ont uuid; v_user uuid; v_proj uuid; v_ot uuid; v_osp uuid; v_psp uuid;
  v_cat uuid; v_m uuid; v_heavy jsonb; v_msg text; v_fired boolean; i int;
  v_rules jsonb := '[]'::jsonb;
BEGIN
  SELECT id INTO v_user FROM public.users ORDER BY id LIMIT 1;
  SELECT id INTO v_ont  FROM public.ontologies ORDER BY created_at LIMIT 1;
  SELECT id INTO v_proj FROM public.projects WHERE NOT auto_protect_new ORDER BY created_at LIMIT 1;
  IF v_user IS NULL OR v_ont IS NULL OR v_proj IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: need a user, an ontology and an unprotected project';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  INSERT INTO public.object_types (ontology_id, project_id, api_name, label, status)
    VALUES (v_ont, v_proj, 'ZzProof831', 'Zz Proof 831', 'experimental') RETURNING id INTO v_ot;
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, api_name, display_name, base_type, source,
     backing_column, is_primary_key, is_title_key, required)
   VALUES (v_ot, 'pk', 'id', 'Id', 'string', 'column', 'pk', true, true, true);
  -- allow_empty_arrays is not optional on a marking property, and the CHECK
  -- marking_property_admits_empty is why:
  --
  --   "However, markings and organization values can be set to an empty array. In such cases, all users will meet the marking requirements and be able to view the row."
  --   — object-link-types/mandatory-control-properties.md
  --
  -- And required, per the same bullet's opening sentence: "**Mandatory control
  -- properties must be required.**" — marking_property_is_required.
  INSERT INTO public.object_type_properties
    (object_type_id, property_id, api_name, display_name, base_type, source,
     backing_column, position, allow_empty_arrays, required)
   VALUES (v_ot, 'vip', 'vip', 'Vip', 'marking', 'column', 'vip', 1, true, true);

  -- Three marking conditions weigh 3,000 each. Four reach 12,000, but a single
  -- policy is capped at 10,000 on its own — so the pair is what gets there:
  -- three on the object policy (9,000) and one on the property policy (3,000).
  FOR i IN 1..3 LOOP
    v_rules := v_rules || jsonb_build_array(jsonb_build_object(
      'left',  jsonb_build_object('user_attribute', 'marking_ids'),
      'comparison', 'satisfies',
      'right', jsonb_build_object('column', 'vip')));
  END LOOP;
  v_heavy := jsonb_build_object('match', 'all', 'rules', v_rules);

  -- Start UNDER the limit, because the property guard already refuses a pair
  -- that arrives over it — which is exactly why the gap was only reachable by
  -- editing the object policy upward afterwards.
  INSERT INTO public.object_security_policies (object_type_id, name, policy, created_by)
    VALUES (v_ot, 'zz-831-object', jsonb_build_object('match','all','rules', jsonb_build_array(
      jsonb_build_object('left', jsonb_build_object('user_attribute','marking_ids'),
                         'comparison','satisfies',
                         'right', jsonb_build_object('column','vip')))), v_user)
    RETURNING id INTO v_osp;
  INSERT INTO public.property_security_policies (object_type_id, name, policy, created_by)
    VALUES (v_ot, 'zz-831-property', jsonb_build_object('match','all','rules', jsonb_build_array(
      jsonb_build_object('left', jsonb_build_object('user_attribute','marking_ids'),
                         'comparison','satisfies',
                         'right', jsonb_build_object('column','vip')))), v_user)
    RETURNING id INTO v_psp;

  -- 3,000 + 3,000 = 6,000 so far. Raising the object policy to three conditions
  -- makes 9,000 + 3,000 = 12,000. Before this migration the object guard would
  -- have accepted that edit and left the property policy to be blamed for it on
  -- its next save.
  v_fired := false;
  BEGIN
    UPDATE public.object_security_policies SET policy = v_heavy WHERE id = v_osp;
  EXCEPTION WHEN others THEN v_msg := SQLERRM; v_fired := true;
  END;
  IF NOT v_fired OR v_msg NOT LIKE 'Policies:CombinedPolicyOverweight%' THEN
    RAISE EXCEPTION 'PROOF FAILED: the object guard still ignores the pair (%)', coalesce(v_msg, 'no error');
  END IF;
  RAISE NOTICE 'PROVED: the combined limit binds from the object side too (%)', left(v_msg, 60);

  DELETE FROM public.property_security_policies WHERE id = v_psp;
  DELETE FROM public.object_security_policies   WHERE id = v_osp;
  DELETE FROM public.object_types WHERE id = v_ot;
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF EXISTS (SELECT 1 FROM public.object_types WHERE api_name = 'ZzProof831') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed';
END $$;
