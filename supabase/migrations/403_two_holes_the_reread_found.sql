-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 403 — two holes found by re-reading `security/markings` against
-- what 399–402 actually built.
--
-- The re-read was the operator's instruction and it earned its place. Both of
-- these pass every test written in 399–402, because those tests checked the
-- predicates and these are the places that never call them.
--
-- HOLE 1 — writing bypassed markings entirely.
--
--   "Access to a Marking is binary (all-or-nothing). **Regardless of role, a user
--    cannot access a file IN ANY WAY** unless the user satisfies all Marking
--    requirements."
--
-- 401 put the marking check in can_read_dataset. can_write_dataset (from 395)
-- was left as organization + role, so a project Editor who is not a member of a
-- marking could not read a dataset and could still write it, materialize it, and
-- open transactions on it. "In any way" is one phrase, and it covers writes.
--
-- HOLE 2 — a marked dataset was still listed.
--
--   "Use of Markings to restrict data discovery — Since Markings restrict access
--    in an all-or-nothing manner, you should use them if you must **hide the
--    existence** of a resource like a file, folder, or Project. Markings can
--    ensure that users who do not have access to the Marking **will not see the
--    marked data in search results or in the Project/folder view**."
--
-- The child tables (branches, transactions, schemas, files, inputs) all read
-- through can_read_dataset and were therefore correct. The `datasets` table's own
-- SELECT policy was still the bare organization check written in 392 — so the row
-- appeared in the list, name and location and all, for someone who fails its file
-- markings. `markings-data-missing.png` is the state where metadata IS visible;
-- that is the DATA-marking case. A failed FILE marking is the other one:
-- "different from when a user cannot discover a resource because they do not meet
-- the file marking requirements."
--
-- Same for projects, which are markable in their own right.
--
-- NOTE ON RECURSION: these policies inline the marking predicate rather than
-- calling can_read_dataset, which reads from `datasets` and would re-enter the
-- policy being defined.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Hole 1. A marking is not a stronger role; no role clears it.
CREATE OR REPLACE FUNCTION public.can_write_dataset(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.datasets d
     WHERE d.id = p_dataset
       AND d.organization_id IS NOT DISTINCT FROM public.auth_org_id()
       AND (public.auth_role() IN ('owner','admin')
            OR public.role_rank(public.project_role(d.project_id)) >= public.role_rank('editor'))
       -- "Regardless of role, a user cannot access a file in any way unless the
       -- user satisfies all Marking requirements."
       AND public.satisfies_markings(public.effective_file_markings('dataset', d.id))
  )
$$;

COMMENT ON FUNCTION public.can_write_dataset(uuid) IS
  'Same organization, an editor role, AND membership of every file marking. The marking term is not redundant with can_read_dataset: a role can never override a mandatory control, so it is stated on both sides.';

-- Hole 2. Discovery.
DROP POLICY IF EXISTS "members read datasets" ON public.datasets;
CREATE POLICY "members read datasets" ON public.datasets
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM public.auth_org_id()
    AND public.satisfies_markings(public.effective_file_markings('dataset', id))
  );

DROP POLICY IF EXISTS "editors write datasets" ON public.datasets;
CREATE POLICY "editors write datasets" ON public.datasets
  FOR ALL
  USING (organization_id IS NOT DISTINCT FROM public.auth_org_id()
         AND public.satisfies_markings(public.effective_file_markings('dataset', id))
         AND (public.auth_role() IN ('owner','admin')
              OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')))
  WITH CHECK (organization_id IS NOT DISTINCT FROM public.auth_org_id()
         AND (public.auth_role() IN ('owner','admin')
              OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')));

-- A project is markable too, and hiding it has to hide it from the list.
DROP POLICY IF EXISTS "members read projects" ON public.projects;
CREATE POLICY "members read projects" ON public.projects
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM public.auth_org_id()
    AND public.satisfies_markings(public.effective_file_markings('project', id))
  );

DO $$
DECLARE
  org uuid; proj uuid; ds uuid; cat uuid; mk uuid; before text;
  reads boolean; writes boolean;
BEGIN
  before := current_setting('request.jwt.claims', true);

  INSERT INTO public.organizations (name) VALUES ('m403') RETURNING id INTO org;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm403', 'm403') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm403', 'm403') RETURNING id INTO ds;
  INSERT INTO public.marking_categories (name) VALUES ('m403') RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'PII') RETURNING id INTO mk;

  PERFORM set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('role','admin','org_id', org))::text, true);

  -- Unmarked: an org admin reads and writes.
  SELECT public.can_read_dataset(ds), public.can_write_dataset(ds) INTO reads, writes;
  IF NOT (reads AND writes) THEN
    RAISE EXCEPTION 'Migration 403: an admin lost access to an unmarked dataset';
  END IF;

  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
       VALUES (mk, 'dataset', ds);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  -- Marked, and not a member: BOTH doors shut. Before 403 the second was open.
  SELECT public.can_read_dataset(ds), public.can_write_dataset(ds) INTO reads, writes;
  IF reads THEN RAISE EXCEPTION 'Migration 403: an unmet file marking still allowed a read'; END IF;
  IF writes THEN
    RAISE EXCEPTION 'Migration 403: an unmet file marking still allowed a WRITE — hole 1 is not closed';
  END IF;

  -- And the policy itself carries the check, not just the helper — the list is
  -- what "hide the existence" is about, and it does not go through can_read_dataset.
  IF position('satisfies_markings' in
       (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy p
         JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'datasets' AND p.polname = 'members read datasets')) = 0 THEN
    RAISE EXCEPTION 'Migration 403: the datasets list policy does not check markings — hole 2 is not closed';
  END IF;
  IF position('satisfies_markings' in
       (SELECT pg_get_expr(polqual, polrelid) FROM pg_policy p
         JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relname = 'projects' AND p.polname = 'members read projects')) = 0 THEN
    RAISE EXCEPTION 'Migration 403: the projects list policy does not check markings';
  END IF;

  PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  DELETE FROM public.resource_markings WHERE marking_id = mk;
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;
  DELETE FROM public.datasets WHERE id = ds;
  DELETE FROM public.projects WHERE id = proj;
  DELETE FROM public.organizations WHERE id = org;
  ALTER TABLE public.markings DISABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories DISABLE TRIGGER guard_marking_category_immutability;
  DELETE FROM public.markings WHERE id = mk;
  DELETE FROM public.marking_categories WHERE id = cat;
  ALTER TABLE public.markings ENABLE TRIGGER guard_marking_immutability;
  ALTER TABLE public.marking_categories ENABLE TRIGGER guard_marking_category_immutability;
END $$;

COMMIT;
