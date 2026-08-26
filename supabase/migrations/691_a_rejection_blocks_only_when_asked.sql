-- 691: a rejection blocks only when the branch asks it to.
--
-- The post-build reconciliation re-read branch-settings against 690 and
-- found that I had made us STRICTER than Foundry, which the standing rule
-- forbids. 690's pull_request_blockers blocked on any rejection,
-- unconditionally. The page makes it one of two separately-chosen review
-- policies:
--
--   "* **Require no rejections before merging** - This will block the pull request from merging if at least one of the reviewers rejected the code changes."
--   — code-repositories/branch-settings.md
--
--   "* **Require at least one approval before merging** - This will ensure the code is reviewed and approved before changes are merged."
--   — code-repositories/branch-settings.md
--
-- and says plainly that a rejection is otherwise SUPERSEDED:
--
--   "Note that on its own, this policy allows rejections as long as an approval was received. For example, if one member of a group rejected the changes and another member approved, the approval will supersede the rejection unless "Require no rejections" policy applies."
--   — code-repositories/branch-settings.md
--
-- So require_no_rejections is a column, off by default, and the blocker
-- only fires when it is on. A branch that wants the old behaviour asks for
-- it; a branch that does not gets Foundry's.
--
-- 690 also listed four protection requirements where the page lists FIVE:
--
--   "* [Restrict stable version tags (Functions repositories only)](#restrict-stable-version-tags)"
--   — code-repositories/branch-settings.md
--
-- recorded here rather than built, because its semantics live on a section
-- this reading did not open and inventing them is the failure this whole
-- process exists to prevent.

ALTER TABLE public.code_branches
  ADD COLUMN require_no_rejections boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.code_branches.require_no_rejections IS
  'The Require-no-rejections review policy (code-repositories/branch-settings). OFF by default, because without it "the approval will supersede the rejection" — 690 blocked on any rejection unconditionally, which was stricter than Foundry.';

-- Patched whole rather than retyped: only the rejection arm changes, and
-- it changes from unconditional to asking the branch first.
CREATE OR REPLACE FUNCTION public.pull_request_blockers(p_pr uuid)
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

  -- the corrected arm: a rejection blocks only when the branch asks
  IF t.require_no_rejections
     AND EXISTS (SELECT 1 FROM public.code_reviews r
                  WHERE r.pull_request_id = p_pr AND r.decision = 'rejected') THEN
    reason := 'a reviewer rejected the changes, and this branch requires no rejections';
    RETURN NEXT;
  END IF;

  IF t.require_publish_check THEN
    IF NOT EXISTS (SELECT 1 FROM public.code_checks c
                    WHERE c.branch_id = pr.source_branch_id
                      AND c.name = 'ci/foundry-publish' AND c.status = 'succeeded') THEN
      reason := 'the publish check has not run successfully'; RETURN NEXT;
    END IF;
  END IF;

  IF t.require_security_approval THEN
    reason := 'security approval is required, and no security approver exists here yet';
    RETURN NEXT;
  END IF;
  RETURN;
END $$;
COMMENT ON FUNCTION public.pull_request_blockers(uuid) IS
  'Every reason a pull request cannot merge; empty means it can. The protection requirements code-repositories/branch-settings enumerates, with rejections blocking ONLY when require_no_rejections is set — without it "the approval will supersede the rejection". Restrict-stable-version-tags is the fifth requirement, recorded and not built. Security approval always blocks: storable, and nothing here can satisfy it.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; repo uuid; master uuid; sandbox uuid; pr uuid;
  n integer; u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); before text;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('rej-691') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('rej-691') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rej691a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rej691b@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'rej691a@beacon.test', 'admin', org),
      (u2, 'rej691b@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'rej_691', 'Rejections 691') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    SELECT public.create_code_repository(proj, 'Rejections 691', 'transforms') INTO repo;
    SELECT id INTO master FROM public.code_branches WHERE repository_id = repo AND name = 'master';
    INSERT INTO public.code_branches (repository_id, name) VALUES (repo, 'feature')
    RETURNING id INTO sandbox;
    INSERT INTO public.code_pull_requests (repository_id, source_branch_id, target_branch_id, title)
    VALUES (repo, sandbox, master, 'Change') RETURNING id INTO pr;

    -- 1. An approval satisfies the one required review.
    INSERT INTO public.code_reviews (pull_request_id, reviewer_id, decision)
    VALUES (pr, u1, 'approved');
    SELECT count(*) INTO n FROM public.pull_request_blockers(pr);
    IF n <> 0 THEN RAISE EXCEPTION 'an approved pull request still blocks: %', n; END IF;

    -- 2. THE CORRECTION: a rejection alongside it does NOT block by default,
    --    because "the approval will supersede the rejection".
    INSERT INTO public.code_reviews (pull_request_id, reviewer_id, decision)
    VALUES (pr, u2, 'rejected');
    SELECT count(*) INTO n FROM public.pull_request_blockers(pr);
    IF n <> 0 THEN
      RAISE EXCEPTION 'a rejection blocked without the branch requiring it — the 690 defect';
    END IF;

    -- 3. And it DOES block once the branch asks for no rejections.
    UPDATE public.code_branches SET require_no_rejections = true WHERE id = master;
    SELECT count(*) INTO n FROM public.pull_request_blockers(pr)
     WHERE reason LIKE 'a reviewer rejected%';
    IF n <> 1 THEN RAISE EXCEPTION 'require_no_rejections did not block a rejection'; END IF;
    BEGIN
      PERFORM public.merge_pull_request(pr);
      RAISE EXCEPTION 'a rejected pull request merged under require_no_rejections';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'CodeRepositories:MergeBlocked%' THEN RAISE; END IF;
    END;

    -- 4. Turning it off again lets the approval supersede, and the merge runs.
    UPDATE public.code_branches SET require_no_rejections = false WHERE id = master;
    PERFORM public.merge_pull_request(pr);
    IF (SELECT p.status FROM public.code_pull_requests p WHERE p.id = pr) <> 'merged' THEN
      RAISE EXCEPTION 'the merge did not run once rejections were allowed';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '691 proved: an approval clears the required review, a rejection beside it does NOT block by default (the 690 defect, corrected), it does block once the branch requires no rejections, and turning that off lets the approval supersede so the merge runs';
  END;
END $$;
