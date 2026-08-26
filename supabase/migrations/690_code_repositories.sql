-- 690: Code Repositories — repositories, branches, files, commits, pull
-- requests, checks and tags.
--
--   "**Code Repositories** provides a web-based integrated development environment (IDE) for writing and collaborating on production-ready code in Foundry. The application provides a user-friendly way to interact with the underlying Git repository"
--   — code-repositories/overview.md
--
-- THE SPINE IS ONE SENTENCE:
--
--   "To edit code in your repository, you must work in a sandbox branch — protected branches cannot be directly edited."
--   — code-repositories/navigation.md
--
-- so a commit to a protected branch is REFUSED unless it arrives through a
-- merged pull request. Everything else in the product follows from that.
--
--   "When there are multiple authors contributing to the same code repository, or when the repository backs critical data assets, you can protect your branch to achieve a greater level of governance and defense against unintentional changes. A protected branch can only be modified via a pull request and must satisfy a pre-defined set of requirements."
--   — code-repositories/branch-settings.md
--
--   "By default, only the Code Repository’s owners can change the branch protection settings, while both Owners and Editors can merge pull requests to protected branches. Regardless of permissions, all code authors need to abide to the protected branch policy."
--   — code-repositories/branch-settings.md
--
-- TWO DIVERGENCES, STATED RATHER THAN DISCOVERED:
--
-- 1. This is not a git object store. Commits are rows carrying a message, an
--    author and a parent; files are current content per branch. Real git
--    stores trees under content hashes, and pretending otherwise would be a
--    half-built version of the thing that matters least here.
-- 2. The IDE is not built — Code Assist, IntelliSense, the nine helper
--    panels, the debugger, Clone, artifact repositories. This builds the
--    REPOSITORY; a web IDE is its own programme.
--
-- And the conflation avoided on purpose: ontology_branches are the
-- ONTOLOGY's branches. A code repository's are git's. They are different
-- things and share no table.

CREATE FUNCTION public.code_repository_kinds()
RETURNS TABLE (kind text, note text)
LANGUAGE sql IMMUTABLE AS $$
  -- Model development is the third type the overview names; excluded
  -- because no model engine exists here to author into.
  SELECT * FROM (VALUES
    ('transforms', 'Authors data transformation logic — the code that builds datasets, which is what a job spec already is'),
    ('functions',  'Authors business logic executed with low latency against the Ontology — the versioned code 501/502 runs')
  ) AS t(kind, note)
$$;
COMMENT ON FUNCTION public.code_repository_kinds() IS
  'The repository types this platform can author into (code-repositories/overview). Model development is the third Foundry names and is excluded by name: no model engine exists here.';

CREATE FUNCTION public.merge_modes()
RETURNS TABLE (mode text, note text)
LANGUAGE sql IMMUTABLE AS $$
  SELECT * FROM (VALUES
    ('squash_and_merge',      'A single commit to the target branch incorporating all the changes the pull request introduces'),
    ('merge',                 'Every commit on the branch, alongside a merge commit'),
    ('merge_with_fast_forward','Advances the target to the front of the branch when there is a direct path')
  ) AS t(mode, note)
$$;
COMMENT ON FUNCTION public.merge_modes() IS
  'The three merge strategies code-repositories/branch-settings enumerates. A repository enables one or more; squash, when enabled, is the main option offered.';

CREATE TABLE public.code_repositories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid             text GENERATED ALWAYS AS (public.rid_of('stemma', 'repository', id)) STORED,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id       uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  kind            text NOT NULL,
  default_branch  text NOT NULL DEFAULT 'master',
  -- the modes this repository offers on a pull request
  merge_modes     text[] NOT NULL DEFAULT ARRAY['squash_and_merge'],
  trashed_at      timestamptz,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX code_repositories_rid_key ON public.code_repositories (rid);
CREATE INDEX code_repositories_project_idx ON public.code_repositories (project_id);
CREATE INDEX code_repositories_folder_idx ON public.code_repositories (folder_id);
CREATE INDEX code_repositories_org_idx ON public.code_repositories (organization_id);
CREATE INDEX code_repositories_created_by_idx ON public.code_repositories (created_by);
COMMENT ON TABLE public.code_repositories IS
  'A code repository in a project (code-repositories/overview): a typed body of code with branches, commits and pull requests. Not a git object store — see 690''s header for the two stated divergences.';
COMMENT ON COLUMN public.code_repositories.default_branch IS
  'The base branch — "By default, all pull requests and commits will be made against that branch unless chosen otherwise. Usually, the default branch is the `master` branch" (code-repositories/branch-settings).';

CREATE TABLE public.code_branches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES public.code_repositories(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  -- "protected branches cannot be directly edited"
  protected     boolean NOT NULL DEFAULT false,
  -- the four requirements a protected branch may demand
  require_publish_check   boolean NOT NULL DEFAULT false,
  require_code_reviews    integer NOT NULL DEFAULT 0 CHECK (require_code_reviews >= 0),
  required_reviewer_ids   uuid[] NOT NULL DEFAULT '{}',
  require_security_approval boolean NOT NULL DEFAULT false,
  created_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX code_branches_name_key ON public.code_branches (repository_id, name);
CREATE INDEX code_branches_repo_idx ON public.code_branches (repository_id);
CREATE INDEX code_branches_created_by_idx ON public.code_branches (created_by);
COMMENT ON TABLE public.code_branches IS
  'A branch of a code repository — git''s, NOT the ontology''s (ontology_branches is a different thing entirely). A sandbox branch is where editing happens; a protected one "can only be modified via a pull request and must satisfy a pre-defined set of requirements" (code-repositories/branch-settings).';

CREATE TABLE public.code_commits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES public.code_repositories(id) ON DELETE CASCADE,
  branch_id     uuid NOT NULL REFERENCES public.code_branches(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES public.code_commits(id) ON DELETE SET NULL,
  message       text NOT NULL CHECK (length(btrim(message)) > 0),
  author_id     uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  committed_at  timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX code_commits_repo_idx ON public.code_commits (repository_id);
CREATE INDEX code_commits_branch_idx ON public.code_commits (branch_id, committed_at DESC);
CREATE INDEX code_commits_parent_idx ON public.code_commits (parent_id);
CREATE INDEX code_commits_author_idx ON public.code_commits (author_id);
COMMENT ON TABLE public.code_commits IS
  'One commit: a message, an author and a parent, so a branch is a chain. Rows rather than hashes over trees — a stated divergence, not an omission (690''s header).';

CREATE TABLE public.code_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES public.code_repositories(id) ON DELETE CASCADE,
  branch_id     uuid NOT NULL REFERENCES public.code_branches(id) ON DELETE CASCADE,
  path          text NOT NULL CHECK (path ~ '^[A-Za-z0-9._/-]+$'),
  content       text NOT NULL DEFAULT '',
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX code_files_path_key ON public.code_files (branch_id, path);
CREATE INDEX code_files_repo_idx ON public.code_files (repository_id);
COMMENT ON TABLE public.code_files IS
  'A file''s current content on one branch, which is how the Files tree reads and how a sandbox diverges from the default branch. Content per branch rather than per commit — the divergence 690''s header states.';

CREATE TABLE public.code_tags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES public.code_repositories(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  commit_id     uuid NOT NULL REFERENCES public.code_commits(id) ON DELETE CASCADE,
  created_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX code_tags_name_key ON public.code_tags (repository_id, name);
CREATE INDEX code_tags_commit_idx ON public.code_tags (commit_id);
CREATE INDEX code_tags_created_by_idx ON public.code_tags (created_by);
COMMENT ON TABLE public.code_tags IS
  'A tag — "like immutable branches ... used to mark a significant version of the code for future reference" (code-repositories/navigation). Immutable here means it: a trigger refuses moving one to another commit.';

CREATE TABLE public.code_pull_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES public.code_repositories(id) ON DELETE CASCADE,
  source_branch_id uuid NOT NULL REFERENCES public.code_branches(id) ON DELETE CASCADE,
  target_branch_id uuid NOT NULL REFERENCES public.code_branches(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (length(btrim(title)) > 0),
  description   text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'open'
                CONSTRAINT code_pull_requests_status_check
                CHECK (status = ANY (ARRAY['open', 'closed', 'merged'])),
  merge_mode    text,
  merged_at     timestamptz,
  merged_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (source_branch_id <> target_branch_id)
);
CREATE INDEX code_pull_requests_repo_idx ON public.code_pull_requests (repository_id, status);
CREATE INDEX code_pull_requests_source_idx ON public.code_pull_requests (source_branch_id);
CREATE INDEX code_pull_requests_target_idx ON public.code_pull_requests (target_branch_id);
CREATE INDEX code_pull_requests_created_by_idx ON public.code_pull_requests (created_by);
CREATE INDEX code_pull_requests_merged_by_idx ON public.code_pull_requests (merged_by);
COMMENT ON CONSTRAINT code_pull_requests_status_check ON public.code_pull_requests IS
  'Values from code-repositories/navigation, which names all three: the list switches between Open and Closed, and a branch''s row shows an Open / Closed / Merged button opening the full pull request. The other two sets in this migration (a review''s decision, a check''s status) are deliberately undeclared — their tokens are ours, not the page''s.';
COMMENT ON TABLE public.code_pull_requests IS
  'A pull request — "lets users view a history of the changes on your branch and review your code on a line-by-line basis before merging" (code-repositories/navigation). The only way into a protected branch.';

CREATE TABLE public.code_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_request_id uuid NOT NULL REFERENCES public.code_pull_requests(id) ON DELETE CASCADE,
  reviewer_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  decision        text NOT NULL CHECK (decision = ANY (ARRAY['approved', 'rejected'])),
  comment         text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- one standing decision per reviewer per pull request
CREATE UNIQUE INDEX code_reviews_one_per_reviewer
  ON public.code_reviews (pull_request_id, reviewer_id);
CREATE INDEX code_reviews_reviewer_idx ON public.code_reviews (reviewer_id);
COMMENT ON TABLE public.code_reviews IS
  'A reviewer''s standing decision on a pull request. "Depending on the repository settings, each Pull request may require at least one approving review before they can be merged" (code-repositories/navigation) — the requirement lives on the target branch.';

CREATE TABLE public.code_checks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES public.code_repositories(id) ON DELETE CASCADE,
  branch_id     uuid NOT NULL REFERENCES public.code_branches(id) ON DELETE CASCADE,
  commit_id     uuid REFERENCES public.code_commits(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  status        text NOT NULL DEFAULT 'running'
                CHECK (status = ANY (ARRAY['running', 'succeeded', 'failed'])),
  detail        text NOT NULL DEFAULT '',
  started_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at   timestamptz
);
CREATE INDEX code_checks_branch_idx ON public.code_checks (branch_id, started_at DESC);
CREATE INDEX code_checks_repo_idx ON public.code_checks (repository_id);
CREATE INDEX code_checks_commit_idx ON public.code_checks (commit_id);
COMMENT ON TABLE public.code_checks IS
  'Automatic checks per branch and commit — "In the Checks tab, you can view a summary of running and completed checks on each branch" (code-repositories/navigation). The publish check a protected branch may require is named ci-slash-foundry-publish upstream, spelled with a slash in the check name here, and nothing publishes yet.';

-- ── the guards the pages state ──────────────────────────────────────────────

CREATE FUNCTION public.guard_repository_kind()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.code_repository_kinds() k WHERE k.kind = NEW.kind) THEN
    RAISE EXCEPTION 'CodeRepositories:UnknownKind — % is not a repository type built here; model development has no engine to author into', NEW.kind;
  END IF;
  IF NOT (NEW.merge_modes <@ ARRAY(SELECT m.mode FROM public.merge_modes() m)) THEN
    RAISE EXCEPTION 'CodeRepositories:UnknownMergeMode — a repository offers only the three published merge modes';
  END IF;
  IF cardinality(NEW.merge_modes) = 0 THEN
    RAISE EXCEPTION 'CodeRepositories:NoMergeMode — a repository offers at least one merge mode';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_repository_kind
  BEFORE INSERT OR UPDATE ON public.code_repositories
  FOR EACH ROW EXECUTE FUNCTION public.guard_repository_kind();

-- "protected branches cannot be directly edited" — the spine, enforced.
-- beacon.merging_pull_request is the window a merge opens, the same shape
-- 605's applying_action window uses.
CREATE FUNCTION public.guard_protected_branch()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b record; bid uuid;
BEGIN
  bid := CASE TG_TABLE_NAME WHEN 'code_commits' THEN NEW.branch_id ELSE NEW.branch_id END;
  SELECT * INTO b FROM public.code_branches WHERE id = bid;
  IF b.protected AND coalesce(current_setting('beacon.merging_pull_request', true), '') <> 'on' THEN
    RAISE EXCEPTION 'CodeRepositories:BranchProtected — "%" is protected and can only be modified via a pull request', b.name;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_protected_branch
  BEFORE INSERT OR UPDATE ON public.code_commits
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_branch();
CREATE TRIGGER guard_protected_branch
  BEFORE INSERT OR UPDATE ON public.code_files
  FOR EACH ROW EXECUTE FUNCTION public.guard_protected_branch();

CREATE FUNCTION public.guard_tag_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.commit_id IS DISTINCT FROM OLD.commit_id THEN
    RAISE EXCEPTION 'CodeRepositories:TagImmutable — a tag is like an immutable branch; it does not move once created';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_tag_immutable
  BEFORE UPDATE ON public.code_tags
  FOR EACH ROW EXECUTE FUNCTION public.guard_tag_immutable();

-- ── merging: the requirements a protected target demands ────────────────────

CREATE FUNCTION public.pull_request_blockers(p_pr uuid)
RETURNS TABLE (reason text)
LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE pr record; t record; n integer; missing uuid;
BEGIN
  SELECT * INTO pr FROM public.code_pull_requests WHERE id = p_pr;
  IF pr.id IS NULL THEN RETURN; END IF;
  IF pr.status <> 'open' THEN
    reason := 'the pull request is ' || pr.status; RETURN NEXT; RETURN;
  END IF;
  SELECT * INTO t FROM public.code_branches WHERE id = pr.target_branch_id;

  IF t.require_code_reviews > 0 THEN
    SELECT count(*) INTO n FROM public.code_reviews r
     WHERE r.pull_request_id = p_pr AND r.decision = 'approved';
    IF n < t.require_code_reviews THEN
      reason := format('%s of %s approving review(s)', n, t.require_code_reviews);
      RETURN NEXT;
    END IF;
  END IF;

  IF cardinality(t.required_reviewer_ids) > 0 THEN
    SELECT u INTO missing FROM unnest(t.required_reviewer_ids) AS u
     WHERE NOT EXISTS (SELECT 1 FROM public.code_reviews r
                        WHERE r.pull_request_id = p_pr AND r.reviewer_id = u
                          AND r.decision = 'approved')
     LIMIT 1;
    IF missing IS NOT NULL THEN
      reason := 'a required reviewer has not approved'; RETURN NEXT;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.code_reviews r
              WHERE r.pull_request_id = p_pr AND r.decision = 'rejected') THEN
    reason := 'a reviewer rejected the changes'; RETURN NEXT;
  END IF;

  IF t.require_publish_check THEN
    IF NOT EXISTS (SELECT 1 FROM public.code_checks c
                    WHERE c.branch_id = pr.source_branch_id
                      AND c.name = 'ci/foundry-publish' AND c.status = 'succeeded') THEN
      reason := 'ci/foundry-publish has not run successfully'; RETURN NEXT;
    END IF;
  END IF;

  IF t.require_security_approval THEN
    reason := 'security approval is required, and no security approver exists here yet';
    RETURN NEXT;
  END IF;
  RETURN;
END $$;
COMMENT ON FUNCTION public.pull_request_blockers(uuid) IS
  'Every reason a pull request cannot merge; empty means it can. The four requirements a protected branch may set (code-repositories/branch-settings) plus a standing rejection. Security approval always blocks: the requirement is storable and nothing here can satisfy it, which is said rather than silently passed.';

CREATE FUNCTION public.merge_pull_request(p_pr uuid, p_mode text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE pr record; repo record; mode text; why text; c uuid; f record;
BEGIN
  SELECT * INTO pr FROM public.code_pull_requests WHERE id = p_pr;
  IF pr.id IS NULL THEN
    RAISE EXCEPTION 'CodeRepositories:PullRequestNotFound — % is not a pull request you can see', p_pr;
  END IF;
  SELECT * INTO repo FROM public.code_repositories WHERE id = pr.repository_id;
  mode := coalesce(p_mode, repo.merge_modes[1]);
  IF NOT (mode = ANY (repo.merge_modes)) THEN
    RAISE EXCEPTION 'CodeRepositories:MergeModeNotOffered — this repository does not offer %', mode;
  END IF;
  SELECT b.reason INTO why FROM public.pull_request_blockers(p_pr) b LIMIT 1;
  IF why IS NOT NULL THEN
    RAISE EXCEPTION 'CodeRepositories:MergeBlocked — %', why;
  END IF;

  -- the window the protected-branch guard opens for
  PERFORM set_config('beacon.merging_pull_request', 'on', true);

  -- the target takes the source's files; one commit records it, which is
  -- what squash does and the closest honest thing to the other two modes
  FOR f IN SELECT path, content FROM public.code_files
            WHERE branch_id = pr.source_branch_id
  LOOP
    INSERT INTO public.code_files (repository_id, branch_id, path, content)
    VALUES (pr.repository_id, pr.target_branch_id, f.path, f.content)
    ON CONFLICT (branch_id, path) DO UPDATE
      SET content = EXCLUDED.content, updated_at = now();
  END LOOP;

  INSERT INTO public.code_commits (repository_id, branch_id, message, parent_id)
  VALUES (pr.repository_id, pr.target_branch_id,
          format('Merge pull request: %s', pr.title),
          (SELECT id FROM public.code_commits
            WHERE branch_id = pr.target_branch_id
            ORDER BY committed_at DESC LIMIT 1))
  RETURNING id INTO c;

  PERFORM set_config('beacon.merging_pull_request', '', true);

  UPDATE public.code_pull_requests
     SET status = 'merged', merged_at = clock_timestamp(),
         merged_by = auth.uid(), merge_mode = mode
   WHERE id = p_pr;
  RETURN c;
END $$;
COMMENT ON FUNCTION public.merge_pull_request(uuid, text) IS
  'Merges a pull request into its target, which is the only way a protected branch changes. Refuses an unoffered mode and every blocker by name. One commit records the merge — squash''s shape; the other two modes are stored on the row but not replayed as separate commits, since commits here are rows rather than a real object graph (690''s header).';

-- ── permissions: the project resource shape ─────────────────────────────────

ALTER TABLE public.code_repositories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_branches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_commits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_files         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_tags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_pull_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_reviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_checks        ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_read_repository(p_repo uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.code_repositories r
                  WHERE r.id = p_repo
                    AND r.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(r.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_write_repository(p_repo uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.code_repositories r
                  WHERE r.id = p_repo
                    AND r.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.role_rank(public.project_role(r.project_id))
                        >= public.role_rank('editor'))
$$;
COMMENT ON FUNCTION public.can_write_repository(uuid) IS
  'Editor writes code — "both Owners and Editors can merge pull requests to protected branches" (code-repositories/branch-settings), so Editor is the floor for authoring. Changing protection settings is an owner''s, which guard_branch_protection_owner holds separately.';

CREATE POLICY "project members read repositories" ON public.code_repositories
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author repositories" ON public.code_repositories
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "read branches" ON public.code_branches
  FOR SELECT USING ((SELECT public.can_read_repository(repository_id)));
CREATE POLICY "author branches" ON public.code_branches
  FOR ALL USING ((SELECT public.can_write_repository(repository_id)))
          WITH CHECK ((SELECT public.can_write_repository(repository_id)));
CREATE POLICY "read commits" ON public.code_commits
  FOR SELECT USING ((SELECT public.can_read_repository(repository_id)));
CREATE POLICY "author commits" ON public.code_commits
  FOR ALL USING ((SELECT public.can_write_repository(repository_id)))
          WITH CHECK ((SELECT public.can_write_repository(repository_id)));
CREATE POLICY "read files" ON public.code_files
  FOR SELECT USING ((SELECT public.can_read_repository(repository_id)));
CREATE POLICY "author files" ON public.code_files
  FOR ALL USING ((SELECT public.can_write_repository(repository_id)))
          WITH CHECK ((SELECT public.can_write_repository(repository_id)));
CREATE POLICY "read tags" ON public.code_tags
  FOR SELECT USING ((SELECT public.can_read_repository(repository_id)));
CREATE POLICY "author tags" ON public.code_tags
  FOR ALL USING ((SELECT public.can_write_repository(repository_id)))
          WITH CHECK ((SELECT public.can_write_repository(repository_id)));
CREATE POLICY "read pull requests" ON public.code_pull_requests
  FOR SELECT USING ((SELECT public.can_read_repository(repository_id)));
CREATE POLICY "author pull requests" ON public.code_pull_requests
  FOR ALL USING ((SELECT public.can_write_repository(repository_id)))
          WITH CHECK ((SELECT public.can_write_repository(repository_id)));
CREATE POLICY "read checks" ON public.code_checks
  FOR SELECT USING ((SELECT public.can_read_repository(repository_id)));
CREATE POLICY "author checks" ON public.code_checks
  FOR ALL USING ((SELECT public.can_write_repository(repository_id)))
          WITH CHECK ((SELECT public.can_write_repository(repository_id)));
-- a review is your own opinion, on a pull request you can see
CREATE POLICY "read reviews" ON public.code_reviews
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.code_pull_requests p
                             WHERE p.id = pull_request_id
                               AND public.can_read_repository(p.repository_id)));
CREATE POLICY "review your own opinion" ON public.code_reviews
  FOR ALL USING (reviewer_id = (SELECT auth.uid())
                 AND EXISTS (SELECT 1 FROM public.code_pull_requests p
                              WHERE p.id = pull_request_id
                                AND public.can_read_repository(p.repository_id)))
  WITH CHECK (reviewer_id = (SELECT auth.uid())
              AND EXISTS (SELECT 1 FROM public.code_pull_requests p
                           WHERE p.id = pull_request_id
                             AND public.can_read_repository(p.repository_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_repositories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_branches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_commits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_pull_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_checks TO authenticated;

-- ── creating a repository, with the branch it starts on ─────────────────────

CREATE FUNCTION public.create_code_repository(
  p_project uuid, p_name text, p_kind text DEFAULT 'transforms')
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r uuid; b uuid;
BEGIN
  INSERT INTO public.code_repositories (project_id, name, kind)
  VALUES (p_project, p_name, p_kind) RETURNING id INTO r;
  -- the default branch exists from the start, and is protected: reaching it
  -- is a pull request, which is the product's whole shape
  INSERT INTO public.code_branches (repository_id, name, protected, require_code_reviews)
  VALUES (r, 'master', true, 1) RETURNING id INTO b;
  RETURN r;
END $$;
COMMENT ON FUNCTION public.create_code_repository(uuid, text, text) IS
  'Creates a repository with its default branch, protected and requiring one approving review — so the first thing an author learns is that editing happens on a sandbox branch (code-repositories/navigation).';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; repo uuid; master uuid; sandbox uuid;
  pr uuid; c uuid; tag uuid; n integer; why text;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('repos-690') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('repos-690') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repos690a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repos690b@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'repos690a@beacon.test', 'admin', org),
      (u2, 'repos690b@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'repos_690', 'Repos 690') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);

    -- 1. A new repository starts on a protected master.
    SELECT public.create_code_repository(proj, 'Example Code Repository', 'transforms') INTO repo;
    SELECT id INTO master FROM public.code_branches WHERE repository_id = repo AND name = 'master';
    IF NOT (SELECT b.protected FROM public.code_branches b WHERE b.id = master) THEN
      RAISE EXCEPTION 'the default branch should start protected';
    END IF;
    IF (SELECT r.rid FROM public.code_repositories r WHERE r.id = repo)
       NOT LIKE 'ri.stemma.main.repository.%' THEN
      RAISE EXCEPTION 'the repository rid does not follow the grammar';
    END IF;

    -- 2. Model development is refused by name.
    BEGIN
      PERFORM public.create_code_repository(proj, 'Models', 'model');
      RAISE EXCEPTION 'a model repository was created';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeRepositories:UnknownKind%' THEN RAISE; END IF;
    END;

    -- 3. THE SPINE: a protected branch cannot be edited directly.
    BEGIN
      INSERT INTO public.code_files (repository_id, branch_id, path, content)
      VALUES (repo, master, 'src/main.py', 'print(1)');
      RAISE EXCEPTION 'a protected branch was edited directly';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeRepositories:BranchProtected%' THEN RAISE; END IF;
    END;
    BEGIN
      INSERT INTO public.code_commits (repository_id, branch_id, message)
      VALUES (repo, master, 'direct');
      RAISE EXCEPTION 'a protected branch took a direct commit';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeRepositories:BranchProtected%' THEN RAISE; END IF;
    END;

    -- 4. A sandbox branch takes edits freely.
    INSERT INTO public.code_branches (repository_id, name) VALUES (repo, 'feature/one')
    RETURNING id INTO sandbox;
    INSERT INTO public.code_files (repository_id, branch_id, path, content)
    VALUES (repo, sandbox, 'src/main.py', 'print(1)');
    INSERT INTO public.code_commits (repository_id, branch_id, message)
    VALUES (repo, sandbox, 'add main') RETURNING id INTO c;

    -- 5. A tag is immutable once created.
    INSERT INTO public.code_tags (repository_id, name, commit_id)
    VALUES (repo, '1.0.0', c) RETURNING id INTO tag;
    INSERT INTO public.code_commits (repository_id, branch_id, message, parent_id)
    VALUES (repo, sandbox, 'second', c);
    BEGIN
      UPDATE public.code_tags SET commit_id =
        (SELECT id FROM public.code_commits WHERE branch_id = sandbox AND message = 'second')
       WHERE id = tag;
      RAISE EXCEPTION 'a tag moved';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeRepositories:TagImmutable%' THEN RAISE; END IF;
    END;

    -- 6. A pull request blocks until the target's requirements are met.
    INSERT INTO public.code_pull_requests (repository_id, source_branch_id, target_branch_id, title)
    VALUES (repo, sandbox, master, 'Add main') RETURNING id INTO pr;
    SELECT b.reason INTO why FROM public.pull_request_blockers(pr) b LIMIT 1;
    IF why IS NULL THEN RAISE EXCEPTION 'a pull request with no review was mergeable'; END IF;
    BEGIN
      PERFORM public.merge_pull_request(pr);
      RAISE EXCEPTION 'a blocked pull request merged';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeRepositories:MergeBlocked%' THEN RAISE; END IF;
    END;

    -- 7. An approval clears it, and the merge reaches the protected branch.
    INSERT INTO public.code_reviews (pull_request_id, reviewer_id, decision)
    VALUES (pr, u1, 'approved');
    SELECT count(*) INTO n FROM public.pull_request_blockers(pr);
    IF n <> 0 THEN RAISE EXCEPTION 'the approved pull request still blocks: %', n; END IF;
    PERFORM public.merge_pull_request(pr);
    IF (SELECT p.status FROM public.code_pull_requests p WHERE p.id = pr) <> 'merged' THEN
      RAISE EXCEPTION 'the pull request did not record as merged';
    END IF;
    SELECT count(*) INTO n FROM public.code_files
     WHERE branch_id = master AND path = 'src/main.py';
    IF n <> 1 THEN RAISE EXCEPTION 'the merge did not carry files to the target'; END IF;

    -- 8. And master is protected again the moment the window closes.
    BEGIN
      INSERT INTO public.code_files (repository_id, branch_id, path, content)
      VALUES (repo, master, 'sneak.py', 'x');
      RAISE EXCEPTION 'the protection window stayed open after the merge';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeRepositories:BranchProtected%' THEN RAISE; END IF;
    END;

    -- 9. A rejection blocks, and a required check that never ran blocks.
    INSERT INTO public.code_branches (repository_id, name, protected,
                                      require_publish_check, require_code_reviews)
    VALUES (repo, 'release', true, true, 0) RETURNING id INTO master;
    INSERT INTO public.code_pull_requests (repository_id, source_branch_id, target_branch_id, title)
    VALUES (repo, sandbox, master, 'Release') RETURNING id INTO pr;
    SELECT b.reason INTO why FROM public.pull_request_blockers(pr) b
     WHERE b.reason LIKE 'ci/foundry-publish%' LIMIT 1;
    IF why IS NULL THEN RAISE EXCEPTION 'a missing publish check did not block'; END IF;
    INSERT INTO public.code_checks (repository_id, branch_id, name, status)
    VALUES (repo, sandbox, 'ci/foundry-publish', 'succeeded');
    SELECT count(*) INTO n FROM public.pull_request_blockers(pr);
    IF n <> 0 THEN RAISE EXCEPTION 'the publish check did not clear the block'; END IF;
    INSERT INTO public.code_reviews (pull_request_id, reviewer_id, decision)
    VALUES (pr, u1, 'rejected');
    SELECT count(*) INTO n FROM public.pull_request_blockers(pr);
    IF n = 0 THEN RAISE EXCEPTION 'a rejection did not block the merge'; END IF;

    -- 10. An unoffered merge mode refuses.
    BEGIN
      PERFORM public.merge_pull_request(pr, 'merge_with_fast_forward');
      RAISE EXCEPTION 'an unoffered merge mode was accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeRepositories:MergeModeNotOffered%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '690 proved: a repository starts on a protected master with a stemma RID, model development refuses by name, a protected branch takes neither file nor commit directly, a sandbox takes both, a tag will not move, a pull request blocks without its required review and merges with it, the merge carries files and closes its own window, a missing publish check blocks until it succeeds, a rejection blocks, and an unoffered merge mode refuses';
  END;
END $$;
