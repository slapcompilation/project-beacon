-- L3 of the Data Lineage phase — the reason the reading exists: "You can use
-- Data Lineage to evaluate how changes to dataset Markings can impact derived
-- datasets" (see-impact-marking-changes.md).
--
-- The output contract is the four documented states, verbatim tokens:
--   simulated_changes_applied — "appears on the datasets to which you applied
--     changes"
--   access_affected   — "datasets for which the Markings before and after the
--     change will be different"
--   access_unaffected — "datasets for which the Markings before and after
--     will remain the same"
--   no_visible_transactions — "datasets that have not been built yet, or
--     where you do not have permission to see transactions"
--
-- And the one hard constraint: "You can only remove Markings that were
-- applied directly on the dataset. Removal of Markings that were inherited
-- through a dataset's lineage or from the parent Project cannot be
-- simulated." — enforced on what file_marking_origin() already returns.
--
-- The simulation recomputes each downstream dataset's effective markings
-- under the hypothesis: the target's file-marking set with the additions in
-- and the removals out, flowed through the same recursion
-- effective_data_markings() uses — including the per-edge stops, which are
-- the "stop propagating Markings via code" mechanism. The page's own caveat
-- stands: it "relies on the most recent dataset builds".

-- The flow, with one dataset's file markings replaceable by a hypothesis.
CREATE OR REPLACE FUNCTION public.simulated_dataset_markings(
  p_dataset uuid, p_target uuid, p_target_file uuid[])
RETURNS uuid[]
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE up AS (
    SELECT di.input_dataset_id AS id
      FROM public.dataset_inputs di
     WHERE di.dataset_id = p_dataset
    UNION
    SELECT di.input_dataset_id
      FROM public.dataset_inputs di
      JOIN up ON di.dataset_id = up.id
  ),
  flow AS (
    SELECT u.id AS at, m.id AS marking
      FROM up u
     CROSS JOIN LATERAL unnest(
       CASE WHEN u.id = p_target THEN p_target_file
            ELSE public.effective_file_markings('dataset', u.id) END) AS m(id)
    UNION
    SELECT di.dataset_id, f.marking
      FROM flow f
      JOIN public.dataset_inputs di ON di.input_dataset_id = f.at
     WHERE NOT EXISTS (
       SELECT 1 FROM public.dataset_input_marking_stops s
        WHERE s.dataset_id = di.dataset_id
          AND s.input_dataset_id = di.input_dataset_id
          AND s.marking_id = f.marking)
  )
  SELECT coalesce(array_agg(DISTINCT f.marking), '{}'::uuid[])
    FROM flow f
   WHERE f.at = p_dataset
     AND NOT f.marking = ANY (
       CASE WHEN p_dataset = p_target THEN p_target_file
            ELSE public.effective_file_markings('dataset', p_dataset) END)
$$;

REVOKE ALL ON FUNCTION public.simulated_dataset_markings(uuid, uuid, uuid[]) FROM PUBLIC, authenticated;

COMMENT ON FUNCTION public.simulated_dataset_markings(uuid, uuid, uuid[]) IS
  'Internal: effective_data_markings() with one dataset''s file-marking set replaced by a hypothesis. simulate_marking_changes() is its caller.';

CREATE OR REPLACE FUNCTION public.simulate_marking_changes(
  p_dataset uuid,
  p_add uuid[] DEFAULT '{}',
  p_remove uuid[] DEFAULT '{}')
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m uuid; origin text; hypo uuid[]; result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.datasets d
     WHERE d.id = p_dataset AND public.project_role(d.project_id) IS NOT NULL) THEN
    RAISE EXCEPTION 'Compass:DatasetNotFound — % is not a dataset you can see', p_dataset;
  END IF;

  -- "You can only remove Markings that were applied directly on the dataset."
  FOREACH m IN ARRAY coalesce(p_remove, '{}'::uuid[]) LOOP
    origin := public.file_marking_origin('dataset', p_dataset, m);
    IF origin IS DISTINCT FROM 'direct' THEN
      RAISE EXCEPTION 'Compass:OnlyDirectMarkingsRemovable — removal of Markings inherited through a dataset''s lineage or from the parent Project cannot be simulated (% is %)',
        m, coalesce(origin, 'not applied here');
    END IF;
  END LOOP;

  -- The hypothesis: the target's file markings, additions in, removals out.
  SELECT coalesce(array_agg(DISTINCT x), '{}'::uuid[]) INTO hypo
    FROM (
      SELECT unnest(public.effective_file_markings('dataset', p_dataset)) AS x
      UNION
      SELECT unnest(coalesce(p_add, '{}'::uuid[]))
    ) u
   WHERE NOT x = ANY (coalesce(p_remove, '{}'::uuid[]));

  -- The target and everything downstream of it, with before and after.
  WITH RECURSIVE down AS (
    SELECT p_dataset AS id
    UNION
    SELECT di.dataset_id
      FROM public.dataset_inputs di
      JOIN down ON di.input_dataset_id = down.id
  ),
  states AS (
    SELECT d.id, ds.name,
      (SELECT coalesce(array_agg(x ORDER BY x), '{}'::uuid[]) FROM (
         SELECT unnest(public.effective_file_markings('dataset', d.id)
                       || public.effective_data_markings(d.id)) AS x) b) AS before,
      (SELECT coalesce(array_agg(x ORDER BY x), '{}'::uuid[]) FROM (
         SELECT unnest(
           CASE WHEN d.id = p_dataset THEN hypo
                ELSE public.effective_file_markings('dataset', d.id) END
           || public.simulated_dataset_markings(d.id, p_dataset, hypo)) AS x) a) AS after,
      EXISTS (SELECT 1 FROM public.dataset_transactions tx
               WHERE tx.dataset_id = d.id AND tx.status = 'COMMITTED') AS built
    FROM down d JOIN public.datasets ds ON ds.id = d.id
    WHERE public.project_role(ds.project_id) IS NOT NULL
  )
  SELECT jsonb_agg(jsonb_build_object(
           'dataset_id', s.id, 'name', s.name,
           'state', CASE
             WHEN s.id = p_dataset THEN 'simulated_changes_applied'
             WHEN NOT s.built THEN 'no_visible_transactions'
             WHEN s.before IS DISTINCT FROM s.after THEN 'access_affected'
             ELSE 'access_unaffected' END,
           'before', to_jsonb(s.before), 'after', to_jsonb(s.after))
         ORDER BY s.name)
    INTO result FROM states s;

  RETURN coalesce(result, '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.simulate_marking_changes(uuid, uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.simulate_marking_changes(uuid, uuid[], uuid[]) TO authenticated;

COMMENT ON FUNCTION public.simulate_marking_changes(uuid, uuid[], uuid[]) IS
  'Rehearse a marking change before applying it: the four documented states per downstream dataset, with removals allowed only on directly-applied markings. Hypothetical — nothing is written.';

-- ── assertions: the rehearsal against a known pipeline ─────────────────────
DO $$
DECLARE
  org uuid; sp uuid; proj uuid;
  a_ds uuid; b_ds uuid; c_ds uuid; br uuid; txn uuid;
  cat uuid; mk uuid; usr uuid := gen_random_uuid(); before_claims text;
  sim jsonb; row_j jsonb;
BEGIN
  before_claims := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('sim-480') RETURNING id INTO org;
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (usr, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','ws480@beacon.test');
  INSERT INTO public.users (id, email, role, organization_id)
  VALUES (usr, 'ws480@beacon.test', 'admin', org);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', usr::text,
      'app_metadata', json_build_object('role','admin','org_id',org))::text, true);

  SET LOCAL ROLE authenticated;

  sp := public.create_space('WS480');
  INSERT INTO public.projects (organization_id, space_id, api_name, name)
  VALUES (org, sp, 'ws480', 'WS480') RETURNING id INTO proj;
  INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
  VALUES (proj, usr, 'owner', org);

  -- a → b → c; b is built, c is not.
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'a480', 'a') RETURNING id INTO a_ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (a_ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (a_ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'b480', 'b') RETURNING id INTO b_ds;
  INSERT INTO public.dataset_branches (dataset_id, name) VALUES (b_ds,'master') RETURNING id INTO br;
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (b_ds, a_ds);
  INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
  VALUES (b_ds, br, 'SNAPSHOT') RETURNING id INTO txn;
  UPDATE public.dataset_transactions SET status='COMMITTED', committed_at=clock_timestamp() WHERE id = txn;

  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
  VALUES (org, proj, 'c480', 'c') RETURNING id INTO c_ds;
  INSERT INTO public.dataset_inputs (dataset_id, input_dataset_id) VALUES (c_ds, b_ds);

  RESET ROLE;
  INSERT INTO public.marking_categories (organization_id, name, category_type)
  VALUES (org, 'Sim 480', 'conjunctive') RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name)
  VALUES (cat, 'Sensitive 480') RETURNING id INTO mk;
  -- Applying a marking needs the marking's own "apply" permission (399).
  INSERT INTO public.marking_permissions (marking_id, user_id, permission)
  VALUES (mk, usr, 'apply');
  SET LOCAL ROLE authenticated;

  -- 1. Adding a marking on a: a is the change, built b is affected, unbuilt c
  --    says no visible transactions.
  sim := public.simulate_marking_changes(a_ds, ARRAY[mk], '{}');
  IF (SELECT s->>'state' FROM jsonb_array_elements(sim) s WHERE (s->>'dataset_id')::uuid = a_ds)
       <> 'simulated_changes_applied'
     OR (SELECT s->>'state' FROM jsonb_array_elements(sim) s WHERE (s->>'dataset_id')::uuid = b_ds)
       <> 'access_affected'
     OR (SELECT s->>'state' FROM jsonb_array_elements(sim) s WHERE (s->>'dataset_id')::uuid = c_ds)
       <> 'no_visible_transactions' THEN
    RAISE EXCEPTION 'the add simulation states are wrong: %', sim;
  END IF;

  -- 2. Simulating no change leaves everything built unaffected.
  sim := public.simulate_marking_changes(a_ds, '{}', '{}');
  IF (SELECT s->>'state' FROM jsonb_array_elements(sim) s WHERE (s->>'dataset_id')::uuid = b_ds)
       <> 'access_unaffected' THEN
    RAISE EXCEPTION 'a no-op simulation affected something: %', sim;
  END IF;

  -- 3. Really apply the marking on a; then removing it FROM B refuses — on b
  --    it is inherited through lineage, not direct.
  RESET ROLE;
  INSERT INTO public.resource_markings (resource_kind, resource_id, marking_id)
  VALUES ('dataset', a_ds, mk);
  SET LOCAL ROLE authenticated;
  BEGIN
    sim := public.simulate_marking_changes(b_ds, '{}', ARRAY[mk]);
    RAISE EXCEPTION 'an inherited marking was removable';
  EXCEPTION WHEN OTHERS THEN
    IF sqlerrm NOT LIKE 'Compass:OnlyDirectMarkingsRemovable%' THEN RAISE; END IF;
  END;

  -- 4. Removing it from a — where it IS direct — affects built b.
  sim := public.simulate_marking_changes(a_ds, '{}', ARRAY[mk]);
  SELECT s INTO row_j FROM jsonb_array_elements(sim) s WHERE (s->>'dataset_id')::uuid = b_ds;
  IF row_j->>'state' <> 'access_affected' THEN
    RAISE EXCEPTION 'removing a direct marking did not affect the child: %', sim;
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before_claims, ''), true);
  RAISE NOTICE '480: the four states, and only direct markings come off';
  RAISE EXCEPTION 'rollback assertions';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', coalesce(before_claims, ''), true);
  IF sqlerrm <> 'rollback assertions' THEN RAISE; END IF;
END $$;
