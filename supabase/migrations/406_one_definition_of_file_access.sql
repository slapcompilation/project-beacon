-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 406 — one definition of file access, and the recursion 403 created.
--
-- TWO THINGS, and the first is an outage.
--
-- ── 1. `select * from datasets` was broken for every real user ───────────────
--
-- 403 put the marking check directly into the datasets SELECT policy, with a
-- comment explaining that it inlined the predicate "rather than calling
-- can_read_dataset, which reads from `datasets` and would re-enter the policy
-- being defined". That avoided one recursion and walked into another:
-- effective_file_markings ALSO reads `datasets`, to find the project a dataset
-- inherits its markings from.
--
--     datasets policy → effective_file_markings → SELECT FROM datasets
--                     → datasets policy → …
--
-- Measured, as the role PostgREST actually uses:
--
--     set local role authenticated; select count(*) from datasets;
--     ERROR: stack depth limit exceeded
--
-- Every guard passed, because check:datasets connects as the owner and RLS is
-- bypassed for superusers. The verification was structurally blind to the only
-- path that matters. That is fixed here and in the guard.
--
-- The fix is to stop the resolution functions from being access decisions.
-- effective_file_markings and effective_data_markings answer "which markings does
-- this resource demand" — a question about configuration, not about the caller.
-- SECURITY DEFINER, so their internal reads do not re-enter the policy that
-- called them. The access decision stays entirely in satisfies_markings and
-- passes_scoped_session, which read only the caller's own membership.
--
-- ── 2. File access was written out three times ───────────────────────────────
--
-- can_read_dataset, can_write_dataset and the datasets policy each restated
-- "same organization AND satisfies file markings AND passes the scoped session".
-- The projects policy restated two of the three.
--
-- That duplication is not a style problem; it is the mechanism that produced the
-- two worst bugs in this codebase. 395: can_read_dataset carried the tenant check
-- and can_write_dataset did not. 403: can_read_dataset gained markings and
-- can_write_dataset did not. Both were "a predicate gained a term and its sibling
-- did not", twice, four migrations apart.
--
-- So there is now ONE definition, `resource_file_access(kind, id, org)`, which
-- takes the organization as an argument precisely so a policy can pass its own
-- row's column without reading the table again. Everything else composes:
--
--     resource_file_access ── datasets policy      (id, organization_id)
--                          ├─ projects policy      (id, organization_id)
--                          └─ can_read_dataset ──── can_write_dataset
--                                                └─ can_read_dataset_data
--
-- and the invariant that makes 403 unrepresentable is asserted directly:
-- **write implies read**. If a future migration restates instead of composing,
-- that assertion is what fails.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Resolution, not authorization. These say what a resource demands; they do not
-- decide anything about the caller, so running them as owner leaks nothing that
-- the calling policy is not already gating.
CREATE OR REPLACE FUNCTION public.effective_file_markings(p_kind text, p_id uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(array_agg(DISTINCT rm.marking_id), '{}'::uuid[])
    FROM public.resource_markings rm
   WHERE (rm.resource_kind = p_kind AND rm.resource_id = p_id)
      OR (p_kind = 'dataset' AND rm.resource_kind = 'project'
          AND rm.resource_id = (SELECT d.project_id FROM public.datasets d WHERE d.id = p_id))
$$;

COMMENT ON FUNCTION public.effective_file_markings(text, uuid) IS
  'Which markings a resource demands by the file route. SECURITY DEFINER because it reads `datasets` to resolve project inheritance, and is itself called from the datasets policy — invoker rights recurse.';

CREATE OR REPLACE FUNCTION public.effective_data_markings(p_dataset uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH RECURSIVE up AS (
    SELECT di.input_dataset_id AS id
      FROM public.dataset_inputs di
     WHERE di.dataset_id = p_dataset
    UNION
    SELECT di.input_dataset_id
      FROM public.dataset_inputs di
      JOIN up ON di.dataset_id = up.id
  ),
  flow AS (
    SELECT u.id AS at, m.id AS marking
      FROM up u
     CROSS JOIN LATERAL unnest(public.effective_file_markings('dataset', u.id)) AS m(id)
    UNION
    SELECT di.dataset_id, f.marking
      FROM flow f
      JOIN public.dataset_inputs di ON di.input_dataset_id = f.at
     WHERE NOT EXISTS (
       SELECT 1 FROM public.dataset_input_marking_stops s
        WHERE s.dataset_id = di.dataset_id
          AND s.input_dataset_id = di.input_dataset_id
          AND s.marking_id = f.marking)
  )
  SELECT coalesce(array_agg(DISTINCT f.marking), '{}'::uuid[])
    FROM flow f
   WHERE f.at = p_dataset
     AND NOT f.marking = ANY (public.effective_file_markings('dataset', p_dataset))
$$;

-- ── the one definition ───────────────────────────────────────────────────────

/** File access, for any markable resource. The organization comes in as an
 *  argument so a policy on the table can pass its own row rather than reading
 *  the table it is guarding. The marking set is computed once and both tests
 *  read the same value — two calls could not disagree, but one call cannot. */
CREATE OR REPLACE FUNCTION public.resource_file_access(p_kind text, p_id uuid, p_org uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_org IS NOT DISTINCT FROM public.auth_org_id()
     AND public.satisfies_markings(m.ms)
     AND public.passes_scoped_session(m.ms)
    FROM (SELECT public.effective_file_markings(p_kind, p_id) AS ms) m
$$;

COMMENT ON FUNCTION public.resource_file_access(text, uuid, uuid) IS
  'The single definition of file access: same organization, a member of every file marking, and inside the scoped session. Every policy and helper composes this rather than restating it — restating it is what produced migrations 395 and 403.';

CREATE OR REPLACE FUNCTION public.can_read_dataset(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.datasets d
     WHERE d.id = p_dataset
       AND public.resource_file_access('dataset', d.id, d.organization_id))
$$;

/** Write is read plus a role. Composed, never restated — this is the shape that
 *  makes "a predicate gained a term and its sibling did not" impossible. */
CREATE OR REPLACE FUNCTION public.can_write_dataset(p_dataset uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT public.can_read_dataset(p_dataset)
     AND EXISTS (
       SELECT 1 FROM public.datasets d
        WHERE d.id = p_dataset
          AND (public.auth_role() IN ('owner','admin')
               OR public.role_rank(public.project_role(d.project_id)) >= public.role_rank('editor')))
$$;

DROP POLICY IF EXISTS "members read datasets" ON public.datasets;
CREATE POLICY "members read datasets" ON public.datasets
  FOR SELECT USING (public.resource_file_access('dataset', id, organization_id));

DROP POLICY IF EXISTS "editors write datasets" ON public.datasets;
CREATE POLICY "editors write datasets" ON public.datasets
  FOR ALL
  USING (public.resource_file_access('dataset', id, organization_id)
         AND (public.auth_role() IN ('owner','admin')
              OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')))
  WITH CHECK (organization_id IS NOT DISTINCT FROM public.auth_org_id()
         AND (public.auth_role() IN ('owner','admin')
              OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')));

DROP POLICY IF EXISTS "members read projects" ON public.projects;
CREATE POLICY "members read projects" ON public.projects
  FOR SELECT USING (public.resource_file_access('project', id, organization_id));

DO $$
DECLARE
  org uuid; proj uuid; ds uuid; cat uuid; mk uuid; usr uuid; before text; n int;
BEGIN
  before := current_setting('request.jwt.claims', true);
  SELECT id INTO usr FROM public.users LIMIT 1;

  INSERT INTO public.organizations (name) VALUES ('m406') RETURNING id INTO org;
  INSERT INTO public.projects (organization_id, api_name, name)
       VALUES (org, 'm406', 'm406') RETURNING id INTO proj;
  INSERT INTO public.datasets (organization_id, project_id, api_name, name)
       VALUES (org, proj, 'm406', 'm406') RETURNING id INTO ds;
  INSERT INTO public.marking_categories (name) VALUES ('m406') RETURNING id INTO cat;
  INSERT INTO public.markings (category_id, name) VALUES (cat, 'PII') RETURNING id INTO mk;

  PERFORM set_config('request.jwt.claims',
    json_build_object('app_metadata', json_build_object('role','admin','org_id', org))::text, true);

  -- THE INVARIANT. Write implies read, in every state. This is what a future
  -- migration breaks if it restates file access instead of composing it.
  IF NOT (public.can_read_dataset(ds) AND public.can_write_dataset(ds)) THEN
    RAISE EXCEPTION 'Migration 406: an admin lost access to an unmarked dataset';
  END IF;

  ALTER TABLE public.resource_markings DISABLE TRIGGER guard_marking_application;
  INSERT INTO public.resource_markings (marking_id, resource_kind, resource_id)
       VALUES (mk, 'dataset', ds);
  ALTER TABLE public.resource_markings ENABLE TRIGGER guard_marking_application;

  IF public.can_read_dataset(ds) THEN
    RAISE EXCEPTION 'Migration 406: an unmet file marking still allowed a read';
  END IF;
  IF public.can_write_dataset(ds) THEN
    RAISE EXCEPTION 'Migration 406: write did not follow read — the composition is broken';
  END IF;

  -- Structural: nobody may restate the terms. If a policy or helper spells out
  -- satisfies_markings itself again, there are two definitions and 403 recurs.
  IF EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
              WHERE c.relname IN ('datasets','projects') AND p.polcmd = 'r'
                AND pg_get_expr(p.polqual, p.polrelid) NOT LIKE '%resource_file_access%') THEN
    RAISE EXCEPTION 'Migration 406: a list policy does not compose resource_file_access';
  END IF;
  IF position('resource_file_access' in
       (SELECT prosrc FROM pg_proc WHERE proname = 'can_read_dataset')) = 0
  OR position('can_read_dataset' in
       (SELECT prosrc FROM pg_proc WHERE proname = 'can_write_dataset')) = 0 THEN
    RAISE EXCEPTION 'Migration 406: the helpers no longer compose the one definition';
  END IF;

  -- The resolution functions must be SECURITY DEFINER, or the datasets policy
  -- re-enters itself the moment it resolves project-inherited markings.
  IF EXISTS (SELECT 1 FROM pg_proc
              WHERE proname IN ('effective_file_markings','effective_data_markings')
                AND NOT prosecdef) THEN
    RAISE EXCEPTION 'Migration 406: a marking resolver is SECURITY INVOKER and will recurse';
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
