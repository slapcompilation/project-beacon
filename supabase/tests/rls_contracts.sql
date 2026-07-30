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
--   C6  get_overstock_candidates is service-role only — authenticated can't read
--       another hotel's stock through this SECURITY DEFINER fn (#235 leak fix).
--   C7  get_hotel_graph (SECURITY DEFINER, p_hotel_id) — a hotel-scoped user reads
--       its own graph but gets nothing for another hotel (migration 181).
--   C8  create_relationship_edge — an authenticated user can't write an edge into
--       another hotel's graph (migration 181 scope gate; deny-path, rolled back).
--   C9  ingest_pos_sale is service-role only — authenticated can't inject POS
--       sales / decrement another hotel's stock (migration 181).
--   C10 forecast_observations — a hotel only sees its own rows (RLS), and an
--       authenticated user can't record forecasts for another hotel (migration 183).
--   C13 get_chain_overview (SECURITY DEFINER, org-wide) — a non-admin/owner reads
--       nothing; an admin reads its whole org and no other org's hotels (migration 212).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_a uuid; v_org uuid; v_b uuid; v_org_hotels uuid[]; v_type uuid; v_iface uuid; v_other uuid;
  v_foreign_type uuid;
  v_b_pending int; v_expected int;
  v_log_a uuid; n int; qp int; leaked boolean; raised boolean; v_msg text;
  claims_a text; claims_b text; claims_admin text;
  v_doc uuid := '00000000-0000-00c8-0000-0000000000c8'; v_user uuid;
  v_doc2 uuid := '00000000-0000-00c8-0000-0000000000c9';
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

  -- v_org's hotels captured as definer (C13 compares against this, not an
  -- RLS-gated re-read of hotels, which would hide siblings and false-flag them).
  SELECT array_agg(id) INTO v_org_hotels FROM hotels WHERE organization_id = v_org;

  claims_a := json_build_object('sub','00000000-0000-0000-0000-000000000001',
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','hotel_manager'))::text;
  claims_b := json_build_object('sub','00000000-0000-0000-0000-000000000002',
    'app_metadata', json_build_object('hotel_id', v_b::text, 'org_id', v_org::text, 'role','hotel_manager'))::text;
  claims_admin := json_build_object('sub','00000000-0000-0000-0000-000000000009',
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text;

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

  -- ── C6: get_overstock_candidates is service-role only (no cross-tenant read) ──
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', claims_a, true);
  SET LOCAL ROLE authenticated;
  raised := false;
  BEGIN PERFORM count(*) FROM get_overstock_candidates(v_b, 2);
  EXCEPTION WHEN insufficient_privilege THEN raised := true; END;
  IF NOT raised THEN RAISE EXCEPTION 'C6: authenticated read overstock candidates for another hotel (cross-tenant leak)'; END IF;

  -- ── C7: get_hotel_graph — own-hotel reads, cross-hotel is empty ──
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', claims_a, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM get_hotel_graph(v_a, 5000, 0, now() - interval '3650 days');
  IF n = 0 THEN RAISE EXCEPTION 'C7a: hotel A sees 0 of its own graph edges (expected >0)'; END IF;
  SELECT count(*) INTO n FROM get_hotel_graph(v_b, 5000, 0, now() - interval '3650 days');
  IF n <> 0 THEN RAISE EXCEPTION 'C7b CROSS-HOTEL LEAK: hotel A read % of hotel B''s graph edges via get_hotel_graph', n; END IF;

  -- ── C8: create_relationship_edge — cross-hotel write denied (rolled back) ──
  raised := false;
  BEGIN
    PERFORM create_relationship_edge(v_b, 'variant', gen_random_uuid(), 'similar_to', 'variant', gen_random_uuid(), NULL);
  EXCEPTION WHEN insufficient_privilege THEN raised := true; END;
  IF NOT raised THEN RAISE EXCEPTION 'C8 CROSS-HOTEL WRITE: authenticated wrote an edge into hotel B''s graph'; END IF;

  -- ── C9: ingest_pos_sale is service-role only ──
  raised := false;
  BEGIN PERFORM ingest_pos_sale(v_a, gen_random_uuid(), 1, now(), 'contract-test', NULL);
  EXCEPTION WHEN insufficient_privilege THEN raised := true; END;
  IF NOT raised THEN RAISE EXCEPTION 'C9: authenticated could EXECUTE ingest_pos_sale (expected service-role only)'; END IF;

  -- ── C10: forecast_observations — RLS isolation + scoped write ──
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', claims_a, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM forecast_observations WHERE hotel_id = v_b;
  IF n <> 0 THEN RAISE EXCEPTION 'C10a CROSS-HOTEL LEAK: hotel A sees % of hotel B forecast_observations', n; END IF;
  raised := false;
  BEGIN PERFORM record_current_forecasts(v_b, 7);
  EXCEPTION WHEN insufficient_privilege THEN raised := true; END;
  IF NOT raised THEN RAISE EXCEPTION 'C10b: authenticated recorded forecasts for another hotel'; END IF;

  -- ── C11: document sensitivity — clearance gates reads (P8, LLM boundary) ──
  -- A restricted document (and its chunks — the content that reaches an LLM via
  -- match_document_chunks) must be invisible to an under-cleared reader, but
  -- visible to an admin. Setup as definer (RLS bypassed); cleaned up either way.
  -- uploaded_by_user_id has an FK to auth.users, so use a real one (skip if none).
  RESET ROLE;
  SELECT id INTO v_user FROM auth.users LIMIT 1;
  IF v_user IS NULL THEN
    RAISE NOTICE 'C11 SKIPPED — no auth.users to attribute the probe document to';
  ELSE
  DELETE FROM document_chunks WHERE document_id = v_doc;
  DELETE FROM documents WHERE id = v_doc;
  INSERT INTO documents (id, hotel_id, title, mime_type, storage_path, uploaded_by_user_id, sensitivity)
    VALUES (v_doc, v_a, 'P8 contract probe', 'text/plain', 'contract/probe.txt', v_user, 'restricted');
  INSERT INTO document_chunks (document_id, hotel_id, chunk_key, page, text_preview)
    VALUES (v_doc, v_a, 'probe_1_1', 1, 'restricted content');

  BEGIN
    -- hotel_manager (clearance = internal) sees neither the doc nor its chunks
    PERFORM set_config('request.jwt.claims', claims_a, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM documents WHERE id = v_doc;
    IF n <> 0 THEN RAISE EXCEPTION 'C11a CLEARANCE BREACH: hotel_manager read a restricted document'; END IF;
    SELECT count(*) INTO n FROM document_chunks WHERE document_id = v_doc;
    IF n <> 0 THEN RAISE EXCEPTION 'C11b CLEARANCE BREACH: hotel_manager read % restricted chunk(s) (LLM boundary leak)', n; END IF;

    -- admin (clearance = restricted) sees it — the gate blocks, not just hides-from-all
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', claims_admin, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM documents WHERE id = v_doc;
    IF n <> 1 THEN RAISE EXCEPTION 'C11c: admin could not read the restricted document (over-gated)'; END IF;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    DELETE FROM document_chunks WHERE document_id = v_doc;
    DELETE FROM documents WHERE id = v_doc;
    RAISE;
  END;
  RESET ROLE;
  DELETE FROM document_chunks WHERE document_id = v_doc;
  DELETE FROM documents WHERE id = v_doc;
  END IF;

  -- ── C12: purpose-based controls narrow reads below role (C-22) ──
  -- Same admin (clearance = restricted): under an 'operations' purpose a
  -- restricted doc is hidden; under 'compliance' it's visible. Purpose only
  -- narrows — it can never exceed the role clearance. Header simulates the
  -- x-beacon-purpose that PostgREST forwards from the client.
  IF v_user IS NOT NULL THEN
    RESET ROLE;
    DELETE FROM documents WHERE id = v_doc2;
    INSERT INTO documents (id, hotel_id, title, mime_type, storage_path, uploaded_by_user_id, sensitivity)
      VALUES (v_doc2, v_a, 'PBAC contract probe', 'text/plain', 'contract/pbac.txt', v_user, 'restricted');
    BEGIN
      PERFORM set_config('request.jwt.claims', claims_admin, true);
      SET LOCAL ROLE authenticated;
      PERFORM set_config('request.headers', '{"x-beacon-purpose":"operations"}', true);
      SELECT count(*) INTO n FROM documents WHERE id = v_doc2;
      IF n <> 0 THEN RAISE EXCEPTION 'C12a: admin under Operations purpose saw a restricted doc (purpose not narrowing)'; END IF;
      PERFORM set_config('request.headers', '{"x-beacon-purpose":"compliance"}', true);
      SELECT count(*) INTO n FROM documents WHERE id = v_doc2;
      IF n <> 1 THEN RAISE EXCEPTION 'C12b: admin under Compliance purpose could not see the restricted doc (over-narrowed)'; END IF;
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE; PERFORM set_config('request.headers', '', true);
      DELETE FROM documents WHERE id = v_doc2; RAISE;
    END;
    RESET ROLE;
    PERFORM set_config('request.headers', '', true);
    DELETE FROM documents WHERE id = v_doc2;
  END IF;

  -- ── C13: chain benchmarking is org-wide + owner/admin-gated (migration 212) ──
  -- A non-admin/owner sees nothing; an admin sees its whole org and no other org.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', claims_a, true);  -- hotel_manager
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM get_chain_overview(30);
  IF n <> 0 THEN RAISE EXCEPTION 'C13a: hotel_manager read % chain rows (expected 0 — owner/admin only)', n; END IF;

  PERFORM set_config('request.jwt.claims', claims_admin, true);  -- admin in v_org
  SELECT count(*) INTO qp FROM get_chain_overview(30);
  IF qp = 0 THEN RAISE EXCEPTION 'C13b: admin sees 0 chain rows (expected >=1 for its org)'; END IF;
  SELECT count(*) INTO n FROM get_chain_overview(30) co WHERE NOT (co.hotel_id = ANY(v_org_hotels));
  IF n <> 0 THEN RAISE EXCEPTION 'C13c CROSS-ORG LEAK: admin read % chain rows outside org %', n, v_org; END IF;

  -- ── C14: automations authoring is admin/owner-gated (Studio P1, migration 213) ──
  -- A non-admin/owner cannot author an automation (they can auto-execute actions);
  -- an admin can, with org + author set server-side from identity. Needs a real
  -- auth.users id as the JWT sub so the created_by FK + WITH CHECK (= auth.uid()) hold.
  IF v_user IS NOT NULL THEN
    RESET ROLE;
    DELETE FROM automations WHERE name = '__contract_probe__';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','hotel_manager'))::text, true);
    SET LOCAL ROLE authenticated;
    raised := false;
    BEGIN
      INSERT INTO automations (name, when_metric, when_op, when_value, effect)
        VALUES ('__contract_probe__', 'units_below_par', 'gt', 0, 'REQUEST_RESTOCK');
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN raised := true;
    END;
    IF NOT raised THEN
      RESET ROLE; DELETE FROM automations WHERE name = '__contract_probe__';
      RAISE EXCEPTION 'C14a: hotel_manager authored an automation (expected admin/owner-only)';
    END IF;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO automations (name, when_metric, when_op, when_value, effect)
      VALUES ('__contract_probe__', 'units_below_par', 'gt', 0, 'REQUEST_RESTOCK');
    SELECT count(*) INTO n FROM automations WHERE name = '__contract_probe__';
    RESET ROLE;
    DELETE FROM automations WHERE name = '__contract_probe__';
    IF n <> 1 THEN RAISE EXCEPTION 'C14b: admin could not author an automation (org/author defaults or check failed)'; END IF;
  END IF;

  -- ── C15: object type authoring is admin/owner-gated (Studio P2, migration 214) ──
  -- Schema shapes the ontology, so a non-admin/owner can't author an object_type;
  -- an admin can, with org + author set server-side from identity.
  IF v_user IS NOT NULL THEN
    RESET ROLE;
    DELETE FROM object_types WHERE api_name = '__contract_probe__';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','hotel_manager'))::text, true);
    SET LOCAL ROLE authenticated;
    raised := false;
    BEGIN
      INSERT INTO object_types (api_name, label) VALUES ('__contract_probe__', 'Probe');
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN raised := true;
    END;
    IF NOT raised THEN
      RESET ROLE; DELETE FROM object_types WHERE api_name = '__contract_probe__';
      RAISE EXCEPTION 'C15a: hotel_manager authored an object type (expected admin/owner-only)';
    END IF;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO object_types (api_name, label) VALUES ('__contract_probe__', 'Probe');
    SELECT count(*) INTO n FROM object_types WHERE api_name = '__contract_probe__';
    RESET ROLE;
    DELETE FROM object_types WHERE api_name = '__contract_probe__';
    IF n <> 1 THEN RAISE EXCEPTION 'C15b: admin could not author an object type (org/author defaults or check failed)'; END IF;
  END IF;

  -- ── C16: link type authoring is admin/owner-gated (Studio P2.3, migration 215) ──
  IF v_user IS NOT NULL THEN
    RESET ROLE;
    DELETE FROM object_types WHERE api_name = '__probe_type__';
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO object_types (api_name, label) VALUES ('__probe_type__', 'Probe') RETURNING id INTO v_type;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','hotel_manager'))::text, true);
    SET LOCAL ROLE authenticated;
    raised := false;
    BEGIN
      INSERT INTO link_types (source_object_type_id, target_object_type_id, api_name, label) VALUES (v_type, v_type, 'rel', 'Rel');
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN raised := true;
    END;
    IF NOT raised THEN
      RESET ROLE; DELETE FROM object_types WHERE id = v_type;
      RAISE EXCEPTION 'C16a: hotel_manager authored a link type (expected admin/owner-only)';
    END IF;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO link_types (source_object_type_id, target_object_type_id, api_name, label) VALUES (v_type, v_type, 'rel', 'Rel');
    SELECT count(*) INTO n FROM link_types WHERE source_object_type_id = v_type;
    RESET ROLE;
    DELETE FROM object_types WHERE id = v_type;   -- cascades the link type
    IF n <> 1 THEN RAISE EXCEPTION 'C16b: admin could not author a link type'; END IF;
  END IF;

  -- ── C17: model releases are server-gated (promote_model) ──────────────────
  -- The web client used to hold the only eval gate, and model_releases had no
  -- role check at all, so any org member could POST a production release.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','hotel_manager'))::text, true);
  SET LOCAL ROLE authenticated;
  raised := false;
  BEGIN
    PERFORM promote_model('consumption_forecast', '__c17__', '0.0.1', 'sandbox');
  EXCEPTION WHEN insufficient_privilege THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM model_releases WHERE adapter_name = '__c17__';
    RAISE EXCEPTION 'C17a: hotel_manager promoted a model (expected admin/owner-only)';
  END IF;

  -- Direct table write must be denied too — the RPC is not a bypassable wrapper.
  raised := false;
  BEGIN
    INSERT INTO model_releases (organization_id, objective_name, adapter_name, adapter_version, stage, tag)
    VALUES (v_org, 'consumption_forecast', '__c17__', '0.0.1', 'production', 'c17');
  EXCEPTION WHEN insufficient_privilege THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM model_releases WHERE adapter_name = '__c17__';
    RAISE EXCEPTION 'C17b: hotel_manager inserted a release directly';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
  SET LOCAL ROLE authenticated;

  -- Production without a recorded eval is blocked even for an admin.
  raised := false;
  BEGIN
    PERFORM promote_model('consumption_forecast', '__c17__', '0.0.1', 'production');
  EXCEPTION WHEN check_violation THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM model_releases WHERE adapter_name = '__c17__';
    RAISE EXCEPTION 'C17c: admin promoted to production with no recorded eval';
  END IF;

  -- Sandbox needs no eval; admin can release.
  PERFORM promote_model('consumption_forecast', '__c17__', '0.0.1', 'sandbox');
  SELECT count(*) INTO n FROM model_releases WHERE adapter_name = '__c17__' AND stage = 'sandbox';
  IF n <> 1 THEN
    RESET ROLE; DELETE FROM model_releases WHERE adapter_name = '__c17__';
    RAISE EXCEPTION 'C17d: admin could not release to sandbox';
  END IF;

  -- C17e: staging before production. A passing eval is not enough — the adapter
  -- must be the one currently on staging, and that check reports first.
  RESET ROLE;
  INSERT INTO model_eval_runs (organization_id, objective_name, adapter_name, adapter_version, dataset, metric, value, case_count)
  VALUES (v_org, 'consumption_forecast', '__c17__', '0.0.1', 'probe', 'mape', 0.05, 10);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
  SET LOCAL ROLE authenticated;
  raised := false;
  BEGIN
    PERFORM promote_model('consumption_forecast', '__c17__', '0.0.1', 'production');
  EXCEPTION WHEN check_violation THEN raised := true; v_msg := SQLERRM;
  END;
  IF NOT raised OR v_msg NOT LIKE '%promote it to staging first%' THEN
    RESET ROLE;
    DELETE FROM model_releases  WHERE adapter_name = '__c17__';
    DELETE FROM model_eval_runs WHERE adapter_name = '__c17__';
    RAISE EXCEPTION 'C17e: unstaged adapter reached production (or wrong reason): %', coalesce(v_msg, 'no error');
  END IF;

  -- Stage it, then production is allowed.
  PERFORM promote_model('consumption_forecast', '__c17__', '0.0.1', 'staging');
  PERFORM promote_model('consumption_forecast', '__c17__', '0.0.1', 'production');
  SELECT count(*) INTO n FROM model_releases WHERE adapter_name = '__c17__' AND stage = 'production';
  RESET ROLE;
  DELETE FROM model_releases  WHERE adapter_name = '__c17__';
  DELETE FROM model_eval_runs WHERE adapter_name = '__c17__';
  IF n <> 1 THEN RAISE EXCEPTION 'C17e: staged adapter could not reach production'; END IF;

  -- ── C18: authored Logic Tools are admin-authored + DB-grammar-checked ─────
  -- Needs its own subject type: the C15/C16 probe type was already dropped.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO object_types (api_name, label) VALUES ('c18_probe_type', 'C18 Probe') RETURNING id INTO v_type;
  RESET ROLE;

  IF v_type IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','hotel_manager'))::text, true);
    SET LOCAL ROLE authenticated;
    raised := false;
    BEGIN
      INSERT INTO user_tools (name, api_name, subject_type_id, aggregation)
      VALUES ('probe', 'c18_probe', v_type, '{"fn":"count"}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN raised := true;
    END;
    IF NOT raised THEN
      RESET ROLE; DELETE FROM object_types WHERE id = v_type;   -- cascades the tool
      RAISE EXCEPTION 'C18a: hotel_manager authored a Logic Tool (expected admin/owner-only)';
    END IF;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
    SET LOCAL ROLE authenticated;

    -- The database is the last word on the grammar, not the composer: an
    -- aggregation that reduces a property must name one.
    raised := false;
    BEGIN
      INSERT INTO user_tools (name, api_name, subject_type_id, aggregation)
      VALUES ('bad', 'c18_bad', v_type, '{"fn":"sum"}'::jsonb);
    EXCEPTION WHEN check_violation THEN raised := true;
    END;
    IF NOT raised THEN
      RESET ROLE; DELETE FROM object_types WHERE id = v_type;
      RAISE EXCEPTION 'C18b: DB accepted a sum tool with no property';
    END IF;

    INSERT INTO user_tools (name, api_name, subject_type_id, aggregation)
    VALUES ('probe', 'c18_probe', v_type, '{"fn":"count"}'::jsonb);
    SELECT count(*) INTO n FROM user_tools
     WHERE api_name = 'c18_probe' AND organization_id = v_org AND created_by_user_id = v_user;
    RESET ROLE;
    DELETE FROM object_types WHERE id = v_type;   -- cascades the tool
    IF n <> 1 THEN RAISE EXCEPTION 'C18c: admin could not author a Logic Tool, or org/author defaults did not land'; END IF;
  END IF;

  -- ── C19: authored agents are admin-authored + DB-shape-checked ────────────
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','hotel_manager'))::text, true);
  SET LOCAL ROLE authenticated;
  raised := false;
  BEGIN
    INSERT INTO user_agents (name, api_name, purpose, toolset, procedure)
    VALUES ('probe', 'c19_probe', 'p', '["forecast_consumption"]'::jsonb, '[{"instruction":"go"}]'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM user_agents WHERE api_name LIKE 'c19_%';
    RAISE EXCEPTION 'C19a: hotel_manager authored an agent (expected admin/owner-only)';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
  SET LOCAL ROLE authenticated;

  -- An agent with no tools could only guess; one with no steps is a prompt.
  raised := false;
  BEGIN
    INSERT INTO user_agents (name, api_name, purpose, toolset, procedure)
    VALUES ('probe', 'c19_probe', 'p', '[]'::jsonb, '[{"instruction":"go"}]'::jsonb);
  EXCEPTION WHEN check_violation THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM user_agents WHERE api_name LIKE 'c19_%';
    RAISE EXCEPTION 'C19b: DB accepted an agent with an empty toolset';
  END IF;

  raised := false;
  BEGIN
    INSERT INTO user_agents (name, api_name, purpose, toolset, procedure)
    VALUES ('probe', 'c19_probe', 'p', '["forecast_consumption"]'::jsonb, '[]'::jsonb);
  EXCEPTION WHEN check_violation THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM user_agents WHERE api_name LIKE 'c19_%';
    RAISE EXCEPTION 'C19c: DB accepted an agent with no procedure';
  END IF;

  INSERT INTO user_agents (name, api_name, purpose, toolset, procedure)
  VALUES ('probe', 'c19_probe', 'p', '["forecast_consumption"]'::jsonb, '[{"instruction":"go"}]'::jsonb);
  SELECT count(*) INTO n FROM user_agents
   WHERE api_name = 'c19_probe' AND organization_id = v_org AND created_by_user_id = v_user;
  RESET ROLE;
  DELETE FROM user_agents WHERE api_name LIKE 'c19_%';
  IF n <> 1 THEN RAISE EXCEPTION 'C19d: admin could not author an agent, or org/author defaults did not land'; END IF;

  -- ── C20: built-in object types are code-owned (migration 223) ─────────────
  -- One ontology: built-ins are registered so links and tools can reach them,
  -- but no user may edit or delete them — not even an admin.
  RESET ROLE;
  SELECT id INTO v_type FROM object_types
   WHERE organization_id = v_org AND kind = 'builtin' AND api_name = 'variant';
  IF v_type IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
      'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
    SET LOCAL ROLE authenticated;

    UPDATE object_types SET label = 'Tampered' WHERE id = v_type;
    SELECT count(*) INTO n FROM object_types WHERE id = v_type AND label = 'Variant';
    IF n <> 1 THEN RESET ROLE; RAISE EXCEPTION 'C20a: admin edited a built-in object type'; END IF;

    DELETE FROM object_types WHERE id = v_type;
    SELECT count(*) INTO n FROM object_types WHERE id = v_type;
    IF n <> 1 THEN RESET ROLE; RAISE EXCEPTION 'C20b: admin deleted a built-in object type'; END IF;
    RESET ROLE;
  END IF;

  -- ── C21: an interface claim must be TRUE (migration 224) ──────────────────
  -- Polymorphism that lies is worse than none: a tool written against the
  -- interface would break at read time on a type that never had the shape.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
  SET LOCAL ROLE authenticated;

  INSERT INTO object_types (api_name, label, properties)
  VALUES ('c21_conforms', 'C21 Conforms', '[{"key":"room","label":"Room","type":"text","required":true}]'::jsonb)
  RETURNING id INTO v_type;
  INSERT INTO ontology_interfaces (api_name, label, properties)
  VALUES ('c21_roomed', 'C21 Roomed', '[{"key":"room","label":"Room","type":"text"}]'::jsonb)
  RETURNING id INTO v_iface;

  -- the honest claim is accepted
  INSERT INTO object_type_interfaces (object_type_id, interface_id) VALUES (v_type, v_iface);
  SELECT count(*) INTO n FROM object_type_interfaces WHERE interface_id = v_iface;
  IF n <> 1 THEN
    RESET ROLE; DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id = v_type;
    RAISE EXCEPTION 'C21a: a conforming type could not implement the interface';
  END IF;

  -- a type without the shape must be refused
  INSERT INTO object_types (api_name, label, properties)
  VALUES ('c21_lacks', 'C21 Lacks', '[{"key":"floor","label":"Floor","type":"number","required":false}]'::jsonb)
  RETURNING id INTO v_other;
  raised := false;
  BEGIN
    INSERT INTO object_type_interfaces (object_type_id, interface_id) VALUES (v_other, v_iface);
  EXCEPTION WHEN check_violation THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
    RAISE EXCEPTION 'C21b: DB accepted a false interface claim';
  END IF;

  -- ── C22: a tool has exactly one subject, and it must be readable (mig 225) ─
  -- An interface-targeted tool is how one definition survives new types; a tool
  -- over both a type and an interface has no defined record set at all.
  raised := false;
  BEGIN
    INSERT INTO user_tools (name, api_name, subject_type_id, subject_interface_id, aggregation)
    VALUES ('C22 both', 'c22_both', v_type, v_iface, '{"fn":"count"}'::jsonb);
  EXCEPTION WHEN check_violation THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
    RAISE EXCEPTION 'C22a: a tool claiming both a type and an interface was accepted';
  END IF;

  -- the interface-targeted tool itself is legitimate
  INSERT INTO user_tools (name, api_name, subject_type_id, subject_interface_id, aggregation)
  VALUES ('C22 roomed', 'c22_roomed', NULL, v_iface, '{"fn":"count"}'::jsonb);
  SELECT count(*) INTO n FROM user_tools WHERE api_name = 'c22_roomed';
  IF n <> 1 THEN
    RESET ROLE; DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
    RAISE EXCEPTION 'C22b: an admin could not author a tool targeting an interface';
  END IF;

  -- A subject the author cannot read is never a legitimate tool. Only assertable
  -- where a second org exists — with one org the FK would reject any id we could
  -- invent, which would pass this for the wrong reason.
  RESET ROLE;
  SELECT id INTO v_foreign_type FROM object_types WHERE organization_id <> v_org LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
  SET LOCAL ROLE authenticated;
  IF v_foreign_type IS NOT NULL THEN
    raised := false;
    BEGIN
      INSERT INTO user_tools (name, api_name, subject_type_id, aggregation)
      VALUES ('C22 foreign', 'c22_foreign', v_foreign_type, '{"fn":"count"}'::jsonb);
    EXCEPTION WHEN insufficient_privilege THEN raised := true;
    END;
    IF NOT raised THEN
      RESET ROLE; DELETE FROM user_tools WHERE api_name LIKE 'c22%';
      DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
      RAISE EXCEPTION 'C22c CROSS-ORG: a tool over another org''s object type was accepted';
    END IF;
  END IF;

  -- ── C23: tool parameter grammar is enforced by the DB (migration 226) ─────
  -- Parameters are the tool's typed input schema; a malformed one would reach
  -- an LLM as an uncallable tool. The composer is one client, not the authority.
  FOR v_msg IN SELECT unnest(ARRAY[
    '[{"key":"Is Urgent","label":"x","type":"boolean","required":true}]',   -- not lower_snake
    '[{"key":"x","label":"x","type":"json","required":true}]',              -- unknown type
    '[{"key":"x","label":"x","type":"text","required":"yes"}]'             -- required isn't boolean
  ]) LOOP
    raised := false;
    BEGIN
      INSERT INTO user_tools (name, api_name, subject_type_id, parameters, aggregation)
      VALUES ('C23', 'c23_bad', v_type, v_msg::jsonb, '{"fn":"count"}'::jsonb);
    EXCEPTION WHEN check_violation THEN raised := true;
    END;
    IF NOT raised THEN
      RESET ROLE; DELETE FROM user_tools WHERE api_name LIKE 'c2%';
      DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
      RAISE EXCEPTION 'C23a: DB accepted a malformed tool parameter: %', v_msg;
    END IF;
  END LOOP;

  INSERT INTO user_tools (name, api_name, subject_type_id, parameters, filters, aggregation)
  VALUES ('C23 ok', 'c23_ok', v_type,
          '[{"key":"is_urgent","label":"Urgent?","type":"boolean","required":true}]'::jsonb,
          '[{"property":"room","op":"eq","value":"x","param":"is_urgent"}]'::jsonb,
          '{"fn":"count"}'::jsonb);
  SELECT count(*) INTO n FROM user_tools WHERE api_name = 'c23_ok';
  IF n <> 1 THEN
    RESET ROLE; DELETE FROM user_tools WHERE api_name LIKE 'c2%';
    DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
    RAISE EXCEPTION 'C23b: a well-formed parameterised tool was rejected';
  END IF;

  -- ── C24: cohorts are admin-authored and have exactly one subject ──────────
  -- A cohort becomes the subject of automations and tools, so widening who can
  -- author one widens what they act on. Same gate as the tool it will feed.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','hotel_manager'))::text, true);
  SET LOCAL ROLE authenticated;
  raised := false;
  BEGIN
    INSERT INTO object_sets (name, api_name, subject_type_id) VALUES ('C24', 'c24_probe', v_type);
  EXCEPTION WHEN insufficient_privilege THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM object_sets WHERE api_name LIKE 'c24_%';
    DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
    RAISE EXCEPTION 'C24a: hotel_manager authored a cohort (expected admin/owner-only)';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text,
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text, true);
  SET LOCAL ROLE authenticated;

  -- A set over both a type and an interface has no defined membership.
  raised := false;
  BEGIN
    INSERT INTO object_sets (name, api_name, subject_type_id, subject_interface_id)
    VALUES ('C24 both', 'c24_both', v_type, v_iface);
  EXCEPTION WHEN check_violation THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM object_sets WHERE api_name LIKE 'c24_%';
    DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
    RAISE EXCEPTION 'C24b: a cohort claiming both a type and an interface was accepted';
  END IF;

  INSERT INTO object_sets (name, api_name, subject_interface_id, filters)
  VALUES ('C24 ok', 'c24_ok', v_iface, '[{"property":"room","op":"eq","value":"x"}]'::jsonb);
  SELECT count(*) INTO n FROM object_sets
   WHERE api_name = 'c24_ok' AND organization_id = v_org AND created_by_user_id = v_user;
  IF n <> 1 THEN
    RESET ROLE; DELETE FROM object_sets WHERE api_name LIKE 'c24_%';
    DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
    RAISE EXCEPTION 'C24c: admin could not author a cohort, or org/author defaults did not land';
  END IF;

  RESET ROLE;
  DELETE FROM object_sets WHERE api_name LIKE 'c24_%';
  DELETE FROM user_tools WHERE api_name LIKE 'c2%';
  DELETE FROM ontology_interfaces WHERE id = v_iface;
  DELETE FROM object_types WHERE id IN (v_type, v_other);

  RESET ROLE;
  RAISE NOTICE 'RLS contracts OK — C1/C2 cross-hotel isolation (B had % pending), C3 anon-denied, C4 role-gate, C5 staging-before-prod, C6 overstock + C9 pos-sale service-role-only, C7 graph-read + C8 graph-write scope-gated, C10 forecast_observations scoped, C11 doc-sensitivity clearance-gated, C12 purpose-based narrowing, C13 chain org-wide + owner/admin-gated, C14 automations admin-authored, C15 object types admin-authored, C16 link types admin-authored, C17 model releases server-gated + staging-before-production, C18 authored tools admin-only + grammar-checked, C19 authored agents admin-only + shape-checked, C20 built-in object types code-owned, C21 interface claims verified, C22 tools have exactly one readable subject, C23 tool parameter grammar DB-enforced, C24 cohorts admin-authored + one subject', v_b_pending;
END $$;
