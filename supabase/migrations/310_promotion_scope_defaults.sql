-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 310 — a promoted app has to know which org it belongs to.
--
-- 309 shipped app_collections and app_promotions with a scope-aware RLS policy
-- and no way for a browser to satisfy it: the client never sends
-- organization_id, so the row arrived NULL and the WITH CHECK refused it.
--
-- `object_sets` has had DEFAULT auth_org_id() on that column since Tier 1 for
-- exactly this reason. Copying the pattern rather than making every caller pass
-- a value it should not be trusted to choose.
--
-- Found by the W4 e2e clicking Publish as a real admin. A service-role probe
-- would not have caught it — service role has no auth_org_id() and does not go
-- through the policy at all.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.app_collections ALTER COLUMN organization_id SET DEFAULT auth_org_id();
ALTER TABLE public.app_promotions  ALTER COLUMN organization_id SET DEFAULT auth_org_id();
ALTER TABLE public.app_promotions  ALTER COLUMN promoted_by     SET DEFAULT auth.uid();

DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name IN ('app_collections','app_promotions')
        AND column_name='organization_id' AND column_default LIKE '%auth_org_id%') <> 2 THEN
    RAISE EXCEPTION 'Migration 310: the org default did not land on both tables';
  END IF;
END $$;

COMMIT;
