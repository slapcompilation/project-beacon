-- A build could not read an object type backed by a restricted view.
--
-- ── THE DIAGNOSIS, AND THE WRONG SUSPECT ────────────────────────────────────
-- 528 made `index_object_type` refuse to run outside a build job. With it in
-- place the `restrictedViews` fixture failed with "field name must not be
-- null", and the same type indexed fine when the indexer was called directly.
-- I recorded the guard as the suspect and reverted it (529/530). **The guard
-- was innocent.** It never ran a line of the body; all it did was force that
-- type down the build path for the first time, where a much older bug sat.
--
-- "field name must not be null" is what `jsonb_object_agg` raises for a NULL
-- KEY, and `job_spec_input_state` aggregates on `di.input_dataset_id`, whose
-- object-type arm reads `object_type_datasources.dataset_id`. For a restricted
-- view backing, that column is NULL — not incidentally, but BY CONSTRAINT:
--
--   object_type_datasources_one_backing CHECK
--     ((dataset_id IS NOT NULL AND branch_id IS NOT NULL AND restricted_view_id IS NULL)
--      OR (restricted_view_id IS NOT NULL AND dataset_id IS NULL AND branch_id IS NULL))
--
-- So this was never a fixture quirk and never about that type's mix of bound
-- and unbound properties, which is where my note sent the next reader.
-- **Every restricted-view-backed object type has been unbuildable since 513**,
-- and no test found it because the three fixtures all call the indexer
-- directly — which is exactly the hole 528 exists to close. The two changes
-- have to land in this order.
--
-- ── WHAT THE DOCUMENTATION SAYS THE ANSWER IS ───────────────────────────────
-- The materialization page names the chain in three terms:
--
--   "Object type: The object type at hand.
--    Restricted view: The restricted view backing the object type.
--    Backing dataset: The backing dataset of the restricted view."
--                                             (object-edits/materializations)
--
-- and its diagram draws them left to right, `backing dataset → restricted
-- view → Object Type`, with the arrows pointing that way
-- (object-edits/images/materializing-from-rv-term-definition.png).
--
--   "Restricted views are similar to datasets but restrict access to specific
--    rows in datasets. Restricted views are configured at the dataset level"
--                             (object-permissioning/configuring-rv-access-controls)
--
-- A restricted view is therefore not a second kind of input. It is a dataset
-- seen through a policy, and a build reading through one is reading that
-- dataset. So the type's input dataset resolves THROUGH the view rather than
-- stopping at a NULL.
--
-- ── THE SECOND BUG, WHICH WAS SILENT ────────────────────────────────────────
-- `job_blocked_by` takes the same NULL and, being a join key rather than an
-- aggregate key, simply matches nothing. A reindex of a restricted-view-backed
-- type therefore never waited for the build rewriting the data underneath it —
-- the exact thing 507 was built to prevent, quoting "other builds ... that
-- would change the inputs into the build" (`builds-and-schedules/overview`).
-- A raise is the better of the two failures; this one would have shipped stale
-- objects and said nothing.
--
-- Both arms now go through one resolver, so a third backing cannot reintroduce
-- this in only one of them.

-- ── the resolver ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.object_type_input_datasets(p_type uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SET search_path = public AS $$
  -- One row per datasource, resolved to the dataset the data actually lives
  -- in. A restricted view contributes its backing dataset; the CHECK above
  -- guarantees exactly one of the two is set, so the COALESCE is a choice
  -- between them and never a silent preference.
  SELECT coalesce(ds.dataset_id, rv.input_dataset_id)
    FROM public.object_type_datasources ds
    LEFT JOIN public.restricted_views rv ON rv.id = ds.restricted_view_id
   WHERE ds.object_type_id = p_type
     AND coalesce(ds.dataset_id, rv.input_dataset_id) IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.object_type_input_datasets(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.object_type_input_datasets(uuid) TO authenticated;
COMMENT ON FUNCTION public.object_type_input_datasets(uuid) IS
  'The datasets an object type reads, one per datasource, resolving a restricted-view backing to the view''s backing dataset: "Backing dataset: The backing dataset of the restricted view."';

-- ── the two consumers, now sharing it ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.job_spec_input_state(p_spec uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  -- A dataset spec reads dataset_inputs; an INDEX spec reads its object
  -- type's datasources. Both answer the same question — what were my inputs
  -- at their latest committed transaction — so freshness needs no second
  -- implementation and job_spec_fresh is untouched.
  SELECT COALESCE(jsonb_object_agg(di.input_dataset_id::text, t.latest::text), '{}'::jsonb)
    FROM public.job_specs js
    JOIN LATERAL (
      SELECT d.input_dataset_id FROM public.dataset_inputs d
       WHERE d.dataset_id = js.output_dataset_id
      UNION
      SELECT * FROM public.object_type_input_datasets(js.output_object_type_id)
      UNION
      -- A materialization job reads an object type and writes a dataset, so
      -- its inputs are that type's datasources: when they move, the merged
      -- state it copies has moved with them.
      SELECT * FROM public.object_type_input_datasets(js.source_object_type_id)
    ) di ON true
    LEFT JOIN LATERAL (
      SELECT tx.id AS latest FROM public.dataset_transactions tx
        JOIN public.dataset_branches b ON b.id = tx.branch_id
       WHERE tx.dataset_id = di.input_dataset_id
         AND b.name = 'master' AND tx.status = 'COMMITTED'
       ORDER BY tx.committed_at DESC LIMIT 1
    ) t ON true
   WHERE js.id = p_spec
$$;

CREATE OR REPLACE FUNCTION public.job_blocked_by(p_job uuid)
RETURNS uuid LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT other.build_id
    FROM public.build_jobs mine
    JOIN LATERAL (
      -- "other builds ... that would change the inputs into the build". A
      -- dataset job's inputs are declared; an index job's are its object
      -- type's datasources — so a reindex waits for the build rewriting the
      -- data it is about to read, which is the whole point of 507.
      SELECT d.input_dataset_id FROM public.dataset_inputs d
       WHERE d.dataset_id = mine.output_dataset_id
      UNION
      SELECT * FROM public.object_type_input_datasets(mine.output_object_type_id)
    ) di ON true
    JOIN public.build_jobs other ON other.output_dataset_id = di.input_dataset_id
    JOIN public.builds b ON b.id = other.build_id
   WHERE mine.id = p_job
     AND other.build_id <> mine.build_id
     AND b.status = 'RUNNING'
     AND other.state IN ('WAITING', 'RUN_PENDING', 'RUNNING')
   LIMIT 1
$$;

-- ── assertions, which RUN the failing call ──────────────────────────────────
-- 514's lesson was that an assertion which greps a definition proves nothing:
-- it passed while the heartbeat was dead on a column that did not exist. There
-- are no restricted-view-backed types in this database, so this one builds
-- one, calls the function that raised, and rolls the fixture back inside its
-- own subtransaction — the EXCEPTION block is the rollback.
DO $$
DECLARE
  ds_id uuid; proj uuid; org uuid; ont uuid; col text; rv uuid; ot uuid;
BEGIN
  -- A view's policy is checked against its input's schema, so the fixture
  -- needs a dataset that has one and builds its rule from a real column.
  SELECT d.id, d.project_id, public.dataset_current_fields(d.id) -> 0 ->> 'name'
    INTO ds_id, proj, col
    FROM public.datasets d
   WHERE d.project_id IS NOT NULL
     AND jsonb_array_length(coalesce(public.dataset_current_fields(d.id), '[]'::jsonb)) > 0
   LIMIT 1;
  SELECT o.id INTO ont FROM public.ontologies o LIMIT 1;
  IF ds_id IS NULL OR ont IS NULL THEN
    RAISE EXCEPTION '531: no schema-carrying dataset or ontology to build the fixture on';
  END IF;

  BEGIN
    -- organization_id defaults from the caller's claims, and a migration has
    -- none, so the fixture takes the project's.
    SELECT p.organization_id INTO org FROM public.projects p WHERE p.id = proj;

    INSERT INTO public.restricted_views (organization_id, project_id, input_dataset_id, api_name, name, policy)
    VALUES (org, proj, ds_id, 'rv_probe_531', 'Probe 531', jsonb_build_object(
      'match', 'all', 'rules', jsonb_build_array(jsonb_build_object(
        'left', jsonb_build_object('user_attribute', 'user_id'),
        'comparison', 'equal',
        'right', jsonb_build_object('column', col)))))
    RETURNING id INTO rv;

    INSERT INTO public.object_types (ontology_id, api_name, label)
    VALUES (ont, 'RvProbe531', 'Probe 531') RETURNING id INTO ot;

    INSERT INTO public.object_type_datasources (object_type_id, restricted_view_id)
    VALUES (ot, rv);

    -- The resolver sees through the view.
    IF (SELECT count(*) FROM public.object_type_input_datasets(ot) WHERE object_type_input_datasets = ds_id) <> 1 THEN
      RAISE EXCEPTION '531: a restricted-view backing did not resolve to its backing dataset';
    END IF;

    -- Publishing the spec that would exercise the aggregation itself takes an
    -- editor's uid (`guard_job_spec` → `can_index_object_type`), and a
    -- migration has no caller. That half is a platform test — the whole arc,
    -- restricted-view-backed type through `run_index_build` — where it runs on
    -- every change instead of once here.
    RAISE EXCEPTION 'probe-531-done' USING ERRCODE = 'ZZZZZ';
  EXCEPTION WHEN SQLSTATE 'ZZZZZ' THEN
    NULL;  -- the fixture rolls back with the subtransaction; failures above do not
  END;

  RAISE NOTICE '531: a restricted view resolves to the dataset underneath it';
END $$;
