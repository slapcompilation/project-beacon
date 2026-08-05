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
--   C28 a module authored at hotel A is invisible at hotel B until B INSTALLS it,
--       and its widgets travel with it (migration 311). Verified under a
--       hotel-scoped role on purpose: hotel_is_in_user_scope() returns true for
--       every hotel in the org once auth_org_role() is set, so an org-level user
--       could see the module either way and would prove nothing.
--   C30 a project role grant delegates editor to a non-admin WITHIN the org and
--       confers nothing outside it — discretionary access inside the mandatory
--       boundary (gap 6, migration 330).
--   C29 an active object type cannot be deleted or renamed by an admin, and
--       deprecating one reaches its link types — under `authenticated`, because
--       as the owner every one of these passes vacuously (migrations 321/323).
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
  -- Resolve two distinct hotels (skip gracefully if the env lacks them). This
  -- used to rank them by stock_logs count, which the hospitality teardown
  -- dropped; the assertions below never needed inventory, only two tenants.
  SELECT h.id, h.organization_id INTO v_a, v_org FROM hotels h ORDER BY h.created_at LIMIT 1;
  SELECT h.id INTO v_b FROM hotels h WHERE h.id <> v_a LIMIT 1;
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE NOTICE 'RLS contracts SKIPPED — need two hotels'; RETURN;
  END IF;

  -- makes the cross-hotel assertion strict only when B has rows to leak.

  -- v_org's hotels captured as definer (C13 compares against this, not an
  -- RLS-gated re-read of hotels, which would hide siblings and false-flag them).
  SELECT array_agg(id) INTO v_org_hotels FROM hotels WHERE organization_id = v_org;

  claims_a := json_build_object('sub','00000000-0000-0000-0000-000000000001',
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','hotel_manager'))::text;
  claims_b := json_build_object('sub','00000000-0000-0000-0000-000000000002',
    'app_metadata', json_build_object('hotel_id', v_b::text, 'org_id', v_org::text, 'role','hotel_manager'))::text;
  claims_admin := json_build_object('sub','00000000-0000-0000-0000-000000000009',
    'app_metadata', json_build_object('hotel_id', v_a::text, 'org_id', v_org::text, 'role','admin'))::text;

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

  -- ── C20: built-in object types are code-owned (migration 223) ─────────────
  -- One ontology: built-ins are registered so links and tools can reach them,
  -- but no user may edit or delete them — not even an admin.
  RESET ROLE;
  SELECT id INTO v_type FROM object_types
   WHERE organization_id = v_org AND source_table IS NOT NULL AND api_name = 'variant';
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

  -- ── C25: the edge vocabulary is DB-enforced, not TypeScript-only ──────────
  -- Until migration 252 there was no CHECK here at all, which is how one name
  -- came to mean two relationships without anything objecting.
  raised := false;
  BEGIN
    INSERT INTO relationship_edges (hotel_id, edge_type, source_type, source_id, target_type, target_id, triggered_by)
    VALUES (v_a, 'not_a_real_edge_type', 'stock_log', gen_random_uuid(), 'variant', gen_random_uuid(), 'system');
  EXCEPTION WHEN check_violation THEN raised := true;
  END;
  IF NOT raised THEN
    RESET ROLE; DELETE FROM relationship_edges WHERE edge_type = 'not_a_real_edge_type';
    DELETE FROM object_sets WHERE api_name LIKE 'c24_%';
    DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
    RAISE EXCEPTION 'C25a: the database accepted an edge type outside the vocabulary';
  END IF;

  -- The retired property-shaped edges must stay retired.
  FOR v_msg IN SELECT unnest(ARRAY['belongs_to_hotel','created_by','belongs_to_org']) LOOP
    raised := false;
    BEGIN
      INSERT INTO relationship_edges (hotel_id, edge_type, source_type, source_id, target_type, target_id, triggered_by)
      VALUES (v_a, v_msg, 'stock_log', gen_random_uuid(), 'hotel', v_a, 'system');
    EXCEPTION WHEN check_violation THEN raised := true;
    END;
    IF NOT raised THEN
      RESET ROLE; DELETE FROM relationship_edges WHERE edge_type = v_msg;
      DELETE FROM object_sets WHERE api_name LIKE 'c24_%';
      DELETE FROM ontology_interfaces WHERE id = v_iface; DELETE FROM object_types WHERE id IN (v_type, v_other);
      RAISE EXCEPTION 'C25b: % was accepted — tenancy/authorship are properties, not links', v_msg;
    END IF;
  END LOOP;

  -- ── C26: a join-backed relationship agrees with its link table ────────────
  -- relationship_edges is a PROJECTION of the backings since migration 260, but
  -- several writers still insert into it directly. For the seven join-backed
  -- relationships the link_* table is the real store, so an edge with no matching
  -- link row means a writer bypassed the backing and the link table is going
  -- stale. Catch that here rather than discovering it as missing traversals.
  -- Derived from link_types, not listed here. The list used to be hardcoded and
  -- broke the moment four join-backed link types were removed (migration 352) —
  -- a contract that has to be edited whenever the ontology changes is a contract
  -- that will be edited wrongly. `object_links` is excluded because it backs
  -- authored links generically rather than one relationship.
  FOR v_msg IN
    SELECT lt.edge_type FROM public.link_types lt
     WHERE lt.backing_kind = 'join_table'
       AND lt.backing_table LIKE 'link\_%'
       AND lt.edge_type IS NOT NULL
     GROUP BY lt.edge_type
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM relationship_edges e WHERE e.edge_type = %L
         AND NOT EXISTS (SELECT 1 FROM public.%I l
                         WHERE l.source_id = e.source_id AND l.target_id = e.target_id)',
      v_msg, 'link_' || v_msg) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION
        'C26: % edge(s) of type "%" have no row in link_% — a writer is bypassing the backing, which is now the source of truth (migrations 258/260).',
        n, v_msg, v_msg;
    END IF;
  END LOOP;

  -- ── C29: ontology status holds for an operator, not just for the owner ──
  -- The guards and the cascade are triggers, and migrations run as the table
  -- owner — which bypasses RLS and proved nothing about a browser session. The
  -- cascade shipped broken exactly this way (migration 323): link_types has no
  -- UPDATE policy, so as SECURITY INVOKER it updated zero rows and left a
  -- deprecated object type wired to an active link, silently. Proven here under
  -- `authenticated`, which is the only role that can catch it.
  RESET ROLE;
  DECLARE
    v_ca uuid; v_cb uuid; v_clink uuid; v_st text; blocked boolean;
  BEGIN
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'c29_a', 'C29 A', NULL) RETURNING id INTO v_ca;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'c29_b', 'C29 B', NULL) RETURNING id INTO v_cb;
    INSERT INTO link_types (organization_id, source_object_type_id, target_object_type_id,
                            api_name, label, target_api_name, target_label,
                            cardinality, backing_kind, backing_table, created_by_user_id)
    VALUES (v_org, v_ca, v_cb, 'c29_link', 'C29', 'c29_link', 'C29',
            'many_to_many', 'join_table', 'object_links', NULL) RETURNING id INTO v_clink;
    UPDATE object_types SET status = 'active' WHERE id IN (v_ca, v_cb);
    UPDATE link_types SET status = 'active' WHERE id = v_clink;

    PERFORM set_config('request.jwt.claims', claims_admin, true);
    SET LOCAL ROLE authenticated;

    -- "A resource's status must be experimental or deprecated before it can be
    -- deleted." An admin is still refused.
    blocked := false;
    BEGIN
      DELETE FROM object_types WHERE id = v_ca;
    EXCEPTION WHEN raise_exception THEN blocked := true;
    END;
    IF NOT blocked THEN
      RAISE EXCEPTION 'C29: an admin deleted an active object type';
    END IF;

    -- "The API name of an active resource cannot be changed."
    blocked := false;
    BEGIN
      UPDATE object_types SET api_name = 'c29_a_renamed' WHERE id = v_ca;
    EXCEPTION WHEN raise_exception THEN blocked := true;
    END;
    IF NOT blocked THEN
      RAISE EXCEPTION 'C29: an admin renamed an active object type';
    END IF;

    -- Deprecating one end must reach the link, through a policy the operator
    -- does not have.
    UPDATE object_types SET status = 'deprecated', deprecation_reason = 'c29',
           deprecation_deadline = current_date + 30 WHERE id = v_ca;
    RESET ROLE;
    SELECT status INTO v_st FROM link_types WHERE id = v_clink;
    IF v_st <> 'deprecated' THEN
      RAISE EXCEPTION
        'C29: an admin deprecated an object type and its link stayed "%" — the cascade is invisible to operators again', v_st;
    END IF;

    -- Tearing down needs the same demotion a real retirement does — the guard
    -- reads auth.uid(), and the claims outlive RESET ROLE.
    RESET ROLE;
    UPDATE object_types SET status = 'experimental' WHERE id IN (v_ca, v_cb);
    DELETE FROM link_types WHERE id = v_clink;
    DELETE FROM object_types WHERE id IN (v_ca, v_cb);
  END;

  -- ── C30: a project role delegates within an org and never across one ──────
  -- Gap 6 closed by migration 330. Two things have to hold at once, and the
  -- second is the one that makes the first safe: a grant WIDENS what a non-admin
  -- may do inside their organization, and a grant is worth NOTHING outside it.
  -- Foundry: "mandatory controls, Organizations and Markings, will always
  -- prevent an ineligible user from accessing a resource, regardless of the
  -- user's role."
  RESET ROLE;
  DECLARE
    v_proj uuid; v_ptype uuid; v_grantee uuid; held boolean;
  BEGIN
    SELECT u.id INTO v_grantee FROM auth.users u LIMIT 1;

    INSERT INTO projects (organization_id, api_name, name, created_by_user_id)
    VALUES (v_org, 'c30_project', 'C30', NULL) RETURNING id INTO v_proj;
    INSERT INTO object_types (organization_id, api_name, label, created_by_user_id)
    VALUES (v_org, 'c30_type', 'C30 Type', NULL) RETURNING id INTO v_ptype;
    INSERT INTO project_resources (resource_kind, resource_id, project_id, organization_id)
    VALUES ('object_type', v_ptype, v_proj, v_org);
    -- granted_by defaults to auth.uid(), and this suite's JWT subs are synthetic
    -- (same trap as C28) — name the column and leave it null.
    INSERT INTO project_role_grants (project_id, user_id, role, organization_id, granted_by)
    VALUES (v_proj, v_grantee, 'editor', v_org, NULL);

    -- The grantee, as a plain member of this org, inherits editor via the project.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_grantee,
      'app_metadata', json_build_object('org_id', v_org::text, 'role', 'team_member'))::text, true);
    SET LOCAL ROLE authenticated;
    SELECT has_resource_role('object_type', v_ptype, 'editor') INTO held;
    IF NOT held THEN
      RAISE EXCEPTION 'C30: an editor grant did not inherit from the project to its resource';
    END IF;
    SELECT has_resource_role('object_type', v_ptype, 'owner') INTO held;
    IF held THEN
      RAISE EXCEPTION 'C30: an editor grant conferred owner';
    END IF;

    -- The SAME grant row, read from another organization, confers nothing.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_grantee,
      'app_metadata', json_build_object('org_id', '00000000-0000-0000-0000-0000000000fe',
                                        'role', 'admin'))::text, true);
    SELECT has_resource_role('object_type', v_ptype, 'editor') INTO held;
    IF held THEN
      RAISE EXCEPTION 'C30: a project role crossed an organization boundary — discretionary beat mandatory';
    END IF;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', claims_admin, true);
    DELETE FROM project_role_grants WHERE project_id = v_proj;
    DELETE FROM project_resources WHERE project_id = v_proj;
    DELETE FROM projects WHERE id = v_proj;
    DELETE FROM object_types WHERE id = v_ptype;
  END;

  RESET ROLE;
  DELETE FROM object_sets WHERE api_name LIKE 'c24_%';
  DELETE FROM ontology_interfaces WHERE id = v_iface;
  DELETE FROM object_types WHERE id IN (v_type, v_other);

  RESET ROLE;
  RAISE NOTICE 'RLS contracts OK — C15 object types admin-authored, C16 link types admin-authored, C20 built-in object types code-owned, C21 interface claims verified, C25 edge vocabulary DB-enforced, C26 join-backed edges agree with their link table, C29 ontology status guards + cascade hold for an operator, C30 project roles delegate inside the org and never across it';
END $$;
