-- A denied property keeps its key and loses its value.
--
-- 826 built the authoring half of property security policies. This is the read
-- path, and the whole migration turns on one sentence distinguishing it from the
-- object policy 821 shipped:
--
--   "If a user does not pass the object security policy, the object instance will not be viewable to that user. If they pass the object security policy but do not pass the property security policy, they will see a *null* value in place of the property value."
--   — object-permissioning/object-security-policies.md
--
-- Three denial shapes now exist on one read, and each is a different edit to the
-- projection. They must not share a code path:
--
--   object policy failed        the row never appears        (821, in the WHERE)
--   property visibility hidden  the KEY is removed           (to_jsonb(o) - hidden)
--   property policy failed      the key stays, value null    (this migration)
--
-- The middle one is already built and the page for it is separate:
--
--   "No hidden object or property types will be displayed as search results here or elsewhere in Object Explorer."
--   — object-explorer/search-objects.md
--
-- PER ROW, NOT PER CALLER. A property policy is a granular policy like any
-- other, so it can name a property and its answer differs row by row. That is
-- why this compiles to a CASE inside the projection rather than to a set of keys
-- computed once for the caller.
--
--   "By default, object security policies are applied to all properties. When a property security policy includes a property, the user must pass both the object security policy and the property security policy to view the property value."
--   — object-permissioning/object-security-policies.md
--
-- and the complement, which is why nothing here needs a default arm:
--
--   "Properties not included in any property security policy will still be secured by the object security policy."
--   — object-permissioning/object-security-policies.md

-- The hidden set, lifted to a function so a reader can strip without holding a
-- local variable. evaluate_object_set and list_linked_objects each compute this
-- inline today and are left alone; indexed_objects had nowhere to put it, which
-- is half of why it never stripped at all.
create or replace function public.object_type_hidden_properties(p_object_type uuid)
returns text[] language sql stable
set search_path to 'public', 'pg_temp' as $$
  SELECT coalesce(array_agg(p.property_id), '{}')
    FROM public.object_type_properties p
   WHERE p.object_type_id = p_object_type AND p.visibility = 'hidden'
$$;

comment on function public.object_type_hidden_properties(uuid) is
  'The property ids a reader removes from the row entirely — "No hidden object or property types will be displayed as search results here or elsewhere in Object Explorer" (object-explorer/search-objects). Distinct from a failed property security policy, which keeps the key and nulls the value.';

-- The projection suffix: one CASE per property security policy on the type,
-- each nulling exactly the properties it covers when the caller fails it.
-- Appends to whatever the reader already built, and jsonb `||` lets the later
-- key win, so a nulled property stays nulled even if it was also a derived key.
create or replace function public.property_policy_nulls(p_object_type uuid, p_alias text default 'o')
returns text language plpgsql stable
set search_path to 'public', 'pg_temp' as $$
DECLARE r record; v_fields jsonb; parts text := '';
BEGIN
  v_fields := public.object_type_policy_fields(p_object_type);
  FOR r IN
    SELECT pp.policy,
           (SELECT jsonb_object_agg(m.property_id, NULL)
              FROM public.property_security_policy_properties m
             WHERE m.policy_id = pp.id) AS covered
      FROM public.property_security_policies pp
     WHERE pp.object_type_id = p_object_type
     ORDER BY pp.created_at, pp.id
  LOOP
    -- A policy covering nothing nulls nothing, and a policy with no granular
    -- rules has nothing to fail — its markings slot is not built yet (821).
    CONTINUE WHEN r.covered IS NULL OR r.policy IS NULL;
    parts := parts || format(' || CASE WHEN %s THEN ''{}''::jsonb ELSE %L::jsonb END',
                             public.granular_policy_sql(r.policy, v_fields, p_alias),
                             r.covered::text);
  END LOOP;
  RETURN parts;
END $$;

comment on function public.property_policy_nulls(uuid, text) is
  'The projection suffix that nulls each property whose property security policy the caller fails, evaluated per row because a granular policy may name a property. Empty when the type has no property policies, so a reader can append it unconditionally.';

-- ── The three readers ─────────────────────────────────────────────────────
-- Patched from pg_get_functiondef, never retyped, each anchor asserted.
DO $patch$
DECLARE src text; out text;
BEGIN
  -- evaluate_object_set already ends its projection with the derived-property
  -- pairs; the nulls append after them.
  src := pg_get_functiondef('public.evaluate_object_set(uuid,jsonb,jsonb,integer,integer,text)'::regprocedure);
  out := replace(src,
    '    CASE WHEN dpairs IS NULL THEN '''' ELSE '' || jsonb_build_object('' || dpairs || '')'' END,',
    '    (CASE WHEN dpairs IS NULL THEN '''' ELSE '' || jsonb_build_object('' || dpairs || '')'' END)' || E'\n' ||
    '      || public.property_policy_nulls(p_object_type, ''o''),');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: evaluate_object_set projection anchor did not match'; END IF;
  EXECUTE out;

  -- list_linked_objects projects the FAR type's row, so it takes the far type's
  -- policies — the rule 771-773 established for every index a reader joins.
  src := pg_get_functiondef('public.list_linked_objects(uuid,text,text,integer,integer,text)'::regprocedure);
  out := replace(src,
    '''SELECT to_jsonb(o) - %L::text[] FROM objects.%I o WHERE (%s) AND %s ORDER BY o.%I LIMIT %s OFFSET %s''',
    '''SELECT (to_jsonb(o) - %L::text[])%s FROM objects.%I o WHERE (%s) AND %s ORDER BY o.%I LIMIT %s OFFSET %s''');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: list_linked_objects format anchor did not match'; END IF;
  src := out;
  out := replace(src,
    '              hidden, far_tbl, wh, link_cond, far_pk, p_limit, p_offset);',
    '              hidden, public.property_policy_nulls(far, ''o''), far_tbl, wh, link_cond, far_pk, p_limit, p_offset);');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: list_linked_objects argument anchor did not match'; END IF;
  EXECUTE out;

  -- indexed_objects gets the nulls AND, in the same expression, the hidden strip
  -- it never had. Measured before this migration: its two siblings both emit
  -- `to_jsonb(o) - <hidden>` and it emitted bare `to_jsonb(o)`, so a property
  -- marked hidden was served by this reader alone. Fixed here rather than filed,
  -- because it is the same line and leaving it would mean a property policy and
  -- a hidden flag disagreeing about the same reader.
  src := pg_get_functiondef('public.indexed_objects(uuid,integer)'::regprocedure);
  out := replace(src,
    '    ''SELECT to_jsonb(o) FROM objects.%I o WHERE %s LIMIT %s'',',
    '    ''SELECT (to_jsonb(o) - public.object_type_hidden_properties(%L::uuid))%s FROM objects.%I o WHERE %s LIMIT %s'',');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: indexed_objects format anchor did not match'; END IF;
  src := out;
  out := replace(src,
    '    tbl, COALESCE(public.object_read_predicate(p_object_type), ''true''),',
    '    p_object_type, public.property_policy_nulls(p_object_type, ''o''),' || E'\n' ||
    '    tbl, COALESCE(public.object_read_predicate(p_object_type), ''true''),');
  IF out = src THEN RAISE EXCEPTION 'PATCH FAILED: indexed_objects argument anchor did not match'; END IF;
  EXECUTE out;

  RAISE NOTICE 'PATCHED: three readers project property-policy nulls, and indexed_objects strips hidden';
END $patch$;

-- PROVED BY DOING, as `authenticated`, against a real indexed object type.
--
-- The assertion that matters is the SHAPE of the denial, not merely that
-- something changed: the key must still be there and its value must be null. A
-- test that only counted rows would pass against a reader that dropped the key,
-- which is the other feature's behaviour.
DO $$
DECLARE
  v_ot uuid := '47516b65-f965-47b5-bab1-0a31901b641c';
  v_user uuid; v_org uuid; v_role text; v_osp uuid; v_psp uuid;
  v_row jsonb; v_seen int; v_all int; v_vis text;
BEGIN
  SELECT id, organization_id, role INTO v_user, v_org, v_role
    FROM public.users WHERE role IN ('owner','admin') ORDER BY id LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'PROOF CANNOT RUN: need an owner/admin user'; END IF;
  SELECT count(*) INTO v_all FROM objects.ot_47516b65f96547b5bab10a31901b641c;

  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user,
    'app_metadata', json_build_object('role', v_role, 'org_id', v_org))::text, true);

  -- Baseline: the property is present with a real value.
  SET LOCAL ROLE authenticated;
  SELECT r INTO v_row FROM public.indexed_objects(v_ot, 1) r;
  RESET ROLE;
  IF NOT (v_row ? 'model') OR v_row->>'model' IS NULL THEN
    RAISE EXCEPTION 'PROOF CANNOT RUN: the fixture has no model value to hide: %', v_row;
  END IF;

  -- A property policy the caller cannot pass, covering `model` and `manufacturer`.
  INSERT INTO public.object_security_policies (object_type_id, name, created_by)
    VALUES (v_ot, 'zz-827-object', v_user) RETURNING id INTO v_osp;
  INSERT INTO public.property_security_policies (object_type_id, name, policy, created_by)
    VALUES (v_ot, 'zz-827-hide', jsonb_build_object(
      'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
        'left',  jsonb_build_object('user_attribute', 'user_id'),
        'comparison', 'equal',
        'right', jsonb_build_object('value', gen_random_uuid()::text)))), v_user)
    RETURNING id INTO v_psp;
  INSERT INTO public.property_security_policy_properties (policy_id, object_type_id, property_id)
    VALUES (v_psp, v_ot, 'model'), (v_psp, v_ot, 'manufacturer');

  -- 1. THE SHAPE. The row is still returned, the key is still present, and the
  --    value is null — all three, because any one alone is the wrong feature.
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.indexed_objects(v_ot, 100);
  SELECT r INTO v_row FROM public.indexed_objects(v_ot, 1) r;
  RESET ROLE;
  IF v_seen <> v_all THEN
    RAISE EXCEPTION 'PROOF FAILED: a property policy withheld rows (% of %)', v_seen, v_all;
  END IF;
  IF NOT (v_row ? 'model') THEN
    RAISE EXCEPTION 'PROOF FAILED: the denied property lost its key, which is what hidden does: %', v_row;
  END IF;
  IF v_row->'model' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'PROOF FAILED: the denied property kept its value: %', v_row;
  END IF;
  IF v_row->'manufacturer' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'PROOF FAILED: the second covered property kept its value: %', v_row;
  END IF;
  RAISE NOTICE 'PROVED: the row stays, the key stays, the value is null';

  -- 2. An uncovered property is untouched — "Properties not included in any
  --    property security policy will still be secured by the object security
  --    policy", which here admits everything.
  IF v_row->>'tail_number' IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: an uncovered property was nulled too: %', v_row;
  END IF;
  RAISE NOTICE 'PROVED: an uncovered property is untouched';

  -- 3. Passing the policy restores the value, so the CASE is really evaluated
  --    rather than the ELSE arm being emitted unconditionally.
  UPDATE public.property_security_policies SET policy = jsonb_build_object(
    'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
      'left',  jsonb_build_object('user_attribute', 'user_id'),
      'comparison', 'equal',
      'right', jsonb_build_object('value', v_user::text))))
   WHERE id = v_psp;
  SET LOCAL ROLE authenticated;
  SELECT r INTO v_row FROM public.indexed_objects(v_ot, 1) r;
  RESET ROLE;
  IF v_row->>'model' IS NULL THEN
    RAISE EXCEPTION 'PROOF FAILED: passing the policy did not restore the value: %', v_row;
  END IF;
  RAISE NOTICE 'PROVED: passing the policy restores the value';

  -- 4. And indexed_objects now strips a hidden property, which it never did.
  --    The original visibility is saved and restored rather than guessed: the
  --    set is prominent/normal/hidden and there is no 'visible' member.
  SELECT visibility INTO v_vis FROM public.object_type_properties
   WHERE object_type_id = v_ot AND property_id = 'seats';
  UPDATE public.object_type_properties SET visibility = 'hidden'
   WHERE object_type_id = v_ot AND property_id = 'seats';
  SET LOCAL ROLE authenticated;
  SELECT r INTO v_row FROM public.indexed_objects(v_ot, 1) r;
  RESET ROLE;
  IF v_row ? 'seats' THEN
    RAISE EXCEPTION 'PROOF FAILED: indexed_objects still serves a hidden property: %', v_row;
  END IF;
  RAISE NOTICE 'PROVED: indexed_objects strips a hidden property, as its siblings always did';

  UPDATE public.object_type_properties SET visibility = v_vis
   WHERE object_type_id = v_ot AND property_id = 'seats';
  DELETE FROM public.property_security_policies WHERE id = v_psp;
  DELETE FROM public.object_security_policies   WHERE id = v_osp;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF EXISTS (SELECT 1 FROM public.property_security_policies WHERE object_type_id = v_ot)
     OR EXISTS (SELECT 1 FROM public.object_security_policies WHERE object_type_id = v_ot)
     OR EXISTS (SELECT 1 FROM public.object_type_properties
                 WHERE object_type_id = v_ot AND visibility = 'hidden') THEN
    RAISE EXCEPTION 'PROOF FAILED: a fixture was left behind';
  END IF;
  RAISE NOTICE 'PROVED: fixtures removed';
END $$;
