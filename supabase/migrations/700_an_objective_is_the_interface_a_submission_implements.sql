-- 700: a modeling objective is the interface; a submission implements it.
--
--   "You can think of an objective as the definition for a modeling problem—the *interface* of the problem, for which the models submitted provide the *implementation*."
--   — model-integration/objectives.md
--
-- A SUBMISSION IS A COPY, which is the load-bearing storage decision here:
--
--   "When a model is submitted to a modeling objective to be managed and evaluated, a copy of that model version is created. This immutable submission is akin to a code Pull Request - when submitting a model, you are asking for a comprehensive review."
--   — model-integration/objectives.md
--
-- and concepts_concept-flow1.png proves the copy by drawing MODEL C both
-- standing alone and inside the objective. So a submission snapshots the
-- version's artifacts and adapter address at submit time, and keeps the
-- reference only for provenance and metrics.
--
-- RELEASES: two kinds, promotion is a named act, and a released submission
-- is protected:
--
--   "A **production release** represents the best current model and will power all production deployments in its modeling objective."
--   — manage-models/release-model.md
--
--   "A **staging release** is a release that is staged to become the production release; staging releases are used in all staging deployments."
--   — manage-models/release-model.md
--
--   "Once a model submission has been released, it can no longer be archived."
--   — manage-models/release-model.md
--
-- A RELEASE CARRIES TAGS, PLURAL — the pre-build adversary pass caught my
-- first design flipping one environment column, and the release history
-- capture falsifies that: both its rows carry BOTH badges,
--
--   "2.0 Staging Production … Tagged production on Mon, Nov 28, 2022"
--   — manage-models/images/manage_release-history.png
--
-- and the prose agrees
-- the tag field is plural and open — "configurable environment tags (such as
-- "Staging" or "Production")". So a release is staging-tagged from birth
-- (created_at is that tag's timestamp) and promotion ADDS the production tag
-- (promoted_at is the capture's "Tagged production on"). Creation makes a
-- staging release because that is the only creation the page documents
-- ("Create a new staging release"); nothing refuses a workflow the pages
-- describe. The selector then follows the tag through its own timestamp:
--
--   "Every release will overwrite the previous release for that environment, and all deployments in that environment will automatically be upgraded to use the newly released model."
--   — manage-models/release-model.md
--
-- CHECKS ADVISE AND NEVER BLOCK, which is the trap this build stepped around
-- BEFORE writing a trigger rather than after:
--
--   "Currently, it is not mandatory for all checks to be approved before creating a release for a model submission."
--   — manage-models/set-up-checks.md
--
-- So there is no check-gate on create_release below, deliberately. An
-- automatic check computes its status from the metric sets:
--
--   "A `PASS` status is achieved when the metric satisfies the requirement. If the metric fails the requirement or is not found in the set of metrics produced by the chosen evaluation library, a status of `REJECT` is given with a message describing the reason for rejection. If metrics were not yet built for the combination of submission, input dataset, and evaluation library associated with the check, the status of the check will be `PENDING`."
--   — manage-models/set-up-checks.md
--
-- The objective RID kind is NOT attested anywhere in the five model sections
-- (grepped for `ri.` near objective, nothing) — the token below is marked
-- inference, the 488 precedent for a kind the docs are silent on.

-- ── the objective, a project resource ───────────────────────────────────────

CREATE TABLE public.modeling_objectives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- the service is attested (ri.models.…); the KIND token is inference
  rid             text GENERATED ALWAYS AS (public.rid_of('models', 'objective', id)) STORED,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id()
                    REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  folder_id       uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  description     text NOT NULL DEFAULT '',
  -- "Custom metadata fields can be collected with each model submission"
  metadata_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  trashed_at      timestamptz,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(metadata_fields) = 'array')
);
CREATE UNIQUE INDEX modeling_objectives_rid_key ON public.modeling_objectives (rid);
CREATE INDEX modeling_objectives_project_idx ON public.modeling_objectives (project_id);
CREATE INDEX modeling_objectives_folder_idx ON public.modeling_objectives (folder_id);
CREATE INDEX modeling_objectives_org_idx ON public.modeling_objectives (organization_id);
CREATE INDEX modeling_objectives_created_by_idx ON public.modeling_objectives (created_by);
COMMENT ON TABLE public.modeling_objectives IS
  'The definition of a modeling problem — "the interface of the problem, for which the models submitted provide the implementation" (model-integration/objectives). A project resource. The RID kind token `objective` is INFERENCE: no page in the five model sections prints an objective RID; the service half is attested by ri.models.main.model.';

-- ── the submission: an immutable copy ───────────────────────────────────────

CREATE TABLE public.objective_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id     uuid NOT NULL REFERENCES public.modeling_objectives(id) ON DELETE CASCADE,
  -- provenance references; the copy below is what downstream consumes
  model_id         uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  model_version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  -- "a copy of that model version is created" — artifacts and the adapter's
  -- call address, frozen at submit time
  snapshot         jsonb NOT NULL,
  -- the objective's custom metadata fields, filled per submission
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at      timestamptz,
  submitted_by     uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(snapshot) = 'object'),
  CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX objective_submissions_objective_idx ON public.objective_submissions (objective_id);
CREATE INDEX objective_submissions_model_idx ON public.objective_submissions (model_id);
CREATE INDEX objective_submissions_version_idx ON public.objective_submissions (model_version_id);
CREATE INDEX objective_submissions_submitted_by_idx ON public.objective_submissions (submitted_by);
COMMENT ON TABLE public.objective_submissions IS
  'One immutable submission — "akin to a code Pull Request" (model-integration/objectives). The snapshot IS the copy the page describes: artifacts plus the adapter''s call address, frozen at submit time, so later changes to the model cannot reach a submission under review. Archiving hides it; "Foundry provides model archiving instead of hard deletion" (manage-models/archive-model).';

-- the copy does not change after submission; archiving is the one exception
CREATE FUNCTION public.guard_submission_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- the COPY is what "immutable" scopes to (objectives.md); the metadata
  -- fields are collaboration data and stay editable, as does archiving
  IF NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.objective_id IS DISTINCT FROM OLD.objective_id
     OR NEW.model_version_id IS DISTINCT FROM OLD.model_version_id THEN
    RAISE EXCEPTION 'Objectives:SubmissionImmutable — the submitted copy is immutable; submit a new version';
  END IF;
  -- "Once a model submission has been released, it can no longer be archived."
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL
     AND EXISTS (SELECT 1 FROM public.objective_releases r WHERE r.submission_id = NEW.id) THEN
    RAISE EXCEPTION 'Objectives:ReleasedSubmissionsCannotBeArchived — this submission has a release';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_submission_immutable
  BEFORE UPDATE ON public.objective_submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_submission_immutable();

-- ── reviews: comment, accept, reject ────────────────────────────────────────

CREATE TABLE public.submission_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.objective_submissions(id) ON DELETE CASCADE,
  decision      text NOT NULL DEFAULT 'comment'
                  CONSTRAINT submission_reviews_decision_check
                  CHECK (decision = ANY (ARRAY['comment', 'accept', 'reject'])),
  body          text NOT NULL DEFAULT '',
  created_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submission_reviews_submission_idx ON public.submission_reviews (submission_id);
CREATE INDEX submission_reviews_created_by_idx ON public.submission_reviews (created_by);
COMMENT ON TABLE public.submission_reviews IS
  '"Reviews on models allow various stakeholders from different backgrounds to collaborate on model evaluation" (manage-models/review-model). One row per review left on a submission.';
COMMENT ON CONSTRAINT submission_reviews_decision_check ON public.submission_reviews IS
  'The three options the review panel draws — Leave comment ("Submit general feedback without explicit approval"), Accept ("Approve this model to be tagged as a release"), Reject ("Reject this model") — from manage-models/images/concepts_concept-review.png. Deliberately NOT declared with a page: the set comes from a capture, and no prose page prints it.';

-- ── checks: configured per objective, manual or automatic ───────────────────

CREATE TABLE public.objective_checks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id  uuid NOT NULL REFERENCES public.modeling_objectives(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  description   text NOT NULL DEFAULT '',
  -- an AUTOMATIC check names the metric it reads, the requirement, and the
  -- input dataset whose metric sets count; a manual check leaves them NULL
  metric_name   text,
  metric_op     text CONSTRAINT objective_checks_metric_op_check
                  CHECK (metric_op IS NULL OR metric_op = ANY (ARRAY['>=', '<=', '>', '<', '='])),
  metric_threshold double precision,
  input_dataset_id uuid REFERENCES public.datasets(id) ON DELETE CASCADE,
  archived_at   timestamptz,
  created_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- automatic needs all four pieces; manual has none of them
  CHECK (num_nonnulls(metric_name, metric_op, metric_threshold, input_dataset_id) IN (0, 4))
);
CREATE INDEX objective_checks_objective_idx ON public.objective_checks (objective_id);
CREATE INDEX objective_checks_dataset_idx ON public.objective_checks (input_dataset_id);
CREATE INDEX objective_checks_created_by_idx ON public.objective_checks (created_by);
COMMENT ON TABLE public.objective_checks IS
  'One configured check — "Objective checks are customizable per objective and allow model reviewers with different expertise to collaboratively evaluate a model''s performance" (manage-models/set-up-checks). Manual checks carry approvers; automatic ones carry "the result of an evaluation performed on a given input dataset" as a metric requirement. Archiving hides a check without erasing its history, per the page''s Archive a check section.';
COMMENT ON COLUMN public.objective_checks.metric_op IS
  'The comparator of "The metric requirement defines the conditions for a submission to pass this check" (manage-models/set-up-checks). The page shows a requirement without enumerating comparators; these five are the standard set, marked inference.';

CREATE TABLE public.objective_check_approvers (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES public.objective_checks(id) ON DELETE CASCADE,
  user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  CHECK (num_nonnulls(user_id, group_id) = 1)
);
CREATE INDEX objective_check_approvers_check_idx ON public.objective_check_approvers (check_id);
CREATE INDEX objective_check_approvers_user_idx ON public.objective_check_approvers (user_id);
CREATE INDEX objective_check_approvers_group_idx ON public.objective_check_approvers (group_id);
COMMENT ON TABLE public.objective_check_approvers IS
  '"the users or groups that are eligible to approve this check" (manage-models/set-up-checks) — one row per eligible user or group. Eligibility gates whose approval COUNTS, not who may talk: the page''s checks are "focused discussion threads".';

CREATE TABLE public.submission_check_responses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id      uuid NOT NULL REFERENCES public.objective_checks(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.objective_submissions(id) ON DELETE CASCADE,
  verdict       text NOT NULL DEFAULT 'comment'
                  CONSTRAINT check_responses_verdict_check
                  CHECK (verdict = ANY (ARRAY['approve', 'reject', 'comment'])),
  body          text NOT NULL DEFAULT '',
  created_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX check_responses_check_idx ON public.submission_check_responses (check_id);
CREATE INDEX check_responses_submission_idx ON public.submission_check_responses (submission_id);
CREATE INDEX check_responses_created_by_idx ON public.submission_check_responses (created_by);
COMMENT ON TABLE public.submission_check_responses IS
  'One reviewer''s word on one check of one submission — "Reviewers can approve, reject, or comment on each check when evaluating the model submission" (manage-models/set-up-checks).';
COMMENT ON CONSTRAINT check_responses_verdict_check ON public.submission_check_responses IS
  'Values from manage-models/set-up-checks: "Reviewers can approve, reject, or comment on each check when evaluating the model submission."';

-- the status of one check for one submission
CREATE FUNCTION public.submission_check_status(p_check uuid, p_submission uuid)
RETURNS text LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE c record; s record; val double precision; ok boolean;
BEGIN
  SELECT * INTO c FROM public.objective_checks WHERE id = p_check;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Objectives:NoSuchCheck — %', p_check; END IF;

  IF c.metric_name IS NULL THEN
    -- MANUAL: "this check will be marked as approved if anyone from the
    -- `pcl-team` group or the `Administrators` group approves the check".
    -- Only the approved condition is documented; anything else is pending.
    IF EXISTS (
      SELECT 1 FROM public.submission_check_responses r
       WHERE r.check_id = p_check AND r.submission_id = p_submission
         AND r.verdict = 'approve'
         AND EXISTS (SELECT 1 FROM public.objective_check_approvers a
                      WHERE a.check_id = p_check
                        AND (a.user_id = r.created_by
                             -- nested groups and expiry, composed (481)
                             OR a.group_id IN (SELECT public.user_group_ids(r.created_by))))) THEN
      RETURN 'APPROVED';
    END IF;
    RETURN 'PENDING';
  END IF;

  -- AUTOMATIC: the latest metric set for this submission's version on the
  -- check's input dataset decides. No metric set yet = PENDING; metric
  -- missing from the set or failing the requirement = REJECT; else PASS.
  SELECT * INTO s FROM public.objective_submissions WHERE id = p_submission;
  SELECT (m.metrics ->> c.metric_name)::double precision INTO val
    FROM public.metric_sets m
   WHERE m.model_version_id = s.model_version_id
     AND m.dataset_id = c.input_dataset_id
   ORDER BY m.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 'PENDING'; END IF;
  IF val IS NULL THEN RETURN 'REJECT'; END IF;
  ok := CASE c.metric_op
          WHEN '>=' THEN val >= c.metric_threshold
          WHEN '<=' THEN val <= c.metric_threshold
          WHEN '>'  THEN val >  c.metric_threshold
          WHEN '<'  THEN val <  c.metric_threshold
          ELSE val = c.metric_threshold END;
  RETURN CASE WHEN ok THEN 'PASS' ELSE 'REJECT' END;
END $$;
COMMENT ON FUNCTION public.submission_check_status(uuid, uuid) IS
  'The page''s three automatic statuses, computed rather than stored so they are always current: PASS when "the metric satisfies the requirement", REJECT when "the metric fails the requirement or is not found in the set of metrics", PENDING when "metrics were not yet built for the combination of submission, input dataset, and evaluation library" (manage-models/set-up-checks). Manual checks return APPROVED on an eligible approval and PENDING otherwise, because the approved condition is the only one the page defines. NEVER consulted by create_release: "it is not mandatory for all checks to be approved before creating a release".';

-- ── releases: staging, then Mark as production ──────────────────────────────

CREATE TABLE public.objective_releases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id  uuid NOT NULL REFERENCES public.modeling_objectives(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.objective_submissions(id) ON DELETE CASCADE,
  version_label text NOT NULL CHECK (length(btrim(version_label)) > 0),
  release_note  text NOT NULL DEFAULT '',
  created_by    uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  promoted_at   timestamptz
);
CREATE INDEX objective_releases_objective_idx ON public.objective_releases (objective_id);
CREATE INDEX objective_releases_submission_idx ON public.objective_releases (submission_id);
CREATE INDEX objective_releases_created_by_idx ON public.objective_releases (created_by);
COMMENT ON TABLE public.objective_releases IS
  'A release: "versioned, packaged, and production-ready assets containing model submission code … configurable environment tags (such as "Staging" or "Production"), a user-defined version number, and a short descriptive field—a release note" (model-integration/objectives). TAGS ARE PLURAL: manage_release-history.png shows one release wearing both badges, so there is no environment column — created_at is the staging tag and promoted_at is the production tag ("Tagged production on …"). Rows are written by create_release and changed only by promotion.';
COMMENT ON COLUMN public.objective_releases.promoted_at IS
  'When this release acquired the production tag — the capture''s "Tagged production on Mon, Nov 28, 2022" line (manage-models/images/manage_release-history.png). NULL while the release is staging-only. Promotion ADDS the tag; the staging badge stays, because the capture shows both.';

-- a release admits exactly one edit: acquiring the production tag
CREATE FUNCTION public.guard_release_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.objective_id IS DISTINCT FROM OLD.objective_id
     OR NEW.submission_id IS DISTINCT FROM OLD.submission_id
     OR NEW.version_label IS DISTINCT FROM OLD.version_label
     OR NEW.release_note IS DISTINCT FROM OLD.release_note
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.promoted_at IS NOT NULL AND NEW.promoted_at IS DISTINCT FROM OLD.promoted_at) THEN
    RAISE EXCEPTION 'Objectives:ReleaseImmutable — a release only ever acquires the production tag';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_release_immutable
  BEFORE UPDATE ON public.objective_releases
  FOR EACH ROW EXECUTE FUNCTION public.guard_release_immutable();

CREATE FUNCTION public.create_release(p_submission uuid, p_version_label text,
                                      p_note text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE s record; r uuid;
BEGIN
  SELECT * INTO s FROM public.objective_submissions WHERE id = p_submission;
  IF s.id IS NULL THEN
    RAISE EXCEPTION 'Objectives:NoSuchSubmission — % is not a submission you can see', p_submission;
  END IF;
  IF s.archived_at IS NOT NULL THEN
    -- "Removes the ability to create a release from that model."
    RAISE EXCEPTION 'Objectives:SubmissionArchived — archiving removes the ability to create a release';
  END IF;
  -- staging by construction — promoted_at NULL — because "Create a new
  -- staging release" is the creation the page documents; production is
  -- reached by promotion. Deliberately NO check gate here: "it is not
  -- mandatory for all checks to be approved before creating a release for a
  -- model submission."
  INSERT INTO public.objective_releases (objective_id, submission_id, version_label, release_note)
  VALUES (s.objective_id, p_submission, p_version_label, p_note)
  RETURNING id INTO r;
  RETURN r;
END $$;
COMMENT ON FUNCTION public.create_release(uuid, text, text) IS
  '"Give the model a release number and a release note, then click Create release" (manage-models/release-model). Always a STAGING release, the only creation the page documents; Mark as production promotes it. Refuses an archived submission, because archiving "Removes the ability to create a release" (manage-models/archive-model). INVOKER.';

CREATE FUNCTION public.mark_release_as_production(p_release uuid)
RETURNS void LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.objective_releases WHERE id = p_release;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Objectives:NoSuchRelease — % is not a release you can see', p_release;
  END IF;
  IF r.promoted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Objectives:AlreadyProduction — this release already carries the production tag';
  END IF;
  UPDATE public.objective_releases SET promoted_at = now() WHERE id = p_release;
END $$;
COMMENT ON FUNCTION public.mark_release_as_production(uuid) IS
  '"a staging release can be promoted to production by clicking Mark as production" (manage-models/release-model). ADDS the production tag — the staging badge stays, because manage_release-history.png shows a release wearing both. The one edit a release admits. INVOKER.';

-- what a deployment resolves: the latest release carrying the tag
CREATE FUNCTION public.latest_tagged_release(p_objective uuid, p_environment text)
RETURNS uuid LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT r.id FROM public.objective_releases r
   WHERE r.objective_id = p_objective
     AND CASE p_environment
           WHEN 'staging'    THEN true
           WHEN 'production' THEN r.promoted_at IS NOT NULL
         END
   ORDER BY CASE p_environment WHEN 'staging' THEN r.created_at ELSE r.promoted_at END DESC
   LIMIT 1
$$;
COMMENT ON FUNCTION public.latest_tagged_release(uuid, text) IS
  'The deployment selector: "a deployment with a "Production" environment will take the latest tagged "Production" release" (model-integration/objectives). Every release carries the staging tag from birth; production is the promoted subset. Latest by when THAT tag was acquired, which is what "Every release will overwrite the previous release for that environment" (manage-models/release-model) resolves to. An unknown environment returns nothing, and 701''s deployments constrain the word.';

-- ── creation and submission ─────────────────────────────────────────────────

CREATE FUNCTION public.create_modeling_objective(p_project uuid, p_name text,
                                                 p_description text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE o uuid;
BEGIN
  INSERT INTO public.modeling_objectives (project_id, name, description)
  VALUES (p_project, p_name, p_description) RETURNING id INTO o;
  RETURN o;
END $$;
COMMENT ON FUNCTION public.create_modeling_objective(uuid, text, text) IS
  'Creates an objective. INVOKER, so the objective''s own policy decides who may.';

CREATE FUNCTION public.submit_model(p_objective uuid, p_model_version uuid,
                                    p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v record; f record; s uuid; snap jsonb;
BEGIN
  SELECT mv.*, m.name AS model_name INTO v
    FROM public.model_versions mv JOIN public.models m ON m.id = mv.model_id
   WHERE mv.id = p_model_version;
  IF v.id IS NULL THEN
    RAISE EXCEPTION 'Objectives:NoSuchModelVersion — % is not a model version you can see', p_model_version;
  END IF;
  -- the adapter's call address, resolved now and frozen with the copy
  SELECT fn.api_name, fn.ontology_id, fv.major, fv.minor, fv.patch, fv.prerelease, fv.signature
    INTO f
    FROM public.function_versions fv JOIN public.functions fn ON fn.id = fv.function_id
   WHERE fv.id = v.adapter_version_id;
  snap := jsonb_build_object(
    'model_name', v.model_name,
    'model_version', v.version,
    'artifacts', v.artifacts,
    'adapter', jsonb_build_object(
      'api_name', f.api_name,
      'ontology_id', f.ontology_id,
      'version', f.major || '.' || f.minor || '.' || f.patch
                 || coalesce('-' || f.prerelease, ''),
      'signature', f.signature));
  INSERT INTO public.objective_submissions (objective_id, model_id, model_version_id, snapshot, metadata)
  VALUES (p_objective, v.model_id, p_model_version, snap, coalesce(p_metadata, '{}'::jsonb))
  RETURNING id INTO s;
  RETURN s;
END $$;
COMMENT ON FUNCTION public.submit_model(uuid, uuid, jsonb) IS
  'The Submit model button: creates the immutable COPY — "a copy of that model version is created" (model-integration/objectives) — carrying the artifacts and the adapter''s exact call address (api_name, ontology, semver), so a submission stays runnable as submitted. INVOKER: the caller needs read on the model and editor on the objective, and the policies say so.';

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.modeling_objectives        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_submissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_reviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_checks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_check_approvers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_check_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_releases         ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_read_objective(p_objective uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.modeling_objectives o
                  WHERE o.id = p_objective
                    AND o.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.project_role(o.project_id) IS NOT NULL)
$$;
CREATE FUNCTION public.can_edit_objective(p_objective uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.modeling_objectives o
                  WHERE o.id = p_objective
                    AND o.organization_id IS NOT DISTINCT FROM public.auth_org_id()
                    AND public.role_rank(public.project_role(o.project_id))
                        >= public.role_rank('editor'))
$$;
COMMENT ON FUNCTION public.can_edit_objective(uuid) IS
  '"Objective owners can set roles to control access for review, release, and deployment" (manage-models/review-model) — composed from the project role. Reviews and check responses take any project MEMBER, because review is the collaboration point; submissions, checks and releases take editor.';

CREATE POLICY "project members read objectives" ON public.modeling_objectives
  FOR SELECT USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.project_role(project_id) IS NOT NULL);
CREATE POLICY "project editors author objectives" ON public.modeling_objectives
  FOR ALL USING (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK (
    organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "read submissions" ON public.objective_submissions
  FOR SELECT USING ((SELECT public.can_read_objective(objective_id)));
CREATE POLICY "author submissions" ON public.objective_submissions
  FOR ALL USING ((SELECT public.can_edit_objective(objective_id)))
          WITH CHECK ((SELECT public.can_edit_objective(objective_id)));

-- reviews and check responses: any member may speak; rows are their author's
CREATE POLICY "read reviews" ON public.submission_reviews
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.objective_submissions s
                             WHERE s.id = submission_id
                               AND public.can_read_objective(s.objective_id)));
CREATE POLICY "members write reviews" ON public.submission_reviews
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.objective_submissions s
                 WHERE s.id = submission_id
                   AND public.can_read_objective(s.objective_id)));

CREATE POLICY "read checks" ON public.objective_checks
  FOR SELECT USING ((SELECT public.can_read_objective(objective_id)));
CREATE POLICY "editors author checks" ON public.objective_checks
  FOR ALL USING ((SELECT public.can_edit_objective(objective_id)))
          WITH CHECK ((SELECT public.can_edit_objective(objective_id)));

CREATE POLICY "read check approvers" ON public.objective_check_approvers
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.objective_checks c
                             WHERE c.id = check_id
                               AND public.can_read_objective(c.objective_id)));
CREATE POLICY "editors author check approvers" ON public.objective_check_approvers
  FOR ALL USING (EXISTS (SELECT 1 FROM public.objective_checks c
                          WHERE c.id = check_id
                            AND public.can_edit_objective(c.objective_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.objective_checks c
                       WHERE c.id = check_id
                         AND public.can_edit_objective(c.objective_id)));

CREATE POLICY "read check responses" ON public.submission_check_responses
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.objective_checks c
                             WHERE c.id = check_id
                               AND public.can_read_objective(c.objective_id)));
CREATE POLICY "members write check responses" ON public.submission_check_responses
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.objective_checks c
                 WHERE c.id = check_id
                   AND public.can_read_objective(c.objective_id)));

CREATE POLICY "read releases" ON public.objective_releases
  FOR SELECT USING ((SELECT public.can_read_objective(objective_id)));
CREATE POLICY "editors author releases" ON public.objective_releases
  FOR ALL USING ((SELECT public.can_edit_objective(objective_id)))
          WITH CHECK ((SELECT public.can_edit_objective(objective_id)));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modeling_objectives        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objective_submissions      TO authenticated;
GRANT SELECT, INSERT                 ON public.submission_reviews         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objective_checks           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objective_check_approvers  TO authenticated;
GRANT SELECT, INSERT                 ON public.submission_check_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objective_releases         TO authenticated;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ont uuid;
  fn uuid; fv uuid; m uuid; v1 uuid; obj uuid; sub uuid; sub2 uuid;
  chk uuid; auto_chk uuid; rel uuid; ds uuid; br uuid; txn uuid;
  u1 uuid := gen_random_uuid(); before text; st text; got uuid;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('ml-700') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('ml-700') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO public.ontologies (space_id, api_name, label, require_resources_in_project)
    VALUES (sp, 'ml700', 'ML700', false) RETURNING id INTO ont;
    INSERT INTO auth.users (id, instance_id, aud, role, email)
    VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ml700@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'ml700@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'ml_700', 'ML 700') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.functions (ontology_id, project_id, api_name, display_name)
    VALUES (ont, proj, 'predictPrice', 'Predict price') RETURNING id INTO fn;
    INSERT INTO public.function_versions (function_id, major, minor, patch, source, signature)
    VALUES (fn, 1, 0, 0,
      'export default function f(client, artifacts, input) { const a = JSON.parse(artifacts); return JSON.stringify(JSON.parse(input).map(r => ({...r, prediction: a.slope * r.sqft}))) }',
      '{"parameters": [{"name": "artifacts", "type": "string", "required": true}, {"name": "input", "type": "string", "required": true}], "returns": "string"}'::jsonb)
    RETURNING id INTO fv;
    SELECT public.create_model(proj, 'House prices') INTO m;
    SELECT public.publish_model_version(m, '{"slope": 2.0}'::jsonb, fv) INTO v1;

    -- 1. Submission copies: the snapshot carries artifacts and the adapter's
    --    exact call address.
    SELECT public.create_modeling_objective(proj, 'Predict house prices') INTO obj;
    SELECT public.submit_model(obj, v1, '{"team": "pricing"}'::jsonb) INTO sub;
    IF (SELECT snapshot -> 'artifacts' ->> 'slope' FROM public.objective_submissions WHERE id = sub)
       <> '2.0' THEN
      RAISE EXCEPTION 'the snapshot did not copy the artifacts';
    END IF;
    IF (SELECT snapshot -> 'adapter' ->> 'version' FROM public.objective_submissions WHERE id = sub)
       <> '1.0.0' THEN
      RAISE EXCEPTION 'the snapshot did not freeze the adapter address';
    END IF;

    -- 2. The copy is immutable.
    BEGIN
      UPDATE public.objective_submissions SET snapshot = '{}'::jsonb WHERE id = sub;
      RAISE EXCEPTION 'a submission copy was edited';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Objectives:SubmissionImmutable%' THEN RAISE; END IF;
    END;

    -- 3. A manual check APPROVES only on an eligible approver's word.
    INSERT INTO public.objective_checks (objective_id, name, description)
    VALUES (obj, 'Smoke tests', 'pipeline team confirms') RETURNING id INTO chk;
    IF public.submission_check_status(chk, sub) <> 'PENDING' THEN
      RAISE EXCEPTION 'an unanswered check is not PENDING';
    END IF;
    -- an approval from someone NOT eligible does not flip it
    INSERT INTO public.submission_check_responses (check_id, submission_id, verdict, body)
    VALUES (chk, sub, 'approve', 'lgtm');
    IF public.submission_check_status(chk, sub) <> 'PENDING' THEN
      RAISE EXCEPTION 'an ineligible approval counted';
    END IF;
    INSERT INTO public.objective_check_approvers (check_id, user_id) VALUES (chk, u1);
    IF public.submission_check_status(chk, sub) <> 'APPROVED' THEN
      RAISE EXCEPTION 'an eligible approval did not count';
    END IF;

    -- 4. An automatic check reads the metric sets: PENDING with none,
    --    PASS when the metric satisfies, REJECT when it fails.
    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
    VALUES (org, proj, 'eval_700', 'eval_700') RETURNING id INTO ds;
    INSERT INTO public.dataset_branches (dataset_id, name) VALUES (ds, 'master') RETURNING id INTO br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
    VALUES (ds, br, 'SNAPSHOT') RETURNING id INTO txn;
    PERFORM public.commit_transaction(txn);
    INSERT INTO public.objective_checks (objective_id, name, metric_name, metric_op,
                                         metric_threshold, input_dataset_id)
    VALUES (obj, 'RMSE bar', 'rmse', '<=', 5.0, ds) RETURNING id INTO auto_chk;
    IF public.submission_check_status(auto_chk, sub) <> 'PENDING' THEN
      RAISE EXCEPTION 'no metrics yet should be PENDING';
    END IF;
    INSERT INTO public.metric_sets (model_version_id, dataset_id, transaction_id, metrics)
    VALUES (v1, ds, txn, '{"rmse": 3.2}'::jsonb);
    IF public.submission_check_status(auto_chk, sub) <> 'PASS' THEN
      RAISE EXCEPTION 'rmse 3.2 <= 5.0 should PASS';
    END IF;
    INSERT INTO public.metric_sets (model_version_id, dataset_id, transaction_id, metrics)
    VALUES (v1, ds, txn, '{"rmse": 9.9}'::jsonb);
    IF public.submission_check_status(auto_chk, sub) <> 'REJECT' THEN
      RAISE EXCEPTION 'rmse 9.9 <= 5.0 should REJECT';
    END IF;

    -- 5. A release is created staging-tagged despite the failing check —
    --    checks never block: "it is not mandatory for all checks to be
    --    approved". And the submission's metadata stays editable while the
    --    copy does not.
    SELECT public.create_release(sub, '1.0', 'first cut') INTO rel;
    IF (SELECT promoted_at FROM public.objective_releases WHERE id = rel) IS NOT NULL THEN
      RAISE EXCEPTION 'a new release already wore the production tag';
    END IF;
    UPDATE public.objective_submissions SET metadata = '{"team": "pricing", "note": "v2"}'::jsonb
     WHERE id = sub;

    -- 6. The released submission cannot be archived; an unreleased one can.
    BEGIN
      UPDATE public.objective_submissions SET archived_at = now() WHERE id = sub;
      RAISE EXCEPTION 'a released submission was archived';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Objectives:ReleasedSubmissionsCannotBeArchived%' THEN RAISE; END IF;
    END;
    SELECT public.submit_model(obj, v1) INTO sub2;
    UPDATE public.objective_submissions SET archived_at = now() WHERE id = sub2;
    BEGIN
      PERFORM public.create_release(sub2, '9.9');
      RAISE EXCEPTION 'an archived submission was released';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Objectives:SubmissionArchived%' THEN RAISE; END IF;
    END;

    -- 7. Promotion ADDS the production tag: afterwards the release answers
    --    to BOTH selectors, which is the capture's two badges on one row.
    IF public.latest_tagged_release(obj, 'production') IS NOT NULL THEN
      RAISE EXCEPTION 'a production release exists before promotion';
    END IF;
    IF public.latest_tagged_release(obj, 'staging') IS DISTINCT FROM rel THEN
      RAISE EXCEPTION 'the staging selector did not find the new release';
    END IF;
    PERFORM public.mark_release_as_production(rel);
    SELECT public.latest_tagged_release(obj, 'production') INTO got;
    IF got IS DISTINCT FROM rel THEN
      RAISE EXCEPTION 'the selector did not find the promoted release';
    END IF;
    IF public.latest_tagged_release(obj, 'staging') IS DISTINCT FROM rel THEN
      RAISE EXCEPTION 'promotion took the staging badge away';
    END IF;
    BEGIN
      UPDATE public.objective_releases SET release_note = 'rewritten' WHERE id = rel;
      RAISE EXCEPTION 'a release note was edited after the fact';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Objectives:ReleaseImmutable%' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.mark_release_as_production(rel);
      RAISE EXCEPTION 'a production release was promoted twice';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Objectives:AlreadyProduction%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '700 proved, as the caller: a submission copies artifacts and the adapter address, the copy is frozen while its metadata stays editable; a manual check ignores an ineligible approval and APPROVES on an eligible one; an automatic check reads the metric sets PENDING then PASS then REJECT; a release is created staging-tagged even under a failing check; a released submission cannot be archived and an archived one cannot be released; and promotion ADDS the production tag so one release answers both selectors, wearing both badges like the capture';
  END;
END $$;
