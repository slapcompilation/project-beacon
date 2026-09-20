-- Search returns a title a property policy hides.
--
-- FOUND BY THE POST-BUILD RECONCILIATION I HAD NOT BEEN DOING. CLAUDE.md's rule
-- is `adversary BEFORE building, re-read source pages whole AFTER`; across
-- 821-831 I did the first half thoroughly and skipped the second, then updated
-- the readings from what I already believed — which can only ever confirm it.
-- The operator asked whether I reconcile after each build. I did not.
--
-- THE LEAK. `search_objects` selects the title key straight out of the index
-- table and also matches on it:
--
--   'SELECT %L::uuid, %L::text, o.%I::text, o.%I::text
--      FROM objects.%I o WHERE o.%I::text ILIKE %L AND %s LIMIT %s'
--
-- The third `%I` is the title column. 821 gave this reader the ROW filter
-- (object_read_predicate) and 827 gave three readers the CELL nuller
-- (property_policy_nulls); search_objects was never given the second. So a
-- property security policy covering the title property is not applied here, and
-- the page is unambiguous about what that means:
--
--   "Object and property security policies filter what a user can read. Users can never read object instances or property values they are not authorized to see."
--   — object-permissioning/object-security-policies.md
--
-- BOTH HALVES LEAK, and the second is the worse one. The value is returned in
-- the clear, and the ILIKE matches on it — so a caller who cannot see a title
-- can still discover it a character at a time by searching. Fixing only the
-- projection would leave the oracle.
--
-- NARROW, AND THE BOUND IS WORTH STATING. 826 forbids the PRIMARY key from any
-- property security policy, and on a type whose title key IS its primary key
-- nothing can cover it. The leak needs a title key that is not the primary key,
-- which is ordinary — the fixture here has one. Latent today: 0 property
-- security policies exist.
--
-- NOT A LEAK, AND I CHECKED BEFORE WRITING: the reconciliation also reported
-- `object_set_where` and `derived_property_select` as readers missing the
-- nuller. They are not readers. Both RETURN text — they build SQL fragments for
-- other readers to embed — so there is no projection in either to null, and
-- adding one would have been a change with no referent. Measured from
-- pg_get_function_result rather than from the call graph.

-- The same suffix 827 emits, applied to the one value this reader returns. Both
-- the projection and the predicate go through it, so a hidden title cannot be
-- read and cannot be matched.
DO $patch$
DECLARE src text; out text; prev text;
BEGIN
  src := pg_get_functiondef('public.search_objects(text,integer)'::regprocedure);

  prev := src;
  src := replace(src,
    '''SELECT %L::uuid, %L::text, o.%I::text, o.%I::text',
    '''SELECT %L::uuid, %L::text, o.%I::text, ((to_jsonb(o)%s) ->> %L)::text');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the projection anchor did not match'; END IF;

  prev := src;
  src := replace(src,
    '        WHERE o.%I::text ILIKE %L',
    '        WHERE ((to_jsonb(o)%s) ->> %L)::text ILIKE %L');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the predicate anchor did not match'; END IF;

  -- The argument list grows by one nulls-suffix and one column name per site.
  prev := src;
  src := replace(src,
    '      t.id, t.label, t.pk_col, t.title_col, t.index_table,',
    '      t.id, t.label, t.pk_col,' || E'\n' ||
    '      public.property_policy_nulls(t.id, ''o''), t.title_col, t.index_table,');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the projection argument anchor did not match'; END IF;

  prev := src;
  src := replace(src,
    '      t.title_col, ''%'' || p_query || ''%'',',
    '      public.property_policy_nulls(t.id, ''o''), t.title_col, ''%'' || p_query || ''%'',');
  IF src = prev THEN RAISE EXCEPTION 'PATCH FAILED: the predicate argument anchor did not match'; END IF;

  EXECUTE src;
  RAISE NOTICE 'PATCHED: search applies the property policy to the title it returns and matches on';
END $patch$;

-- PROVED BY DOING, as `authenticated`, on the real indexed object type.
--
-- The title key has to be a property a policy CAN cover, and 826 forbids the
-- primary key. On ExampleDataAircraft `tail_number` is both, so the proof moves
-- the title key to `model` for the duration and puts it back. Fabricating a
-- fresh indexed type instead is not cheaper and is less honest: index readiness
-- is `object_type_index_state(...) = 'COMPLETED'` — "The job is the tick" — so a
-- hand-made index table is not an index this reader would ever see.
DO $$
DECLARE
  v_ot uuid := '47516b65-f965-47b5-bab1-0a31901b641c';
  v_user uuid; v_org uuid; v_role text;
  v_osp uuid; v_psp uuid; v_hits int; v_title text; v_old text;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user'; END IF;

  -- app_metadata, not just sub: auth_in_ontology resolves the caller's
  -- organization through auth_org_id, and search_objects gates on it.
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  SELECT property_id INTO v_old FROM public.object_type_properties
   WHERE object_type_id = v_ot AND is_title_key;
  IF v_old IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: the fixture has no title key'; END IF;

  UPDATE public.object_type_properties SET is_title_key = false
   WHERE object_type_id = v_ot AND property_id = v_old;
  UPDATE public.object_type_properties SET is_title_key = true
   WHERE object_type_id = v_ot AND property_id = 'model';

  -- 1. Before any policy: search finds the title and returns it.
  SET LOCAL ROLE authenticated;
  SELECT count(*), max(s.title) INTO v_hits, v_title
    FROM public.search_objects('A320neo', 10) s WHERE s.object_type_id = v_ot;
  RESET ROLE;
  IF v_hits < 1 OR v_title <> 'A320neo' THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: the title is not searchable (% hits, title %)',
      v_hits, coalesce(v_title, 'NULL');
  END IF;

  -- 2. A property policy the caller cannot pass, covering the title property.
  INSERT INTO public.object_security_policies (object_type_id, name, created_by)
    VALUES (v_ot, 'zz-832-object', v_user) RETURNING id INTO v_osp;
  INSERT INTO public.property_security_policies (object_type_id, name, policy, created_by)
    VALUES (v_ot, 'zz-832-hide-title', jsonb_build_object(
      'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
        'left',  jsonb_build_object('user_attribute', 'user_id'),
        'comparison', 'equal',
        'right', jsonb_build_object('value', gen_random_uuid()::text)))), v_user)
    RETURNING id INTO v_psp;
  INSERT INTO public.property_security_policy_properties (policy_id, object_type_id, property_id)
    VALUES (v_psp, v_ot, 'model');

  -- 3. THE FIX, both halves. The title no longer comes back, AND the search no
  --    longer matches it — a value you may not read must not be an oracle.
  SET LOCAL ROLE authenticated;
  SELECT count(*), max(s.title) INTO v_hits, v_title
    FROM public.search_objects('A320neo', 10) s WHERE s.object_type_id = v_ot;
  RESET ROLE;
  IF v_hits <> 0 THEN
    RAISE EXCEPTION 'PROOF FAILED: a hidden title is still matchable (% hits, title %)',
      v_hits, coalesce(v_title, 'NULL');
  END IF;
  RAISE NOTICE 'PROVED: a hidden title is neither returned nor matched';

  -- 4. And an UNCOVERED title is untouched, or this would have broken search for
  --    every object type in the platform.
  DELETE FROM public.property_security_policy_properties WHERE policy_id = v_psp;
  SET LOCAL ROLE authenticated;
  SELECT count(*), max(s.title) INTO v_hits, v_title
    FROM public.search_objects('A320neo', 10) s WHERE s.object_type_id = v_ot;
  RESET ROLE;
  IF v_hits < 1 OR v_title <> 'A320neo' THEN
    RAISE EXCEPTION 'PROOF FAILED: an uncovered title stopped being searchable (% hits)', v_hits;
  END IF;
  RAISE NOTICE 'PROVED: an uncovered title is still returned and still matched';

  DELETE FROM public.property_security_policies WHERE id = v_psp;
  DELETE FROM public.object_security_policies   WHERE id = v_osp;
  UPDATE public.object_type_properties SET is_title_key = false
   WHERE object_type_id = v_ot AND property_id = 'model';
  UPDATE public.object_type_properties SET is_title_key = true
   WHERE object_type_id = v_ot AND property_id = v_old;

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_hits FROM public.search_objects('A320neo', 10) s
   WHERE s.object_type_id = v_ot;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF (SELECT property_id FROM public.object_type_properties
       WHERE object_type_id = v_ot AND is_title_key) IS DISTINCT FROM v_old THEN
    RAISE EXCEPTION 'PROOF FAILED: the title key was not restored';
  END IF;
  IF EXISTS (SELECT 1 FROM public.object_security_policies WHERE name = 'zz-832-object') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: title key restored to %, fixtures removed', v_old;
END $$;
