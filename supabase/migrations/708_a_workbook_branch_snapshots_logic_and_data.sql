-- 708: a workbook branch snapshots logic AND data, and merges one level up.
--
--   "**Branching** in Code Workbook provides a version control experience tailored to data transformation, enabling teams to operate on logic and data simultaneously in a Workbook."
--   — code-workbook/core-concepts.md
--
-- CREATION SNAPSHOTS BOTH: the logic (transforms are branch-scoped, 707, so
-- creating a branch copies the parent's rows) and the data:
--
--   "When you create a branch, Code Workbook keeps track of the state of each dataset at the time of branch creation. Any transforms you run on your new branch will use this stored state to load data."
--   — code-workbook/branching-overview.md
--
--   "By default, Code Workbook allows you to create at most 100 branches."
--   — code-workbook/branching-overview.md
--
-- MERGES GO ONE LEVEL, GET THEIR OWN DATASET BRANCH, AND SELF-DELETE:
--
--   "Note that Code Workbook only allows branches to be merged into their immediate parent."
--   — code-workbook/branching-merging.md
--
--   "When you run transforms while merging, Code Workbook automatically creates a *merge branch* on output datasets. This allows the merge to be isolated from both the target branch and the source branch. These merge branches will appear on your dataset in the form `vector-merge-{source}-{target}-{uuid}`."
--   — code-workbook/branching-merging.md
--
--   "After the merge is completed, the branch you just merged will be deleted automatically, unless it still has child branches."
--   — code-workbook/branching-merging.md
--
--   "Deleting a branch that still has child branches based on it will re-parent those branches."
--   — code-workbook/branching-overview.md
--
-- PROTECTION IS TWO SWITCHES, and the second has a documented DEFAULT the
-- adversary pass surfaced:
--
--   "Is the branch protected? If a branch is protected, nobody can make edits to the branch directly. Instead, all changes must be merged in through another branch. Note that if a branch is protected, merging into it requires Owner permissions on the Workbook."
--   — code-workbook/branching-overview.md
--
--   "By default, a protected branch does not allow any user to use the Run button on that branch to compute output datasets."
--   — code-workbook/workbooks-production.md
--
-- THE PERMISSION TOKENS are the section's cleanest published example of an
-- application operation set expanding from Compass roles — and the
-- Owner-wording elsewhere is the same mechanism in the prose vocabulary
-- (the two-vocabularies rule):
--
--   "Internally, Code Workbook has four permission levels related to branches: `view`, `edit`, `maintain`, and `manage`. By default, `compass:read` expands to `view`, `compass:edit` expands to `edit`, and `compass:manage` expands to `maintain` and `manage`."
--   — code-workbook/faq.md
--
--   "Creating a branch and preparing a merge into a parent branch always requires only `edit` permissions. Merging into a protected branch requires `maintain` permissions. Changing branch protection settings requires `manage` permissions."
--   — code-workbook/faq.md
--
-- master is special beyond being first: "Project scoping can only be
-- enabled on the master branch." (code-workbook/project-references.md) —
-- scoping itself is recorded, not built.

-- ── the data pins ───────────────────────────────────────────────────────────

CREATE TABLE public.workbook_branch_dataset_pins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      uuid NOT NULL REFERENCES public.workbook_branches(id) ON DELETE CASCADE,
  dataset_id     uuid NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.dataset_transactions(id) ON DELETE SET NULL,
  UNIQUE (branch_id, dataset_id)
);
CREATE INDEX wb_pins_branch_idx ON public.workbook_branch_dataset_pins (branch_id);
CREATE INDEX wb_pins_dataset_idx ON public.workbook_branch_dataset_pins (dataset_id);
CREATE INDEX wb_pins_txn_idx ON public.workbook_branch_dataset_pins (transaction_id);
COMMENT ON TABLE public.workbook_branch_dataset_pins IS
  '"When you create a branch, Code Workbook keeps track of the state of each dataset at the time of branch creation" (code-workbook/branching-overview) — one pin per imported or saved dataset, taken at creation. Branch fallbacks for datasets absent from a branch ("input data will be pulled from master", branching-imported-datasets) are the surface''s read rule over these pins.';

-- ── the four permission tokens, composed from the project role ──────────────

CREATE FUNCTION public.workbook_branch_permissions(p_workbook uuid)
RETURNS text[] LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
  -- compass:read -> view; compass:edit -> edit; compass:manage -> maintain
  -- and manage. Our roles ARE those operations' carriers.
  SELECT CASE public.project_role((SELECT w.project_id FROM public.code_workbooks w
                                    WHERE w.id = p_workbook))
           WHEN 'owner'  THEN ARRAY['view', 'edit', 'maintain', 'manage']
           WHEN 'editor' THEN ARRAY['view', 'edit']
           WHEN 'viewer' THEN ARRAY['view']
           ELSE ARRAY[]::text[]
         END
$$;
COMMENT ON FUNCTION public.workbook_branch_permissions(uuid) IS
  'The four internal branch permission levels, expanded from the caller''s project role the way the page expands them from Compass operations: "By default, compass:read expands to view, compass:edit expands to edit, and compass:manage expands to maintain and manage" (code-workbook/faq). The prose pages say Owner where the faq says maintain/manage — one mechanism, two vocabularies.';

-- ── create: copy the logic, pin the data, cap at 100 ────────────────────────

CREATE FUNCTION public.create_workbook_branch(p_workbook uuid, p_name text,
                                              p_parent uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE parent uuid; nb uuid; n integer; t record; mapping jsonb := '{}'::jsonb;
BEGIN
  IF NOT ('edit' = ANY (public.workbook_branch_permissions(p_workbook))) THEN
    RAISE EXCEPTION 'CodeWorkbook:NeedsEdit — creating a branch always requires only edit permissions, which you lack';
  END IF;
  SELECT count(*) INTO n FROM public.workbook_branches WHERE workbook_id = p_workbook;
  IF n >= 100 THEN
    RAISE EXCEPTION 'CodeWorkbook:TooManyBranches — Code Workbook allows you to create at most 100 branches';
  END IF;
  parent := coalesce(p_parent,
    (SELECT b.id FROM public.workbook_branches b
      WHERE b.workbook_id = p_workbook AND b.name = 'master'));
  INSERT INTO public.workbook_branches (workbook_id, name, parent_branch_id)
  VALUES (p_workbook, p_name, parent) RETURNING id INTO nb;

  -- the corresponding hidden-repository branch
  INSERT INTO public.code_branches (repository_id, name)
  SELECT w.hidden_repository_id, p_name FROM public.code_workbooks w
   WHERE w.id = p_workbook AND w.hidden_repository_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  -- copy the parent's LOGIC: transforms and their edges
  FOR t IN SELECT * FROM public.workbook_transforms
            WHERE branch_id = parent ORDER BY position, created_at LOOP
    INSERT INTO public.workbook_transforms
      (workbook_id, branch_id, alias, transform_type, language, source, config,
       template_version_id, persisted, saved_dataset_id, position)
    VALUES (t.workbook_id, nb, t.alias, t.transform_type, t.language, t.source,
            t.config, t.template_version_id, t.persisted, t.saved_dataset_id, t.position);
    mapping := mapping || jsonb_build_object(t.id::text,
      (SELECT id FROM public.workbook_transforms
        WHERE branch_id = nb AND alias = t.alias)::text);
  END LOOP;
  INSERT INTO public.workbook_transform_inputs (transform_id, input_transform_id, input_import_id)
  SELECT (mapping ->> i.transform_id::text)::uuid,
         (mapping ->> i.input_transform_id::text)::uuid,
         i.input_import_id
    FROM public.workbook_transform_inputs i
    JOIN public.workbook_transforms t2 ON t2.id = i.transform_id
   WHERE t2.branch_id = parent;

  -- pin the DATA: every import and saved output, at its current head
  INSERT INTO public.workbook_branch_dataset_pins (branch_id, dataset_id, transaction_id)
  SELECT DISTINCT nb, x.d, b.head_transaction_id
    FROM (SELECT i.dataset_id AS d FROM public.workbook_imports i
           WHERE i.workbook_id = p_workbook AND i.dataset_id IS NOT NULL
          UNION
          SELECT t3.saved_dataset_id FROM public.workbook_transforms t3
           WHERE t3.branch_id = nb AND t3.saved_dataset_id IS NOT NULL) x
    LEFT JOIN public.dataset_branches b ON b.dataset_id = x.d AND b.name = 'master'
   WHERE x.d IS NOT NULL;
  RETURN nb;
END $$;
COMMENT ON FUNCTION public.create_workbook_branch(uuid, text, uuid) IS
  'Creates a branch off the parent (master by default): copies the parent''s transforms and edges — a branch operates on its own logic — pins every dataset''s current state ("keeps track of the state of each dataset at the time of branch creation"), mirrors the branch into the hidden repository, and holds the page''s own cap of 100. Requires edit: "Creating a branch … always requires only edit permissions" (code-workbook/faq). INVOKER.';

-- ── protect: the documented default ─────────────────────────────────────────

CREATE FUNCTION public.protect_workbook_branch(p_branch uuid, p_protected boolean,
                                               p_allows_running boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM public.workbook_branches WHERE id = p_branch;
  IF b.id IS NULL THEN
    RAISE EXCEPTION 'CodeWorkbook:NoSuchBranch — % is not a branch you can see', p_branch;
  END IF;
  IF NOT ('manage' = ANY (public.workbook_branch_permissions(b.workbook_id))) THEN
    RAISE EXCEPTION 'CodeWorkbook:NeedsManage — changing branch protection settings requires manage permissions';
  END IF;
  UPDATE public.workbook_branches
     SET protected = p_protected,
         -- "By default, a protected branch does not allow any user to use
         -- the Run button" — protecting flips running off unless told
         allows_running = CASE WHEN p_protected THEN coalesce(p_allows_running, false)
                               ELSE coalesce(p_allows_running, true) END
   WHERE id = p_branch;
END $$;
COMMENT ON FUNCTION public.protect_workbook_branch(uuid, boolean, boolean) IS
  'The two branch settings, with the second''s documented default: protecting a branch turns running OFF unless explicitly kept ("By default, a protected branch does not allow any user to use the Run button on that branch to compute output datasets", code-workbook/workbooks-production). Requires manage — the faq''s token for what the prose calls Owner. INVOKER.';

-- ── merge: one level up, the vector-merge branch, self-delete ───────────────

CREATE FUNCTION public.merge_workbook_branch(p_branch uuid)
RETURNS integer LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  src record; tgt record; t record; merged integer := 0; ds uuid; nm text;
BEGIN
  SELECT * INTO src FROM public.workbook_branches WHERE id = p_branch;
  IF src.id IS NULL THEN
    RAISE EXCEPTION 'CodeWorkbook:NoSuchBranch — % is not a branch you can see', p_branch;
  END IF;
  IF src.parent_branch_id IS NULL THEN
    RAISE EXCEPTION 'CodeWorkbook:NothingAbove — Code Workbook only allows branches to be merged into their immediate parent, and this branch has none';
  END IF;
  SELECT * INTO tgt FROM public.workbook_branches WHERE id = src.parent_branch_id;
  IF NOT ('edit' = ANY (public.workbook_branch_permissions(src.workbook_id))) THEN
    RAISE EXCEPTION 'CodeWorkbook:NeedsEdit — preparing a merge into a parent branch always requires only edit permissions, which you lack';
  END IF;
  IF tgt.protected AND NOT ('maintain' = ANY (public.workbook_branch_permissions(src.workbook_id))) THEN
    RAISE EXCEPTION 'CodeWorkbook:NeedsMaintain — merging into a protected branch requires maintain permissions';
  END IF;

  -- the merge replaces the parent's logic with the source's
  DELETE FROM public.workbook_transforms WHERE branch_id = tgt.id;
  FOR t IN SELECT * FROM public.workbook_transforms
            WHERE branch_id = p_branch ORDER BY position, created_at LOOP
    INSERT INTO public.workbook_transforms
      (workbook_id, branch_id, alias, transform_type, language, source, config,
       template_version_id, persisted, saved_dataset_id, position)
    VALUES (t.workbook_id, tgt.id, t.alias, t.transform_type, t.language, t.source,
            t.config, t.template_version_id, t.persisted, t.saved_dataset_id, t.position);
    merged := merged + 1;
    -- "Code Workbook automatically creates a merge branch on output
    -- datasets … in the form vector-merge-{source}-{target}-{uuid}"
    IF t.persisted AND t.saved_dataset_id IS NOT NULL THEN
      nm := format('vector-merge-%s-%s-%s', src.name, tgt.name, gen_random_uuid());
      INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (t.saved_dataset_id, nm)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  INSERT INTO public.workbook_transform_inputs (transform_id, input_transform_id, input_import_id)
  SELECT tt.id,
         (SELECT id FROM public.workbook_transforms
           WHERE branch_id = tgt.id AND alias = ut.alias),
         i.input_import_id
    FROM public.workbook_transform_inputs i
    JOIN public.workbook_transforms st ON st.id = i.transform_id AND st.branch_id = p_branch
    JOIN public.workbook_transforms tt ON tt.branch_id = tgt.id AND tt.alias = st.alias
    LEFT JOIN public.workbook_transforms ut ON ut.id = i.input_transform_id;

  -- "the branch you just merged will be deleted automatically, unless it
  -- still has child branches"
  IF NOT EXISTS (SELECT 1 FROM public.workbook_branches c
                  WHERE c.parent_branch_id = p_branch) THEN
    DELETE FROM public.workbook_branches WHERE id = p_branch;
  END IF;
  RETURN merged;
END $$;
COMMENT ON FUNCTION public.merge_workbook_branch(uuid) IS
  'The merge: immediate parent only, the source''s logic replaces the target''s, each persisted output gets a vector-merge-{source}-{target}-{uuid} dataset branch (the attested naming), and the merged branch self-deletes unless children hold it. edit prepares; maintain is demanded by a protected target. INVOKER.';

CREATE FUNCTION public.delete_workbook_branch(p_branch uuid)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE b record;
BEGIN
  SELECT * INTO b FROM public.workbook_branches WHERE id = p_branch;
  IF b.id IS NULL THEN
    RAISE EXCEPTION 'CodeWorkbook:NoSuchBranch — % is not a branch you can see', p_branch;
  END IF;
  IF b.name = 'master' THEN
    RAISE EXCEPTION 'CodeWorkbook:CannotDeleteMaster — the default branch stays';
  END IF;
  -- "Deleting a branch that still has child branches … will re-parent"
  UPDATE public.workbook_branches
     SET parent_branch_id = b.parent_branch_id
   WHERE parent_branch_id = p_branch;
  DELETE FROM public.workbook_branches WHERE id = p_branch;
END $$;
COMMENT ON FUNCTION public.delete_workbook_branch(uuid) IS
  'Deletes a branch, re-parenting its children onto its parent — "Deleting a branch that still has child branches based on it will re-parent those branches" (code-workbook/branching-overview). master is not deletable; it is where project scoping (recorded, unbuilt) would live. INVOKER.';

-- a protected branch cannot be edited directly
CREATE FUNCTION public.guard_protected_workbook_branch()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prot boolean;
BEGIN
  SELECT b.protected INTO prot FROM public.workbook_branches b
   WHERE b.id = coalesce(NEW.branch_id, OLD.branch_id);
  IF prot THEN
    RAISE EXCEPTION 'CodeWorkbook:BranchProtected — nobody can make edits to the branch directly; all changes must be merged in through another branch';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER guard_protected_workbook_branch
  BEFORE INSERT OR UPDATE OR DELETE ON public.workbook_transforms
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_workbook_branch();

-- the merge must still rewrite the target: SECURITY DEFINER bypass is wrong;
-- instead the merge routes through a flag the trigger honors
CREATE OR REPLACE FUNCTION public.guard_protected_workbook_branch()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prot boolean;
BEGIN
  IF current_setting('beacon.workbook_merge', true) = 'on' THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  SELECT b.protected INTO prot FROM public.workbook_branches b
   WHERE b.id = coalesce(NEW.branch_id, OLD.branch_id);
  IF prot THEN
    RAISE EXCEPTION 'CodeWorkbook:BranchProtected — nobody can make edits to the branch directly; all changes must be merged in through another branch';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
COMMENT ON FUNCTION public.guard_protected_workbook_branch() IS
  '"If a branch is protected, nobody can make edits to the branch directly. Instead, all changes must be merged in through another branch" (code-workbook/branching-overview). merge_workbook_branch sets a transaction-local flag to write the target, after its own maintain check — the merge is the one documented way through.';

-- and the merge sets the flag
CREATE OR REPLACE FUNCTION public.merge_workbook_branch(p_branch uuid)
RETURNS integer LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  src record; tgt record; t record; merged integer := 0; ds uuid; nm text;
BEGIN
  SELECT * INTO src FROM public.workbook_branches WHERE id = p_branch;
  IF src.id IS NULL THEN
    RAISE EXCEPTION 'CodeWorkbook:NoSuchBranch — % is not a branch you can see', p_branch;
  END IF;
  IF src.parent_branch_id IS NULL THEN
    RAISE EXCEPTION 'CodeWorkbook:NothingAbove — Code Workbook only allows branches to be merged into their immediate parent, and this branch has none';
  END IF;
  SELECT * INTO tgt FROM public.workbook_branches WHERE id = src.parent_branch_id;
  IF NOT ('edit' = ANY (public.workbook_branch_permissions(src.workbook_id))) THEN
    RAISE EXCEPTION 'CodeWorkbook:NeedsEdit — preparing a merge into a parent branch always requires only edit permissions, which you lack';
  END IF;
  IF tgt.protected AND NOT ('maintain' = ANY (public.workbook_branch_permissions(src.workbook_id))) THEN
    RAISE EXCEPTION 'CodeWorkbook:NeedsMaintain — merging into a protected branch requires maintain permissions';
  END IF;

  PERFORM set_config('beacon.workbook_merge', 'on', true);
  DELETE FROM public.workbook_transforms WHERE branch_id = tgt.id;
  FOR t IN SELECT * FROM public.workbook_transforms
            WHERE branch_id = p_branch ORDER BY position, created_at LOOP
    INSERT INTO public.workbook_transforms
      (workbook_id, branch_id, alias, transform_type, language, source, config,
       template_version_id, persisted, saved_dataset_id, position)
    VALUES (t.workbook_id, tgt.id, t.alias, t.transform_type, t.language, t.source,
            t.config, t.template_version_id, t.persisted, t.saved_dataset_id, t.position);
    merged := merged + 1;
    IF t.persisted AND t.saved_dataset_id IS NOT NULL THEN
      nm := format('vector-merge-%s-%s-%s', src.name, tgt.name, gen_random_uuid());
      INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (t.saved_dataset_id, nm)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  INSERT INTO public.workbook_transform_inputs (transform_id, input_transform_id, input_import_id)
  SELECT tt.id,
         (SELECT id FROM public.workbook_transforms
           WHERE branch_id = tgt.id AND alias = ut.alias),
         i.input_import_id
    FROM public.workbook_transform_inputs i
    JOIN public.workbook_transforms st ON st.id = i.transform_id AND st.branch_id = p_branch
    JOIN public.workbook_transforms tt ON tt.branch_id = tgt.id AND tt.alias = st.alias
    LEFT JOIN public.workbook_transforms ut ON ut.id = i.input_transform_id;
  PERFORM set_config('beacon.workbook_merge', '', true);

  IF NOT EXISTS (SELECT 1 FROM public.workbook_branches c
                  WHERE c.parent_branch_id = p_branch) THEN
    DELETE FROM public.workbook_branches WHERE id = p_branch;
  END IF;
  RETURN merged;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbook_branch_dataset_pins TO authenticated;
ALTER TABLE public.workbook_branch_dataset_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read pins" ON public.workbook_branch_dataset_pins
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.workbook_branches b
                             WHERE b.id = branch_id
                               AND public.can_read_workbook(b.workbook_id)));
CREATE POLICY "author pins" ON public.workbook_branch_dataset_pins
  FOR ALL USING (EXISTS (SELECT 1 FROM public.workbook_branches b
                          WHERE b.id = branch_id
                            AND public.can_edit_workbook(b.workbook_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workbook_branches b
                       WHERE b.id = branch_id
                         AND public.can_edit_workbook(b.workbook_id)));

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; wb uuid; mbr uuid; dev uuid; ds uuid; outd uuid;
  ta uuid; n integer; imp uuid; br uuid; txn uuid;
  u1 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('cw-708') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('cw-708') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cw708@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'cw708@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'cw_708', 'CW 708') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'src_708', 'src_708') RETURNING id INTO ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
    VALUES (ds, txn, '[{"name": "v", "type": "DOUBLE"}]'::jsonb);
    PERFORM public.dataset_materialize(ds, txn);
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
    VALUES (ds, txn, 'seed/src.rows', 0);
    PERFORM public.commit_transaction(txn);
    SELECT public.create_code_workbook(proj, 'Branchy') INTO wb;
    SELECT id INTO mbr FROM public.workbook_branches WHERE workbook_id = wb;
    INSERT INTO public.workbook_imports (workbook_id, alias, dataset_id)
    VALUES (wb, 'src', ds) RETURNING id INTO imp;
    INSERT INTO public.workbook_transforms (workbook_id, branch_id, alias, source)
    VALUES (wb, mbr, 'clean', 'SELECT * FROM src') RETURNING id INTO ta;
    INSERT INTO public.workbook_transform_inputs (transform_id, input_import_id)
    VALUES (ta, imp);

    -- 1. Creating a branch copies the logic, pins the data, mirrors the repo.
    SELECT public.create_workbook_branch(wb, 'develop', NULL) INTO dev;
    IF (SELECT count(*) FROM public.workbook_transforms WHERE branch_id = dev) <> 1 THEN
      RAISE EXCEPTION 'the branch did not copy the logic';
    END IF;
    IF (SELECT transaction_id FROM public.workbook_branch_dataset_pins
         WHERE branch_id = dev AND dataset_id = ds) IS DISTINCT FROM txn THEN
      RAISE EXCEPTION 'the branch did not pin the dataset''s state';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.code_branches cb
                    JOIN public.code_workbooks w ON w.hidden_repository_id = cb.repository_id
                   WHERE w.id = wb AND cb.name = 'develop') THEN
      RAISE EXCEPTION 'the hidden repository did not mirror the branch';
    END IF;

    -- 2. Protecting master flips running off by default and blocks edits.
    PERFORM public.protect_workbook_branch(mbr, true, NULL);
    IF (SELECT allows_running FROM public.workbook_branches WHERE id = mbr) THEN
      RAISE EXCEPTION 'protection did not apply the no-running default';
    END IF;
    BEGIN
      UPDATE public.workbook_transforms SET source = 'SELECT 1' WHERE branch_id = mbr;
      RAISE EXCEPTION 'a protected branch was edited directly';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeWorkbook:BranchProtected%' THEN RAISE; END IF;
    END;

    -- 3. Editing develop, persisting there, then merging up: the target
    --    takes the source's logic, the persisted output grows a
    --    vector-merge branch, and develop self-deletes.
    UPDATE public.workbook_transforms SET source = 'SELECT * FROM src LIMIT 1'
     WHERE branch_id = dev;
    SELECT public.save_workbook_transform(
      (SELECT id FROM public.workbook_transforms WHERE branch_id = dev), NULL) INTO outd;
    SELECT public.merge_workbook_branch(dev) INTO n;
    IF n <> 1 THEN RAISE EXCEPTION 'the merge moved % transforms, not 1', n; END IF;
    IF (SELECT source FROM public.workbook_transforms WHERE branch_id = mbr)
       NOT LIKE '%LIMIT 1%' THEN
      RAISE EXCEPTION 'the target did not take the source''s logic';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.dataset_branches b
                    WHERE b.dataset_id = outd AND b.name LIKE 'vector-merge-develop-master-%') THEN
      RAISE EXCEPTION 'no vector-merge branch appeared on the output dataset';
    END IF;
    IF EXISTS (SELECT 1 FROM public.workbook_branches WHERE id = dev) THEN
      RAISE EXCEPTION 'the merged branch did not self-delete';
    END IF;

    -- 4. Deleting a branch re-parents its children; master refuses.
    SELECT public.create_workbook_branch(wb, 'a', NULL) INTO dev;
    PERFORM public.create_workbook_branch(wb, 'b', dev);
    PERFORM public.delete_workbook_branch(dev);
    IF (SELECT parent_branch_id FROM public.workbook_branches
         WHERE workbook_id = wb AND name = 'b') IS DISTINCT FROM mbr THEN
      RAISE EXCEPTION 'the child was not re-parented onto master';
    END IF;
    BEGIN
      PERFORM public.delete_workbook_branch(mbr);
      RAISE EXCEPTION 'master was deleted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeWorkbook:CannotDeleteMaster%' THEN RAISE; END IF;
    END;

    -- 5. The permission tokens follow the role: an owner holds all four.
    IF public.workbook_branch_permissions(wb) <> ARRAY['view', 'edit', 'maintain', 'manage'] THEN
      RAISE EXCEPTION 'an owner should hold all four levels';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '708 proved, as the caller: a new branch copies the logic, pins each dataset''s head transaction and mirrors into the hidden repository; protecting a branch applies the documented no-running default and blocks direct edits; a merge replaces the parent''s logic, grows a vector-merge-{source}-{target}-{uuid} branch on the persisted output and self-deletes; deleting re-parents children and master refuses; and an owner holds all four permission tokens';
  END;
END $$;
