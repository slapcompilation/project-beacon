-- 622 left two holes and both were caught by guards that already existed. An
-- applied migration cannot be edited, so the corrections land here.
--
-- ── 1. A LEDGER WRITER REACHABLE BY `authenticated` ─────────────────────────
-- `scheduledPathRls.test.ts` asserts every ledger helper is DEFINER, runnable
-- by `beacon_runner`, and NOT runnable by `authenticated` — "A ledger writer
-- reachable by authenticated is the forge 549 closed". `record_automation_run`
-- failed it after 622 dropped and recreated it.
--
-- WHY, and it is worth stating because it will happen again to the next new
-- function: Supabase ships ALTER DEFAULT PRIVILEGES granting EXECUTE on new
-- functions to `authenticated`. That is an EXPLICIT grant, so 622's
-- `REVOKE ALL ... FROM PUBLIC` did not touch it — PUBLIC and `authenticated`
-- are different grantees, and revoking one says nothing about the other. The
-- same default-ACL stamp is what 548-552 spent four migrations on for `anon`.
--
-- `record_automation_event` is new in 622 and carries the identical hole. It is
-- not in the guard's list, so nothing failed — which is the more dangerous of
-- the two, and it is added to that list in this change.
--
-- ── 2. A TABLE THAT DOES NOT SAY WHAT IT HOLDS ──────────────────────────────
-- `catalog.test.ts` requires a COMMENT on every public table. 622 added
-- `automation_events` without one.

REVOKE EXECUTE ON FUNCTION public.record_automation_run(uuid, uuid, uuid)
  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_automation_event(uuid, text, text)
  FROM authenticated;

COMMENT ON TABLE public.automation_events IS
  'One row per automation firing or metadata change. "Automation history tracks events related to condition evaluation and automation metadata changes for individual automations" (automate/history). The run rows are an event''s effect half and point back through automation_runs.event_id.';

-- Both directions, because a REVOKE that removed too much would also make the
-- first assertion pass. The runner must still be able to write the ledger.
DO $$
DECLARE r record; v_bad text[] := '{}';
BEGIN
  FOR r IN
    SELECT p.proname,
           has_function_privilege('beacon_runner', p.oid, 'EXECUTE') AS runner_can,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('record_automation_run', 'record_automation_event')
  LOOP
    IF r.auth_can THEN
      v_bad := v_bad || format('%s is still reachable by authenticated', r.proname);
    END IF;
    IF NOT r.runner_can THEN
      v_bad := v_bad || format('%s is no longer reachable by beacon_runner', r.proname);
    END IF;
  END LOOP;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '%', array_to_string(v_bad, '; ');
  END IF;
  RAISE NOTICE 'both ledger writers: the runner can, authenticated cannot';
END $$;

-- And the runner still works end to end after the revoke, because a privilege
-- change that breaks the path it protects is not a fix. Executed, not inspected.
DO $$
DECLARE v_proj uuid; v_owner uuid; v_a uuid; v_n int;
BEGIN
  BEGIN
    SELECT p.id INTO v_proj FROM public.projects p ORDER BY p.created_at LIMIT 1;
    SELECT u.id INTO v_owner FROM public.users u LIMIT 1;
    IF v_proj IS NULL OR v_owner IS NULL THEN
      RAISE EXCEPTION 'no project or user: 623 cannot re-run the path it just narrowed';
    END IF;

    INSERT INTO public.automations (project_id, display_name, owner_id, condition, scope)
    VALUES (v_proj, 'Probe 623', v_owner,
            '{"type":"time","cron":"0 9 * * *","timezone":"UTC"}'::jsonb, 'project')
    RETURNING id INTO v_a;

    PERFORM public.run_automations(timestamptz '2026-08-22 09:00+00');
    SELECT count(*) INTO v_n FROM public.automation_events
     WHERE automation_id = v_a AND event_type = 'automation_triggered';
    IF v_n < 1 THEN
      RAISE EXCEPTION 'the runner no longer records a firing after the revoke';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE 'the runner still opens an event after the revoke';
  END;
END $$;
