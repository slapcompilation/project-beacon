-- Migration 181 — close the tenant-param leak class.
--
-- Layer: data / mutation · Scope: all tenants · Self-apply: this is the exact
-- class of bug behind migrations 175–180 (get_overstock_candidates). Activating
-- the contract-test CI (roadmap P0.1) surfaced eight more SECURITY DEFINER
-- functions that trust a hotel_id/org_id argument with NO scope gate — a definer
-- function bypasses RLS, so a trusted tenant param is a cross-tenant hole.
--
-- Confirmed exploitable: an authenticated hotel-scoped manager read all 2308 of
-- another hotel's relationship_edges through get_hotel_graph. Same structure in
-- get_node_edges (read), create_relationship_edge / fan_out_alert (write), and
-- ingest_pos_sale (writes pos_sales + DECREMENTS STOCK). promote_agent and the
-- two demo seeders are admin-gated but never check the org/hotel arg against the
-- caller's scope.
--
-- Fix shape:
--   • ingest_pos_sale → service-role only (its only callers are the ingest-pos
--     and square-webhook edge fns via adminClient). Highest severity.
--   • get_hotel_graph / get_node_edges → scope-filter the read (in-scope OR a
--     null-auth service/cron caller). Returns nothing for an out-of-scope hotel.
--   • create_relationship_edge / fan_out_alert → raise for an authenticated
--     caller acting outside scope. All real callers pass: cron/service have no
--     JWT (auth_hotel_id() NULL → skip); the three INVOKER callers
--     (discard_batch, receive_restock, detect_and_alert_pos_variance) and the
--     edge triggers only ever act on the actor's own hotel; approve_stock_transfer
--     does not route through these helpers (verified) so cross-hotel transfers
--     are unaffected.
--   • promote_agent → block promoting into another org.
--   • seed_demo_hotel_data / seed_demo_world → block seeding a hotel out of scope.
--
-- The role-gated trio (promote_agent + the two seeders) is patched by injecting
-- the gate into each function's live definition rather than re-typing the large
-- bodies, so there's no transcription risk; the DO block raises if its anchor
-- is missing. Run get_advisors + supabase/tests/*.sql after applying.

-- ── 1. ingest_pos_sale: service-role only ────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.ingest_pos_sale(uuid, uuid, numeric, timestamptz, text, text)
  FROM authenticated, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ingest_pos_sale(uuid, uuid, numeric, timestamptz, text, text)
  TO service_role;

-- ── 2. get_hotel_graph: scope-filtered read ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_hotel_graph(
  p_hotel_id uuid, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0,
  p_since timestamp with time zone DEFAULT (now() - '7 days'::interval))
 RETURNS TABLE(id uuid, edge_type text, source_type text, source_id uuid,
   target_type text, target_id uuid, metadata jsonb, triggered_by text,
   created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT re.id, re.edge_type, re.source_type, re.source_id,
         re.target_type, re.target_id, re.metadata, re.triggered_by, re.created_at
  FROM relationship_edges re
  WHERE re.hotel_id = p_hotel_id
    AND re.created_at >= p_since
    AND (auth_hotel_id() IS NULL OR hotel_is_in_user_scope(p_hotel_id))
  ORDER BY re.created_at DESC
  LIMIT p_limit OFFSET p_offset
$function$;

-- ── 3. get_node_edges: scope-filtered read ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_node_edges(
  p_node_id uuid, p_node_type text, p_hotel_id uuid)
 RETURNS TABLE(id uuid, edge_type text, source_type text, source_id uuid,
   target_type text, target_id uuid, metadata jsonb, triggered_by text,
   actor_id uuid, created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT re.id, re.edge_type, re.source_type, re.source_id,
         re.target_type, re.target_id, re.metadata, re.triggered_by, re.actor_id, re.created_at
  FROM relationship_edges re
  WHERE re.hotel_id = p_hotel_id
    AND ((re.source_id = p_node_id AND re.source_type = p_node_type)
      OR (re.target_id = p_node_id AND re.target_type = p_node_type))
    AND (auth_hotel_id() IS NULL OR hotel_is_in_user_scope(p_hotel_id))
  ORDER BY re.created_at DESC
$function$;

-- ── 4. create_relationship_edge: scope-gated write ───────────────────────────
CREATE OR REPLACE FUNCTION public.create_relationship_edge(
  p_hotel_id uuid, p_source_type text, p_source_id uuid, p_edge_type text,
  p_target_type text, p_target_id uuid, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- An authenticated caller may only write edges into a hotel in its scope.
  -- Cron/service (no JWT → auth_hotel_id() NULL) and nested definer triggers
  -- acting on the user's own hotel pass through.
  IF auth_hotel_id() IS NOT NULL AND NOT hotel_is_in_user_scope(p_hotel_id) THEN
    RAISE EXCEPTION 'permission denied: hotel % is not in your scope', p_hotel_id USING ERRCODE = '42501';
  END IF;
  INSERT INTO relationship_edges
    (hotel_id, source_type, source_id, edge_type, target_type, target_id, metadata)
  VALUES
    (p_hotel_id, p_source_type, p_source_id, p_edge_type, p_target_type, p_target_id, p_metadata)
  ON CONFLICT (source_id, edge_type, target_id) DO NOTHING;
END;
$function$;

-- ── 5. fan_out_alert: scope-gated write ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fan_out_alert(
  p_hotel_id uuid, p_message text, p_type text,
  p_min_role text DEFAULT 'team_member'::text, p_variant_id uuid DEFAULT NULL::uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_inserted integer;
BEGIN
  IF auth_hotel_id() IS NOT NULL AND NOT hotel_is_in_user_scope(p_hotel_id) THEN
    RAISE EXCEPTION 'permission denied: hotel % is not in your scope', p_hotel_id USING ERRCODE = '42501';
  END IF;
  WITH inserted AS (
    INSERT INTO notifications (hotel_id, user_id, message, type, variant_id)
    SELECT p_hotel_id, u.id, p_message, p_type, p_variant_id
    FROM users u
    WHERE u.hotel_id = p_hotel_id
      AND CASE u.role
            WHEN 'limited_access' THEN 1 WHEN 'team_member' THEN 2
            WHEN 'admin' THEN 3 WHEN 'owner' THEN 4 ELSE 0 END
        >= CASE p_min_role
            WHEN 'limited_access' THEN 1 WHEN 'team_member' THEN 2
            WHEN 'admin' THEN 3 WHEN 'owner' THEN 4 ELSE 2 END
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO v_inserted FROM inserted;
  RETURN v_inserted;
END;
$function$;

-- ── 6. role-gated trio: inject the scope gate into each live definition ───────
DO $mig$
DECLARE
  v_proname text;
  v_def     text;
  v_new     text;
  v_anchor  text :=
    '  IF v_role IS NULL OR v_role NOT IN (''admin'',''owner'') THEN' || E'\n' ||
    '    RAISE EXCEPTION ''permission denied: requires admin or owner role'' USING ERRCODE = ''42501'';' || E'\n' ||
    '  END IF;';
  v_gate    text;
BEGIN
  FOREACH v_proname IN ARRAY ARRAY['promote_agent','seed_demo_hotel_data','seed_demo_world'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_proname;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'migration 181: function %.% not found', 'public', v_proname;
    END IF;

    IF v_proname = 'promote_agent' THEN
      v_gate := E'\n  IF p_organization_id IS NOT NULL AND p_organization_id <> auth_org_id() THEN' || E'\n' ||
                '    RAISE EXCEPTION ''permission denied: cannot promote agents for another organization'' USING ERRCODE = ''42501'';' || E'\n' ||
                '  END IF;';
    ELSE
      v_gate := E'\n  IF NOT hotel_is_in_user_scope(p_hotel_id) THEN' || E'\n' ||
                '    RAISE EXCEPTION ''permission denied: hotel % is not in your scope'', p_hotel_id USING ERRCODE = ''42501'';' || E'\n' ||
                '  END IF;';
    END IF;

    v_new := replace(v_def, v_anchor, v_anchor || v_gate);
    IF v_new = v_def THEN
      RAISE EXCEPTION 'migration 181: scope-gate anchor not found in %', v_proname;
    END IF;
    EXECUTE v_new;
  END LOOP;
END $mig$;
