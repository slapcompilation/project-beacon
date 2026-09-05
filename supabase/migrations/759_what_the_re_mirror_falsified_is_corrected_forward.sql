-- What the 2026-09-04 re-mirror falsified, corrected forward.
--
-- Roadmap item 2 (PR #929) re-read 53 changed cited pages. Four of the
-- findings are values or rules our schema holds and the page now states
-- differently; applied migrations are immutable, so each is corrected here,
-- by patching the live definition and saying what moved.
--
-- ── 1. The dataset rule's comparator ─────────────────────────────────────────
--
--   "| **If value is greater than or equal to**   | Amount of time elapsed since a job last succeeded                                           | 1 day              |"
--   — monitoring-views/rules-reference.md
--
-- 661 read the row as "greater than" and gave time_since_job_last_succeeded
-- the one `gt` of the dataset family. The other four rule types we ship were
-- re-checked against the same page: consecutive schedule failures, schedule
-- duration and automation-has-no-new-triggers print "greater than or equal
-- to"; repeated evaluation failures prints "greater than". Only this row moved.
--
-- ── 2. The schedule editor's event types ────────────────────────────────────
--
--   "* **Schedule run failed:** Occurs when a scheduled build fails."
--   — building-pipelines/triggers-reference.md
--
-- 495 admitted the four event types the page then listed; it lists seven now.
-- Schedule run failed is backed by the ledger 495 already reads — the
-- `schedule_ran` watermark is max(ran_at) where outcome = 'Succeeded'; this
-- one is the same over 'Failed'. The other two additions,
--
--   "* **Media set updated:** Occurs when an update is made to a media set. For [transactional](/docs/foundry/media-sets-advanced-formats/media-set-settings/#transaction-policies) media sets, this occurs when a transaction is committed; for transactionless media sets, this occurs eventually after an update, but not necessarily immediately."
--   "* **Table updated:** Occurs when a transaction is committed that updates a table."
--   — building-pipelines/triggers-reference.md
--
-- name resources with no table here (no media set, no table resource), so a
-- trigger could reference nothing. They stay refused — recorded in
-- readings/builds-and-schedules.md, not admitted with an invented id key.
--
-- ── 3. A Workshop variable's seventh definition type ────────────────────────
--
--   "* **SQL query:** For variables computed by running an Ontology SQL query against object sets and other variables in the module; review the [SQL query variables](/docs/foundry/workshop/sql-query-variables/) documentation for more information."
--   — workshop/concepts-variables.md
--
-- 685's CHECK declares `Values from workshop/concepts-variables` and admits
-- six; the dropdown now offers seven. Nothing here computes one — we have no
-- Ontology SQL — but a CHECK refusing a documented value is stricter than the
-- page, and the vocabulary is the page's, not ours.
--
-- ── 4. What a cover-page-only viewer sees ───────────────────────────────────
--
--   "If you can see a project's cover page but not its contents, **Overview** shows a reduced **Metadata** section containing only the project's own **RID**, **Location**, and **Space**."
--   — compass/use-project-details-panel.md
--
-- 676's discovery tuple carried the RID and not the other two. The function
-- gains `location` (the containing space's path — the first element of every
-- location inside the project) and `space` (its name), from the same row
-- policy-free join; the predicate does not move.
--
-- ── 5. A retired sentence in a live comment ─────────────────────────────────
--
--   "Workshop merges changes to separate configuration fields automatically. For example, if `main` changes a section title and your branch changes the section color, Workshop preserves both changes."
--   — workshop/branching-integration.md
--
-- 426's COMMENT ON working_state_conflicts quotes the sentence this replaced.
-- The comment is live catalogue text and gen:client copies it into the
-- generated client, so it is re-worded here rather than left as a citation
-- the mirror no longer holds. Nothing about the function moves.

-- ── 1. comparator ───────────────────────────────────────────────────────────

DO $$
DECLARE src text;
BEGIN
  src := replace(pg_get_functiondef('public.monitoring_rule_comparator(text)'::regprocedure), chr(13), '');
  IF (length(src) - length(replace(src, 'WHEN ''time_since_job_last_succeeded'' THEN ''gt''', ''))) /
     length('WHEN ''time_since_job_last_succeeded'' THEN ''gt''') <> 1 THEN
    RAISE EXCEPTION '759: the comparator anchor is not exactly once in the live definition';
  END IF;
  src := replace(src, 'WHEN ''time_since_job_last_succeeded'' THEN ''gt''',
                      'WHEN ''time_since_job_last_succeeded'' THEN ''gte''');
  EXECUTE src;
END $$;

COMMENT ON FUNCTION public.monitoring_rule_comparator(text) IS
  'The one comparator each rules-reference table prints for its type ("If value is greater than [or equal to]") — a property of the metric, never of a condition row. time_since_job_last_succeeded reads "greater than or equal to" since the 2026-09-04 re-mirror (759); it was "greater than" when 661 read it.';

-- ── 2. schedule_run_failed ──────────────────────────────────────────────────

DO $$
DECLARE src text; anchor text; arm text;
BEGIN
  -- the validator: the schedule-keyed arm admits both schedule events
  src := replace(pg_get_functiondef('public.schedule_trigger_valid(jsonb)'::regprocedure), chr(13), '');
  anchor := 'OR (p->>''event'' = ''schedule_ran'' AND p ? ''schedule_id'')';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION '759: the validator anchor is not exactly once in the live definition';
  END IF;
  src := replace(src, anchor,
    'OR (p->>''event'' IN (''schedule_ran'', ''schedule_run_failed'') AND p ? ''schedule_id'')');
  EXECUTE src;

  -- the observer: one more arm, the Succeeded watermark's twin over Failed
  src := replace(pg_get_functiondef('public.schedule_observe(jsonb, jsonb)'::regprocedure), chr(13), '');
  anchor := 'WHERE sr.schedule_id = (p_trigger->>''schedule_id'')::uuid AND sr.outcome = ''Succeeded'';';
  IF (length(src) - length(replace(src, anchor, ''))) / length(anchor) <> 1 THEN
    RAISE EXCEPTION '759: the observer anchor is not exactly once in the live definition';
  END IF;
  arm := anchor || chr(10) ||
    '        WHEN ''schedule_run_failed'' THEN' || chr(10) ||
    '          -- "Occurs when a scheduled build fails."' || chr(10) ||
    '          SELECT max(sr.ran_at)::text INTO mark FROM public.schedule_runs sr' || chr(10) ||
    '           WHERE sr.schedule_id = (p_trigger->>''schedule_id'')::uuid AND sr.outcome = ''Failed'';';
  src := replace(src, anchor, arm);
  EXECUTE src;
END $$;

-- ── 3. sql_query ────────────────────────────────────────────────────────────

ALTER TABLE public.workshop_variables DROP CONSTRAINT workshop_variables_definition_type_check;
ALTER TABLE public.workshop_variables ADD CONSTRAINT workshop_variables_definition_type_check
  CHECK (definition_type = ANY (ARRAY['static', 'function',
    'object_set_aggregation', 'object_property', 'object_set_definition',
    'variable_transformation', 'sql_query']));
COMMENT ON CONSTRAINT workshop_variables_definition_type_check ON public.workshop_variables IS
  'Values from workshop/concepts-variables: the variable definition type dropdown offers Static, Function, Object set aggregation, Object property, Object set definition, Variable transformation, and SQL query.';

-- ── 4. the discovery tuple ──────────────────────────────────────────────────

DROP FUNCTION public.discoverable_cover_pages();
CREATE FUNCTION public.discoverable_cover_pages()
RETURNS TABLE (project_id uuid, rid text, name text, description text, cover_page text,
               location text, space text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT p.id, p.rid, p.name, p.description, p.cover_page, s.path, s.name
    FROM public.projects p
    LEFT JOIN public.spaces s ON s.id = p.space_id
   WHERE p.cover_page IS NOT NULL
     AND p.organization_id IS NOT DISTINCT FROM public.auth_org_id()
     AND (p.personal_of IS NULL OR p.personal_of = auth.uid())
     AND (p.cover_page_discoverability = 'all_can_discover'
          OR (p.cover_page_discoverability = 'require_marking_access'
              AND public.resource_file_access('project', p.id, p.organization_id)))
$$;
REVOKE ALL ON FUNCTION public.discoverable_cover_pages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discoverable_cover_pages() TO authenticated, service_role;
COMMENT ON FUNCTION public.discoverable_cover_pages() IS
  'The discovery carve-out (security/cover-pages): projects in the caller''s organization whose cover page admits the caller — all_can_discover needs the organization alone, require_marking_access composes resource_file_access, the same org-and-markings predicate the read policy uses. Returns the discovery tuple and, since 759, the reduced Metadata the details panel shows a cover-page-only viewer — "only the project''s own RID, Location, and Space" (compass/use-project-details-panel). The row policy stays untouched. NULL discoverability discovers nothing.';

-- ── 5. the comment ──────────────────────────────────────────────────────────

DO $$
DECLARE cur text; old text := 'Workshop auto-merges changes that do not overlap.';
BEGIN
  cur := obj_description('public.working_state_conflicts(uuid)'::regprocedure, 'pg_proc');
  IF (length(cur) - length(replace(cur, old, ''))) / length(old) <> 1 THEN
    RAISE EXCEPTION '759: the retired sentence is not exactly once in the live comment';
  END IF;
  EXECUTE format('COMMENT ON FUNCTION public.working_state_conflicts(uuid) IS %L',
    replace(cur, old, 'Workshop merges changes to separate configuration fields automatically.'));
END $$;

-- ── PROVED BY DOING ─────────────────────────────────────────────────────────

DO $$
DECLARE
  org uuid; sp uuid; pr uuid; md uuid; sc uuid; st jsonb; n int; before text;
  u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid();
  loc text; spn text;
BEGIN
  -- 1. the comparator says what the row says, and only that row moved
  IF public.monitoring_rule_comparator('time_since_job_last_succeeded') <> 'gte' THEN
    RAISE EXCEPTION 'the dataset rule should compare greater than or equal to';
  END IF;
  IF public.monitoring_rule_comparator('automation_had_repeated_evaluation_failures_in_a_window') <> 'gt'
     OR public.monitoring_rule_comparator('consecutive_schedule_failures') <> 'gte' THEN
    RAISE EXCEPTION 'a comparator that did not move on the page moved here';
  END IF;

  before := current_setting('request.jwt.claims', true);
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('docs-759') RETURNING id INTO org;
    INSERT INTO public.spaces (name) VALUES ('docs-759') RETURNING id INTO sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (sp, org);
    INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
      (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'docs759a@beacon.test'),
      (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'docs759b@beacon.test');
    INSERT INTO public.users (id, email, role, organization_id) VALUES
      (u1, 'docs759a@beacon.test', 'admin', org),
      (u2, 'docs759b@beacon.test', 'admin', org);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u1::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    INSERT INTO public.projects (organization_id, space_id, api_name, name, cover_page, cover_page_discoverability)
    VALUES (org, sp, 'docs_probe_759', 'Docs probe 759', '# Docs 759', 'all_can_discover') RETURNING id INTO pr;

    -- 2. the schedule-run-failed event validates, observes a baseline, and fires on a failed run
    IF NOT public.schedule_trigger_valid(jsonb_build_object('type', 'event', 'event', 'schedule_run_failed',
                                                            'schedule_id', gen_random_uuid()::text)) THEN
      RAISE EXCEPTION 'schedule_run_failed is a documented event type and should validate';
    END IF;
    IF public.schedule_trigger_valid('{"type":"event","event":"media_set_updated","media_set_id":"x"}'::jsonb)
       OR public.schedule_trigger_valid('{"type":"event","event":"table_updated","table_id":"x"}'::jsonb) THEN
      RAISE EXCEPTION 'the two events with no backing resource here must stay refused, by design';
    END IF;
    INSERT INTO public.schedules (organization_id, name, target_dataset_ids, trigger)
    VALUES (org, 'docs-759-watched', ARRAY[]::uuid[], '{"type":"time","cron":"0 9 * * *","timezone":"UTC"}'::jsonb)
    RETURNING id INTO sc;
    st := public.schedule_observe(jsonb_build_object('type', 'event', 'event', 'schedule_run_failed',
                                                     'schedule_id', sc::text), '{}'::jsonb);
    IF (SELECT bool_or((v->>'satisfied')::boolean) FROM jsonb_each(st) e(k, v)) IS NOT FALSE THEN
      RAISE EXCEPTION 'the first observation is a baseline, not a firing';
    END IF;
    INSERT INTO public.schedule_runs (schedule_id, outcome, ran_at) VALUES (sc, 'Failed', clock_timestamp());
    st := public.schedule_observe(jsonb_build_object('type', 'event', 'event', 'schedule_run_failed',
                                                     'schedule_id', sc::text), st);
    IF (SELECT bool_or((v->>'satisfied')::boolean) FROM jsonb_each(st) e(k, v)) IS NOT TRUE THEN
      RAISE EXCEPTION 'a failed run should satisfy the schedule_run_failed event';
    END IF;

    -- 3. the seventh definition type is admitted
    INSERT INTO public.workshop_modules (organization_id, project_id, name)
    VALUES (org, pr, 'docs-759') RETURNING id INTO md;
    INSERT INTO public.workshop_variables (module_id, name, value_type, definition_type)
    VALUES (md, 'byQuery', 'string', 'sql_query');

    -- 4. a cover-page-only viewer reads RID, Location and Space — and nothing more
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', u2::text,
        'app_metadata', json_build_object('role', 'admin', 'org_id', org))::text, true);
    SELECT d.location, d.space INTO loc, spn FROM public.discoverable_cover_pages() d
     WHERE d.name = 'Docs probe 759';
    IF loc IS DISTINCT FROM (SELECT path FROM public.spaces WHERE id = sp)
       OR spn IS DISTINCT FROM 'docs-759' THEN
      RAISE EXCEPTION 'the reduced Metadata should carry the space path as Location and the space as Space, got % / %', loc, spn;
    END IF;
    SELECT count(*) INTO n FROM pg_proc p, unnest(p.proargnames) a
     WHERE p.oid = 'public.discoverable_cover_pages()'::regprocedure;
    IF n <> 7 THEN RAISE EXCEPTION 'the discovery tuple should have exactly seven columns, has %', n; END IF;

    -- 5. the comment no longer quotes the retired sentence
    IF obj_description('public.working_state_conflicts(uuid)'::regprocedure, 'pg_proc')
       NOT LIKE '%Workshop merges changes to separate configuration fields automatically.%' THEN
      RAISE EXCEPTION 'the live comment should carry the sentence the page says now';
    END IF;

    RAISE EXCEPTION USING errcode = 'P0759', message = 'rollback the probe';
  EXCEPTION WHEN sqlstate 'P0759' THEN
    PERFORM set_config('request.jwt.claims', before, true);
  END;
END $$;
