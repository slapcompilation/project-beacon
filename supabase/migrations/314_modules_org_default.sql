-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 314 — a module has never been creatable from a browser.
--
-- `modules.organization_id` is NOT NULL with no default, and the admin policy
-- requires `organization_id IS NOT DISTINCT FROM auth_org_id()`. A client insert
-- omits the column, so the row arrives NULL and the table's own policy refuses
-- it. Every module in this system was created by SQL, which is exactly why
-- nobody hit it until the builder tried to create one.
--
-- Same trap as migration 310 on app_promotions, and the same fix `object_sets`
-- has carried since Tier 1: DEFAULT auth_org_id(). THIRD TIME in this arc.
--
-- The pattern worth naming: a scope-aware RLS policy on a NOT NULL tenant
-- column is only satisfiable if that column has a matching DEFAULT. Writing the
-- policy is half the work; the other half is making a legitimate caller able to
-- pass it.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.modules ALTER COLUMN organization_id SET DEFAULT auth_org_id();

-- Every tenant-scoped table the builder writes to, checked in one place so this
-- does not need a fourth discovery.
DO $$
DECLARE missing text[];
BEGIN
  SELECT array_agg(c.table_name ORDER BY c.table_name) INTO missing
  FROM information_schema.columns c
  JOIN pg_class t ON t.relname = c.table_name AND t.relnamespace = 'public'::regnamespace
  WHERE c.table_schema = 'public'
    AND c.column_name = 'organization_id'
    AND c.is_nullable = 'NO'
    AND coalesce(c.column_default, '') NOT LIKE '%auth_org_id%'
    AND c.table_name IN ('modules','object_sets','app_promotions','app_collections',
                         'module_installations');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 314: these tables still cannot be written from a browser: %',
      array_to_string(missing, ', ');
  END IF;
END $$;

COMMIT;
