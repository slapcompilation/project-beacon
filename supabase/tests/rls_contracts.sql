-- ─────────────────────────────────────────────────────────────────────────────
-- RLS / scope contract tests — self-apply behavioral guard for the data layer.
--
-- The catalog guard (security_invariants.sql) proves the GRANTS are right; this
-- proves the BEHAVIOR is right: a tenant only ever reads its own scope, and an
-- explicit id parameter can't beat RLS. Auth is JWT-claims-based
-- (auth_hotel_id/org_id/role read auth.jwt() -> app_metadata), so we simulate
-- anon / hotel-A / hotel-B contexts in one transaction with set_config +
-- SET LOCAL ROLE — no seeded users needed. RAISES on any violation.
--
-- Run (needs a role that can SET ROLE anon/authenticated — e.g. the service role
-- or local superuser):
--   supabase db execute -f supabase/tests/rls_contracts.sql --linked
--   -- or paste into the SQL editor / run via the Supabase MCP execute_sql
--
-- Resolves its own fixtures (two populated hotels) and skips gracefully if the
-- environment lacks them, so it's safe on a fresh/empty DB.
--
-- Contracts:
--   C1  get_recent_activity (SECURITY DEFINER, filters auth_hotel_id) — hotel B
--       never sees a hotel-A stock log.
--   C2  aip_signal_counts (SECURITY INVOKER, explicit p_hotel_id) — passing
--       another hotel's id can't read its proposals; RLS wins. Own counts match
--       a direct RLS read.
--   C3  anon cannot EXECUTE the scoped definer read (revoked in 176/177).
--   C4  a non-admin cannot promote_agent (role gate; deny-path only, no write).
--   C5  production promotion requires a prior staging release (Gap D; deny-path).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_a uuid; v_org uuid; v_b uuid;
  v_b_pending int; v_expected int;
  v_log_a uuid; n int; qp int; leaked boolean; raised boolean; v_msg text;
  claims_a text; claims_b text;
BEGIN
  -- Resolve two distinct populated hotels (skip gracefully if the env lacks them).
  SELECT h.id, h.organization_id INTO v_a, v_org FROM hotels h
   WHERE EXISTS (SELECT 1 FROM stock_logs s WHERE s.hotel_id = h.id)
   ORDER BY (SELECT count(*) FROM stock_logs s WHERE s.hotel_id = h.id) DESC LIMIT 1;
  SELECT h.id INTO v_b FROM hotels h
   WHERE h.id <> v_a AND EXISTS (SELECT 1 FROM stock_logs s WHERE s.hotel_id = h.id) LIMIT 1;
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE NOTICE 'RLS contracts SKIPPED — need two hotels with stock_logs'; RETURN;
  END IF;

  -- True count of B's pending proposals (we're the definer here, RLS bypassed) —
  -- makes the cross-hotel assertion strict only when B has rows to leak.
  SELECT count(*) INTO v_b_pending FROM proposals WHERE hotel_id = v_b AND status = 'pending';

  claims_a := json_build_object('sub','00000000-0000-0000-0000-000000000001',
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','hotel_manager'))::text;
  claims_b := json_build_object('sub','00000000-0000-0000-0000-000000000002',
    'app_metadata', json_build_object('hotel_id', v_b::text, 'org_id', v_org::text, 'role','hotel_manager'))::text;

  -- ── C1: get_recent_activity — cross-hotel isolation ──
  PERFORM set_config('request.jwt.claims', claims_a, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM get_recent_activity(50);
  IF n = 0 THEN RAISE EXCEPTION 'C1a: hotel A sees 0 recent activity rows (expected >0)'; END IF;
  SELECT log_id INTO v_log_a FROM get_recent_activity(1);

  PERFORM set_config('request.jwt.claims', claims_b, true);
  SELECT bool_or(log_id = v_log_a) INTO leaked FROM get_recent_activity(2000);
  IF coalesce(leaked,false) THEN RAISE EXCEPTION 'C1b CROSS-HOTEL LEAK: hotel B sees hotel A log %', v_log_a; END IF;

  -- ── C2: aip_signal_counts — explicit id can't beat RLS ──
  PERFORM set_config('request.jwt.claims', claims_a, true);
  SELECT queue_pending INTO qp FROM aip_signal_counts(v_b);
  IF qp <> 0 THEN RAISE EXCEPTION 'C2a CROSS-HOTEL LEAK: A read % pending proposals for B via explicit id', qp; END IF;
  SELECT queue_pending INTO qp FROM aip_signal_counts(v_a);
  SELECT count(*) INTO v_expected FROM proposals WHERE hotel_id = v_a AND status = 'pending';
  IF qp <> v_expected THEN RAISE EXCEPTION 'C2b: aip_signal_counts(A)=% but direct RLS read=%', qp, v_expected; END IF;

  -- ── C3: anon cannot EXECUTE the scoped definer read ──
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  SET LOCAL ROLE anon;
  raised := false;
  BEGIN PERFORM get_recent_activity(5);
  EXCEPTION WHEN insufficient_privilege THEN raised := true; END;
  IF NOT raised THEN RAISE EXCEPTION 'C3: anon could EXECUTE get_recent_activity (expected permission denied)'; END IF;

  -- ── C4: non-admin cannot promote_agent (deny-path only, no write) ──
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', claims_a, true);
  SET LOCAL ROLE authenticated;
  raised := false;
  BEGIN PERFORM promote_agent('__contract_probe__','9.9.9','sandbox', 1.0, 1, 'contract test', NULL);
  EXCEPTION WHEN insufficient_privilege OR raise_exception THEN raised := true; END;
  IF NOT raised THEN RAISE EXCEPTION 'C4: non-admin was allowed to promote_agent (expected permission denied)'; END IF;

  -- ── C5: production promotion requires a prior staging release (Gap D) ──
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-000000000003',
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
  SET LOCAL ROLE authenticated;
  raised := false;
  BEGIN PERFORM promote_agent('__contract_probe__','9.9.9','production', 1.0, 1, 'contract test', NULL);
  EXCEPTION WHEN others THEN raised := true; v_msg := SQLERRM; END;
  IF NOT raised THEN RAISE EXCEPTION 'C5: production promotion allowed for an un-staged version (Gap D)'; END IF;
  IF position('staging' in v_msg) = 0 THEN RAISE EXCEPTION 'C5: prod blocked, but not by the staging gate: %', v_msg; END IF;

  RESET ROLE;
  RAISE NOTICE 'RLS contracts OK — C1/C2 cross-hotel isolation (B had % pending), C3 anon-denied, C4 role-gate, C5 staging-before-prod', v_b_pending;
END $$;
