-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 395 — restate the org boundary inside the dataset helpers.
--
-- 392 wrote can_read_dataset and can_write_dataset as `SELECT ... FROM datasets
-- WHERE id = $1`, relying on the datasets RLS policy to have already filtered
-- the row to the caller's organization. In an ordinary query that is true.
--
-- 393 then gave dataset_materialize SECURITY DEFINER, because it issues DDL.
-- SECURITY DEFINER runs as the owner, and the owner **bypasses RLS** — so inside
-- it the SELECT sees every organization's datasets, and the only surviving test
-- is `auth_role() IN ('owner','admin')`, which an admin of any tenant passes.
--
-- Verified before this fix, as an admin of org B against a dataset in org A:
--
--     cross-org can_write_dataset = true
--     cross-org can_read_dataset  = true
--
-- The fix is the pattern project_role already uses, and its comment already says
-- why: "The mandatory control, restated where it is easiest to remove by
-- accident: a grant in another organization is not a grant." A discretionary
-- check must never be the only thing standing between two tenants.
--
-- This is the same shape as migration 388, where auth_org_id() kept reading a
-- dropped table and every policy called it. Nothing static catches either one.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.can_read_dataset(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.datasets d
     WHERE d.id = p_dataset
       -- Mandatory, and stated here rather than left to RLS: a SECURITY DEFINER
       -- caller does not get RLS, and this function is called from one.
       AND d.organization_id IS NOT DISTINCT FROM public.auth_org_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_dataset(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.datasets d
     WHERE d.id = p_dataset
       AND d.organization_id IS NOT DISTINCT FROM public.auth_org_id()
       AND (public.auth_role() IN ('owner','admin')
            OR public.role_rank(public.project_role(d.project_id)) >= public.role_rank('editor'))
  )
$$;

COMMENT ON FUNCTION public.can_read_dataset(uuid) IS
  'True when the caller may see the dataset. Carries the organization check itself — its callers include a SECURITY DEFINER function, where RLS does not run.';
COMMENT ON FUNCTION public.can_write_dataset(uuid) IS
  'True when the caller may change the dataset: same organization, and either an org admin or an editor on its project.';

DO $$
DECLARE
  org_a uuid; org_b uuid; proj uuid; ds uuid; before text;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('m395 a') RETURNING id INTO org_a;
  INSERT INTO public.organizations (name) VALUES ('m395 b') RETURNING id INTO org_b;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org_a, 'm395', 'm395') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org_a, proj, 'm395', 'm395') RETURNING id INTO ds;

  -- An admin of the other tenant must fail both, on the strength of the org
  -- check alone: this runs as the migration's superuser, so RLS is not helping.
  PERFORM set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('role','admin','org_id', org_b))::text, true);
  IF public.can_read_dataset(ds) OR public.can_write_dataset(ds) THEN
    RAISE EXCEPTION 'Migration 395: a cross-organization admin still passes';
  END IF;

  -- And an admin of the owning tenant must still pass, or the fix is a lockout.
  PERFORM set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('role','admin','org_id', org_a))::text, true);
  IF NOT (public.can_read_dataset(ds) AND public.can_write_dataset(ds)) THEN
    RAISE EXCEPTION 'Migration 395: the owning organization''s admin was locked out';
  END IF;

  -- No JWT at all fails closed, since organization_id is NOT NULL.
  PERFORM set_config('request.jwt.claims', '{}', true);
  IF public.can_read_dataset(ds) THEN
    RAISE EXCEPTION 'Migration 395: an anonymous caller passes';
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  DELETE FROM public.datasets      WHERE id = ds;
  DELETE FROM public.projects      WHERE id = proj;
  DELETE FROM public.organizations WHERE id IN (org_a, org_b);
END $$;

COMMIT;
