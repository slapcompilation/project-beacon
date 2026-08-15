-- Every existing index gets the build job OSv2 says it must have.
--
-- §5 step 3a, and the question it turned on is settled by the documentation
-- rather than by a choice:
--
--   "The Funnel service is responsible for orchestrating Funnel pipelines that
--    create and modify object instances in the Ontology and ensure up-to-date
--    data and metadata."                        (object-indexing/overview)
--
-- The pipeline CREATES the instances. An index is not something that exists
-- and then acquires a pipeline; it is what a pipeline produces. And a type
-- entering OSv2 is indexed by a first run before anything switches over:
--
--   "If no transition window is set, the migration will start as soon the
--    first Funnel pipeline succeeds."
--   "A transition window will be computed after the first sync to OSv2
--    finishes successfully."           (object-backend/osv1-osv2-migration)
--
-- So there is no supported state in which an OSv2 object type has an index and
-- no pipeline. 523 assumed that away and hid every object; 524 accommodated it
-- with a fallback arm. This removes the reason for the arm instead: every
-- index that predates 513 gets one build, and after this the fallback is
-- unreachable — asserted below rather than hoped.
--
-- ── WHY THIS RUNS THE INDEXER RATHER THAN FORGING A ROW ─────────────────────
-- A build job could be inserted directly with state COMPLETED and the
-- predicate would be satisfied. That would be a lie in the ledger: a job that
-- claims to have indexed something it never touched, with no transaction, no
-- input state and no duration. The backfill runs the real thing, so the job
-- says what actually happened and staleness is computed from real inputs.

DO $$
DECLARE t record; u record; before text; built uuid; n int := 0; failed int := 0;
BEGIN
  before := current_setting('request.jwt.claims', true);

  FOR t IN
    SELECT i.object_type_id AS id, p.organization_id
      FROM public.object_type_indexes i
      JOIN public.object_types ot ON ot.id = i.object_type_id
      JOIN public.projects p ON p.id = ot.project_id
     WHERE NOT EXISTS (SELECT 1 FROM public.build_jobs bj
                        WHERE bj.output_object_type_id = i.object_type_id)
  LOOP
    -- As an owner or admin of the type's organization, the way the heartbeat
    -- does it: run_index_build checks can_index_object_type per type.
    SELECT u2.id, u2.role, u2.organization_id INTO u
      FROM public.users u2
     WHERE u2.organization_id = t.organization_id AND u2.role IN ('owner', 'admin')
     ORDER BY u2.created_at LIMIT 1;
    IF u IS NULL THEN
      RAISE WARNING 'no owner or admin in the organization of %, skipping', t.id;
      failed := failed + 1;
      CONTINUE;
    END IF;

    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u.id::text,
          'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
      built := public.run_index_build(ARRAY[t.id], true);
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      IF built IS NULL THEN
        RAISE WARNING 'no build created for %', t.id;
        failed := failed + 1;
      ELSE
        n := n + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      RAISE WARNING 'backfill failed for %: %', t.id, sqlerrm;
      failed := failed + 1;
    END;
  END LOOP;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  RAISE NOTICE '525: % index build(s) backfilled, % skipped', n, failed;
END $$;

-- ── the precondition for removing the fallback ──────────────────────────────
DO $$
DECLARE orphans int; unready int;
BEGIN
  SELECT count(*) INTO orphans FROM public.object_type_indexes i
   WHERE NOT EXISTS (SELECT 1 FROM public.build_jobs bj
                      WHERE bj.output_object_type_id = i.object_type_id);
  IF orphans > 0 THEN
    RAISE EXCEPTION '% index(es) still have no build job — the fallback arm cannot be removed', orphans;
  END IF;

  -- And nothing that was readable before became unreadable: every index that
  -- said success now has a job that says COMPLETED.
  SELECT count(*) INTO unready FROM public.object_type_indexes i
   WHERE i.status = 'success' AND NOT public.object_type_index_ready(i.object_type_id);
  IF unready > 0 THEN
    RAISE EXCEPTION '% previously readable type(s) are now unready', unready;
  END IF;

  RAISE NOTICE '525: every index has a pipeline; the fallback arm is now unreachable';
END $$;
