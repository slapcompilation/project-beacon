-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 388 — auth_org_id() was broken, and user_org_memberships goes.
--
-- 382 dropped hotels and auth_hotel_id() but left auth_org_id() reading both:
--
--   SELECT COALESCE(
--     (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
--     (SELECT organization_id FROM hotels WHERE id = auth_hotel_id()))
--
-- Every RLS policy in the ontology calls this function. It survived because a
-- function body is not dependency-checked at drop time and NOTHING exercises RLS
-- any more — the contract suite that would have caught it in one run was deleted
-- the same day. That is the cost of removing the tests, stated plainly.
--
-- The organization now comes from the JWT claim alone, which is where a tenant
-- identity belongs.
--
-- user_org_memberships goes with it: a join table whose only remaining reader
-- was the users policy 382 wrote against it. A user's organization is the claim.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.auth_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='users' AND column_name='organization_id') THEN
    ALTER TABLE public.users ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
    ALTER TABLE public.users ALTER COLUMN organization_id SET DEFAULT auth_org_id();
  END IF;
END $$;

DROP POLICY IF EXISTS org_isolation ON public.users;
CREATE POLICY org_isolation ON public.users
  USING (NOT (organization_id IS DISTINCT FROM auth_org_id()));

-- auth_org_role() resolved a role from the membership row. The role is a JWT
-- claim (auth_role()), and nothing else calls this one.
DROP FUNCTION IF EXISTS public.auth_org_role() CASCADE;

DROP TABLE IF EXISTS public.user_org_memberships CASCADE;

-- CASCADE takes org_read, which read through the membership join.
DROP POLICY IF EXISTS org_read ON public.organizations;
CREATE POLICY org_read ON public.organizations
  FOR SELECT USING (NOT (id IS DISTINCT FROM auth_org_id()));

DO $$
DECLARE bad text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema='public' AND table_name='user_org_memberships') THEN
    RAISE EXCEPTION 'Migration 388: user_org_memberships survived';
  END IF;

  -- The whole point: no surviving function may name a table that is gone.
  SELECT string_agg(p.proname, ', ') INTO bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.prokind='f'
     AND p.prosrc ~ '(FROM|JOIN)\s+(public\.)?(hotels|user_org_memberships)\M';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 388: function(s) still read a dropped table: %', bad;
  END IF;

  PERFORM auth_org_id();   -- must be callable
END $$;

COMMIT;
