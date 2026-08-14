-- 513 broke the minute hand. Fixing it forward.
--
-- `run_stale_indexes` selected `ot.organization_id`, and `object_types` has no
-- such column — an object type reaches its organization through its PROJECT.
-- The function is called by `run_schedules`, which pg_cron runs every minute,
-- so from the moment 513 applied the whole heartbeat raised:
--
--   ERROR: column ot.organization_id does not exist
--
-- and schedules stopped running with it, because both calls share one command
-- string and the first statement aborts it.
--
-- What let it through: the migration's own assertions checked that the wiring
-- EXISTED — that run_schedules mentions run_stale_indexes, that the constraints
-- are there — and never ran the query. A NOT NULL column name is not visible to
-- a text search. The standing suite caught it on the next run, from the
-- schedules tests rather than the new ones, because those call the heartbeat
-- for real.
--
-- The lesson is narrow and worth keeping: an assertion that greps a function
-- body proves the edit landed, not that the function works. At least one
-- assertion per migration has to EXECUTE the thing.

CREATE OR REPLACE FUNCTION public.run_stale_indexes(p_at timestamptz DEFAULT clock_timestamp())
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE t record; u record; before text; ran int := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('beacon-run-stale-indexes')) THEN
    RETURN 0;
  END IF;
  before := current_setting('request.jwt.claims', true);

  FOR t IN
    SELECT ot.id, p.organization_id
      FROM public.object_types ot
      JOIN public.object_type_indexes i ON i.object_type_id = ot.id
      -- An object type reaches its organization through its project. A type
      -- with no project has no editor to impersonate, so it is skipped rather
      -- than indexed by nobody.
      JOIN public.projects p ON p.id = ot.project_id
     WHERE EXISTS (SELECT 1 FROM public.object_type_datasources ds
                    WHERE ds.object_type_id = ot.id)
       -- Arm one: the datasource moved. Arm two: six hours have passed and
       -- there are edits to persist. Both from the pages, both asked here.
       AND (i.status <> 'success'
            OR i.indexed_at IS NULL
            OR (EXISTS (SELECT 1 FROM public.object_edits e
                         WHERE e.object_type_id = ot.id AND e.applied_at > i.indexed_at)
                AND i.indexed_at < p_at - interval '6 hours'))
       -- Nothing already in flight for this type.
       AND NOT EXISTS (
         SELECT 1 FROM public.build_jobs bj JOIN public.builds b ON b.id = bj.build_id
          WHERE bj.output_object_type_id = ot.id
            AND b.status = 'RUNNING' AND bj.state IN ('WAITING', 'RUN_PENDING', 'RUNNING'))
     ORDER BY i.updated_at
     LIMIT 25
  LOOP
    SELECT u2.id, u2.role, u2.organization_id INTO u
      FROM public.users u2
     WHERE u2.organization_id = t.organization_id AND u2.role IN ('owner', 'admin')
     ORDER BY u2.created_at LIMIT 1;
    CONTINUE WHEN u IS NULL;
    BEGIN
      PERFORM set_config('request.jwt.claims',
        json_build_object('sub', u.id::text,
          'app_metadata', json_build_object('role', u.role, 'org_id', u.organization_id))::text, true);
      PERFORM public.run_index_build(ARRAY[t.id], false);
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
      ran := ran + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    END;
  END LOOP;
  RETURN ran;
END $$;
REVOKE ALL ON FUNCTION public.run_stale_indexes(timestamptz) FROM PUBLIC, anon, authenticated;

-- ── assertions ──────────────────────────────────────────────────────────────
-- These RUN it. 513's did not, which is why 513 shipped a broken column name.
DO $$
DECLARE n int;
BEGIN
  -- The query plans and executes against the real catalog.
  n := public.run_stale_indexes(now());
  IF n IS NULL THEN RAISE EXCEPTION 'run_stale_indexes returned nothing'; END IF;

  -- And the whole heartbeat runs, which is what pg_cron actually calls.
  PERFORM public.run_schedules(now());

  RAISE NOTICE '514: the heartbeat runs again (% stale index build(s) started)', n;
END $$;
