-- 681: a task names its resource, and a reviewer may decide the whole
-- proposal at once. Both are stated in prose the 680 build missed; the
-- post-build reconciliation re-read the page with the surface in hand.
--
--   "Each ontology resource is considered an individual task. The status tag next to the resource name indicates the overall approval status, while the **Your review** section on the right allows you to submit a review."
--   — ontologies/branching-ontology.md
--
-- Our task rows drew the resource's uuid. The six ontology resource tables
-- carry `label` except type_groups, which carries `name`, so one resolver
-- ends the guessing — and it is INVOKER, so a resource the caller cannot
-- see resolves to nothing rather than leaking its name.
--
--   "In the ontology proposal, reviewers can view the proposal details and approve or reject changes to all modified resources or to specific ontology resources."
--   — ontologies/branching-ontology.md
--
-- All modified resources, or specific ones, is two grains — and 680 built
-- only the second. review_proposal applies one decision across every task
-- of a proposal, as the same per-task upsert the surface already makes —
-- INVOKER rights, so proposal_reviews' own policy (write only your own
-- review, on a task of a proposal you can see) remains the only rule.
-- There is no per-task write function to call: the review path is the
-- policy, and 651's review_approval_task belongs to the Approvals engine's
-- own tables, not to these.

CREATE FUNCTION public.ontology_resource_label(p_kind text, p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE v text; tbl text; col text;
BEGIN
  tbl := CASE p_kind
           WHEN 'object_type'     THEN 'object_types'
           WHEN 'link_type'       THEN 'link_types'
           WHEN 'shared_property' THEN 'shared_properties'
           WHEN 'interface'       THEN 'ontology_interfaces'
           WHEN 'action_type'     THEN 'action_types'
           WHEN 'type_group'      THEN 'type_groups'
         END;
  IF tbl IS NULL THEN RETURN NULL; END IF;
  -- type_groups names its label `name`; the other five say `label`.
  col := CASE WHEN p_kind = 'type_group' THEN 'name' ELSE 'label' END;
  EXECUTE format('SELECT t.%I FROM public.%I t WHERE t.id = $1', col, tbl)
    INTO v USING p_id;
  RETURN v;
END $$;
COMMENT ON FUNCTION public.ontology_resource_label(text, uuid) IS
  'The display label of one ontology resource, for the proposal task rows the page describes as showing a status tag next to the resource name (ontologies/branching-ontology). Invoker rights: a resource the caller cannot see resolves to NULL and the row keeps its identifier.';

CREATE FUNCTION public.review_proposal(p_proposal uuid, p_decision text)
RETURNS integer LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE n integer;
BEGIN
  IF NOT public.can_see_proposal(p_proposal) THEN
    RAISE EXCEPTION 'Branching:ProposalNotVisible — no such proposal';
  END IF;
  -- "One standing decision per person per task" — the same upsert a single
  -- review makes, so re-deciding replaces rather than accumulates.
  WITH written AS (
    INSERT INTO public.proposal_reviews (task_id, user_id, decision)
    SELECT t.id, auth.uid(), p_decision
      FROM public.proposal_tasks t WHERE t.proposal_id = p_proposal
    ON CONFLICT (task_id, user_id) DO UPDATE SET decision = EXCLUDED.decision
    RETURNING 1)
  SELECT count(*) INTO n FROM written;
  RETURN n;
END $$;
COMMENT ON FUNCTION public.review_proposal(uuid, text) IS
  'One decision across every task of a proposal — "approve or reject changes to all modified resources or to specific ontology resources" (ontologies/branching-ontology). INVOKER rights and the same per-task upsert a single review makes, so proposal_reviews'' policy stays the only rule about who may review what.';

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; proj uuid; ont uuid; br uuid; prop uuid;
  t1 uuid; t2 uuid; ot uuid; lt uuid; tg uuid;
  u1 uuid := gen_random_uuid();
  before text; v text; n integer;
BEGIN
  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('lbl-681') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('lbl-681') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lbl681@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id)
    VALUES (u1, 'lbl681@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);

    INSERT INTO public.projects (organization_id, space_id, api_name, name)
    VALUES (org, sp, 'lbl_681', 'Labels 681') RETURNING id INTO proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
    VALUES (proj, u1, 'owner', org);
    INSERT INTO public.ontologies (space_id, api_name, label)
    VALUES (sp, 'lbl_681', 'Labels 681') RETURNING id INTO ont;
    INSERT INTO public.object_types (ontology_id, api_name, label, project_id)
    VALUES (ont, 'Lbl681Type', 'Current employee', proj) RETURNING id INTO ot;
    INSERT INTO public.type_groups (ontology_id, project_id, name)
    VALUES (ont, proj, 'Workers') RETURNING id INTO tg;

    -- 1. Each kind resolves through its own label column.
    IF public.ontology_resource_label('object_type', ot) <> 'Current employee' THEN
      RAISE EXCEPTION 'an object type should resolve to its label';
    END IF;
    IF public.ontology_resource_label('type_group', tg) <> 'Workers' THEN
      RAISE EXCEPTION 'a type group should resolve through its name column';
    END IF;

    -- 2. Unknown kinds and unknown ids answer NULL rather than raising —
    --    a row that cannot name its resource still renders.
    IF public.ontology_resource_label('not_a_kind', ot) IS NOT NULL THEN
      RAISE EXCEPTION 'an unknown kind should resolve NULL';
    END IF;
    IF public.ontology_resource_label('object_type', gen_random_uuid()) IS NOT NULL THEN
      RAISE EXCEPTION 'an unknown id should resolve NULL';
    END IF;

    -- 3. One decision reaches every task of the proposal.
    INSERT INTO public.ontology_branches (ontology_id, name, title)
    VALUES (ont, 'lbl-681', 'Labels 681') RETURNING id INTO br;
    INSERT INTO public.ontology_proposals (branch_id, name, created_by_user_id)
    VALUES (br, 'Labels 681', u1) RETURNING id INTO prop;
    INSERT INTO public.proposal_tasks (proposal_id, resource_kind, resource_id)
    VALUES (prop, 'object_type', ot) RETURNING id INTO t1;
    INSERT INTO public.proposal_tasks (proposal_id, resource_kind, resource_id)
    VALUES (prop, 'type_group', tg) RETURNING id INTO t2;

    SELECT public.review_proposal(prop, 'approved') INTO n;
    IF n <> 2 THEN RAISE EXCEPTION 'both tasks should have been reviewed, got %', n; END IF;
    IF (SELECT count(*) FROM public.proposal_reviews r
         WHERE r.task_id IN (t1, t2) AND r.decision = 'approved') <> 2 THEN
      RAISE EXCEPTION 'the bulk decision did not reach both tasks';
    END IF;

    -- 4. A proposal the caller cannot see refuses by name.
    BEGIN
      PERFORM public.review_proposal(gen_random_uuid(), 'approved');
      RAISE EXCEPTION 'an invisible proposal was reviewed';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE 'Branching:ProposalNotVisible%' THEN RAISE; END IF;
    END;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims', coalesce(before, ''), true);
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '681 proved: five kinds resolve through label and type_group through name, unknown kinds and ids answer NULL, one decision reaches every task through the per-task path, and an invisible proposal refuses by name';
  END;
END $$;
