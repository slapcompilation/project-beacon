-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 377 — twenty functions with nothing left to run against.
--
-- Trigger bodies and helpers for tables 373 dropped: automation cohort subjects,
-- authored action subjects, the action-log immutability guard, promotion
-- visibility, purpose resolution, document clearance and sensitivity ranking,
-- org policy get/set, team membership, scenario and event touch triggers, the
-- normal quantile a forecast used, and the time-series point helpers.
--
-- relationship_edges_write goes too: it was the INSTEAD OF trigger on the
-- projection, routing writes to a backing chosen by link type. With no link
-- types, every write it could route is refused by the edge CHECK first.
--
-- set_updated_at / touch_updated_at are kept-looking but reach nothing — no
-- surviving table carries a trigger using them. The ontology tables that need
-- one will declare it when they get it.
--
-- `pnpm check:shape` found all twenty by asking what reaches them, which is the
-- question that has caught every one of these sweeps.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  doomed text[] := ARRAY[
    '_normal_quantile','active_purpose','apply_promotion_visibility',
    'enforce_authored_action_subject','enforce_automation_cohort_subject',
    'get_org_policy','org_policy_numeric','refuse_action_log_edit',
    'relationship_edges_write','remove_team_member','scenarios_touch_updated_at',
    'sensitivity_rank','set_org_policy','set_updated_at','time_series_first_point',
    'time_series_last_point','touch_updated_at','update_events_updated_at',
    'update_member_role','user_doc_clearance'
  ];
  fn record; n int;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname = ANY(doomed)
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', fn.sig);
  END LOOP;

  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname='public' AND p.proname = ANY(doomed);
  IF n > 0 THEN RAISE EXCEPTION 'Migration 377: % function(s) survived', n; END IF;

  -- The ontology must still be reachable after a CASCADE this wide.
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='object_types') THEN
    RAISE EXCEPTION 'Migration 377: CASCADE reached object_types';
  END IF;
END $$;

COMMIT;

-- Two more surfaced once the CASCADE above removed their callers.
BEGIN;
DROP FUNCTION IF EXISTS public._normal_cdf(double precision) CASCADE;
DROP FUNCTION IF EXISTS public.time_series_points(uuid, text, timestamptz, timestamptz) CASCADE;
COMMIT;
