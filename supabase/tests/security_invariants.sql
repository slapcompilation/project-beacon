-- ─────────────────────────────────────────────────────────────────────────────
-- Security invariants — self-apply regression guard for the data layer.
--
-- We sell immutable audit + scoped access; our own RPCs meet the same bar. This
-- asserts catalog-level invariants over every public SECURITY DEFINER function —
-- the class of bug that already bit us twice (get_expiring_batches let authed
-- users cross-hotel-read; seven more fns carried a baseline anon EXECUTE grant).
--
-- Pure pg_catalog checks, no auth context or pgTAP needed. RAISES on violation,
-- so it's pass/fail. Run after any migration that adds or changes functions,
-- alongside get_advisors:
--
--   supabase db execute -f supabase/tests/security_invariants.sql      (CLI)
--   -- or paste into the SQL editor / run via the Supabase MCP execute_sql
--
-- Invariant 1: no public SECURITY DEFINER function is anon-executable. None of
--   ours are public — anon EXECUTE on a definer-rights function is always a leak.
-- Invariant 2: every public SECURITY DEFINER function pins search_path (else a
--   caller-controlled search_path can hijack unqualified references).
-- Invariant 3: no public SECURITY DEFINER function that an authenticated/anon
--   caller can EXECUTE takes a tenant-key argument (hotel_id / org_id) without a
--   scope gate in its body. A definer fn bypasses RLS, so a trusted tenant arg
--   is a cross-tenant hole — the exact class behind migrations 180 + 181
--   (get_overstock_candidates, get_hotel_graph, ingest_pos_sale, …). "Scope
--   gate" = the body references auth_hotel_id / auth_org_id / hotel_is_in_user_scope.
--   Service-role-only fns are exempt (not authed-executable). A function that
--   legitimately role-gates an org arg without a scope reference must be added to
--   v_inv3_allow with a documented reason — empty by design; keep it that way.
-- Invariant 4: no provenance column cascades from auth.users. A `*_by_user_id`
--   FK records WHO did something; deleting the user must not delete the record.
--   Found live (audit D3): deleting a user erased their document, its chunks and
--   every citation edge, and object_types.created_by_user_id cascaded further
--   into object_records. Identity columns (user_profiles.id, memberships) keep
--   CASCADE — there the row IS the user. Fixed in migration 231.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_anon   text;
  v_nopath text;
  v_leak   text;
  v_prov   text;
  v_inv3_allow text[] := ARRAY[]::text[];  -- documented exceptions; none today
BEGIN
  SELECT string_agg(format('%s.%s', n.nspname, p.proname), ', ' ORDER BY p.proname)
    INTO v_anon
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  SELECT string_agg(format('%s.%s', n.nspname, p.proname), ', ' ORDER BY p.proname)
    INTO v_nopath
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND (
      p.proconfig IS NULL
      OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
    );

  SELECT string_agg(format('%s.%s', n.nspname, p.proname), ', ' ORDER BY p.proname)
    INTO v_leak
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
      OR has_function_privilege('anon', p.oid, 'EXECUTE'))
    AND pg_get_function_identity_arguments(p.oid) ~* '(hotel_id|org_id|organization_id)'
    AND p.prosrc !~* '(auth_hotel_id|auth_org_id|hotel_is_in_user_scope)'
    AND NOT (p.proname = ANY (v_inv3_allow));

  SELECT string_agg(format('%s.%s', c.conrelid::regclass, a.attname), ', ' ORDER BY c.conrelid::regclass::text)
    INTO v_prov
  FROM pg_constraint c
  JOIN pg_attribute  a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.contype     = 'f'
    AND c.confrelid   = 'auth.users'::regclass
    AND c.confdeltype = 'c'
    AND array_length(c.conkey, 1) = 1
    AND a.attname ~ '_by(_user_id)?$';

  IF v_anon IS NOT NULL THEN
    RAISE EXCEPTION
      'SECURITY INVARIANT 1 VIOLATED — anon can EXECUTE SECURITY DEFINER function(s): %. Revoke anon (see migration 176).',
      v_anon;
  END IF;

  IF v_nopath IS NOT NULL THEN
    RAISE EXCEPTION
      'SECURITY INVARIANT 2 VIOLATED — SECURITY DEFINER function(s) without a pinned search_path: %. Add SET search_path TO ''public''.',
      v_nopath;
  END IF;

  IF v_leak IS NOT NULL THEN
    RAISE EXCEPTION
      'SECURITY INVARIANT 3 VIOLATED — definer function(s) take a tenant-key arg with no scope gate (cross-tenant leak class): %. Scope-gate the arg (hotel_is_in_user_scope) or make it service-role-only (see migration 181).',
      v_leak;
  END IF;

  IF v_prov IS NOT NULL THEN
    RAISE EXCEPTION
      'SECURITY INVARIANT 4 VIOLATED — provenance column(s) cascade from auth.users, so deleting a user deletes the records they authored: %. Use ON DELETE SET NULL (see migration 231).',
      v_prov;
  END IF;

  RAISE NOTICE 'Security invariants OK — no anon-executable, unpinned, or unscoped-tenant-param SECURITY DEFINER functions, and no cascading provenance FKs.';
END $$;
