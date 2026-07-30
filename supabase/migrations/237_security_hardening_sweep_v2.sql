-- Recovered from supabase_migrations version 20260501160420.
-- Applied through the Supabase MCP and never written to the repo; exported
-- here so the schema is reproducible from files alone. Already applied in
-- production — the history reconciliation marks it so.

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
      AND p.prokind = 'f'
      -- Skip functions already owned by an extension (e.g. pgvector)
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid
          AND d.deptype = 'e'
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
      -- Skip extension-owned
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      rec.schema, rec.name, rec.args
    );
    v_revoked := v_revoked + 1;

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
  RAISE NOTICE 'mig_121: revoked anon EXECUTE on % SECURITY DEFINER fns; re-granted authenticated on %', v_revoked, v_granted;
END $$;

DROP POLICY IF EXISTS "service role full access" ON public.variant_embeddings;
CREATE POLICY "service role full access" ON public.variant_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "product_images_read" ON storage.objects;
DROP POLICY IF EXISTS "public_read"          ON storage.objects;
