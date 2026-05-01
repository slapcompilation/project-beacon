-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 121 — Security hardening sweep (advisor-driven)
--
-- Layer: meta — security posture across all layers
-- Scope: organization (system-wide DB hygiene)
--
-- Why this exists
-- ───────────────
-- Supabase database advisor flagged ~80 security warnings across four classes:
--
--   (1) function_search_path_mutable          — ~50 functions
--   (2) anon_security_definer_function_executable — ~120 functions callable by anon
--   (3) rls_policy_always_true                — variant_embeddings.'service role full access'
--   (4) public_bucket_allows_listing          — product-images + stock-photos
--   (5) extension_in_public                   — `vector` (deferred — separate PR)
--
-- This migration handles (1)–(4) in a single sweep using DO blocks for the
-- bulk operations so it stays correct as new functions land. (5) is deferred
-- because moving the `vector` extension between schemas needs a column-rewrite
-- impact assessment (variant_embeddings.embedding column references the type).
--
-- Per CLAUDE.md self-apply rule #3 — every failure mode must carry derived
-- context. The DO blocks emit RAISE NOTICE counts so a reviewer can confirm the
-- migration touched what it was supposed to.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── (1) Lock down search_path on every public function ──────────────────────
-- Leaving search_path mutable lets a user with CREATE on any schema in the
-- caller's path shadow function/operator resolution. Setting it to a fixed
-- value (`public, pg_temp`) closes the hijack vector. `pg_catalog` is always
-- consulted first by Postgres regardless, so it doesn't need to be listed.

DO $$
DECLARE
  v_count int := 0;
  rec     record;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'  -- functions only (skip aggregates, procedures)
      -- Skip extension-owned functions (e.g. pgvector's halfvec_*) — only the
      -- extension itself can ALTER them.
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
      -- Skip if search_path is already explicitly set
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      rec.schema, rec.name, rec.args
    );
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'mig_121: locked search_path on % public functions', v_count;
END $$;

-- ── (2) REVOKE EXECUTE on every SECURITY DEFINER function from anon ────────
-- SECURITY DEFINER + default GRANT to PUBLIC means anonymous callers can hit
-- /rest/v1/rpc/<fn>. Even when the function role-gates internally (via
-- auth_role()), defense-in-depth dictates the role check should also exist at
-- the GRANT layer.
--
-- We keep service_role and postgres EXECUTE intact (they bypass via PUBLIC),
-- and explicitly GRANT to authenticated for any function that PostgREST
-- callers should still be able to invoke.

DO $$
DECLARE
  v_revoked int := 0;
  v_granted int := 0;
  rec       record;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args,
           p.prosecdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef = true
      -- Skip extension-owned (vector etc.)
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    -- Revoke from anon and PUBLIC unconditionally
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      rec.schema, rec.name, rec.args
    );
    v_revoked := v_revoked + 1;

    -- Re-grant to authenticated unless the function name pattern indicates
    -- it's an internal helper (trigger function, monitor, lockdown'd RPC).
    -- Trigger functions (`trg_*`) and monitor (`monitor_*`) stay
    -- authenticated-revoked because they were already locked down explicitly
    -- in earlier migrations (115/117/118/119).
    IF rec.name NOT LIKE 'trg\_%' ESCAPE '\'
       AND rec.name <> 'monitor_cron_health'
    THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
        rec.schema, rec.name, rec.args
      );
      v_granted := v_granted + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'mig_121: revoked anon EXECUTE on % SECURITY DEFINER fns; '
               're-granted authenticated on %', v_revoked, v_granted;
END $$;

-- ── (3) Tighten variant_embeddings 'service role full access' policy ────────
-- Current state: roles = {-} (i.e. PUBLIC), USING true / WITH CHECK true.
-- Anyone can do anything if RLS is somehow bypassed at the role layer.
-- Fix: scope explicitly to the `service_role` role. Authenticated users still
-- have read access via the existing `hotel members can read embeddings`
-- policy which scopes by hotel_id = auth_hotel_id().

DROP POLICY IF EXISTS "service role full access" ON public.variant_embeddings;
CREATE POLICY "service role full access" ON public.variant_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── (4) Drop public-bucket listing policies ─────────────────────────────────
-- Public buckets serve files via public URLs that don't need a SELECT policy
-- on storage.objects — the URL itself is the auth. The broad SELECT policies
-- (product_images_read, public_read) only enable bucket *listing*, which we
-- don't use anywhere in the codebase. Dropping them shrinks the attack surface
-- without affecting URL-based reads.
--
-- Rollback: re-create the policy if a future feature needs `from(bucket).list()`.

DROP POLICY IF EXISTS "product_images_read" ON storage.objects;
DROP POLICY IF EXISTS "public_read"          ON storage.objects;

-- ── Verification ───────────────────────────────────────────────────────────
-- After applying:
--
--   SELECT count(*) FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.prokind = 'f'
--     AND NOT EXISTS (
--       SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
--       WHERE cfg LIKE 'search_path=%'
--     );
--   -- expected: 0
--
--   SELECT count(*) FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.prosecdef = true
--     AND has_function_privilege('anon', p.oid, 'EXECUTE');
--   -- expected: 0
--
--   SELECT polroles::regrole[] FROM pg_policy
--   WHERE polrelid = 'public.variant_embeddings'::regclass
--     AND polname  = 'service role full access';
--   -- expected: {service_role}
--
--   SELECT count(*) FROM pg_policy
--   WHERE polrelid = 'storage.objects'::regclass
--     AND polname IN ('product_images_read','public_read');
--   -- expected: 0
--
-- Then re-run get_advisors(security) — the four classes above should drop to
-- the deferred (5) only.
