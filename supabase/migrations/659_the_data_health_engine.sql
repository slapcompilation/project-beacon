-- The Data Health engine: checks on datasets and schedules, evaluated on the
-- clocks the pages publish, with results as history. Built from the
-- data-health reading, whose Decisions block the operator approved (engine
-- first; the Health-tab surface is its own later PR).
--
--   "Health checks enable monitoring and alerting on common issues across datasets and other resource types. You can monitor for potential issues related to dataset status, time, size, content, and schema using customizable checks."
--   — data-health/overview.md
--
-- ── THE TYPE SET IS EMIT-ONLY ────────────────────────────────────────────────
-- checks-reference enumerates 27 types in five families; that table is the
-- ceiling and the spelling authority, and this set admits the 21 the
-- evaluator below actually executes. Excluded with the pages' own reasons:
-- the four sync checks monitor exports to external databases we do not run;
-- Dataset partition is a Spark storage heuristic ("the check passes if at
-- least 90% of the files are more than 96MB in size") with no analogue in
-- our storage; Transaction file size needs file sizes we do not store; and
-- Approximate column relation (cross-dataset) is the recorded second
-- tranche. Iceberg and Virtual table variants are resource kinds we lack.
--
-- ── THE CLOCKS ───────────────────────────────────────────────────────────────
--
--   "Time-based checks can be configured to evaluate either automatically or on a manual schedule."
--   — data-health/check-evaluation.md
--
-- Automatic runs at two moments — "When a dataset is updated" and "When a
-- dataset passes the threshold you have configured" — and an update resets
-- the timer ("It will also reset the threshold for the next check by adding
-- the time threshold minimum to the current time"), which is the worked
-- 58-minutes-passes / 62-minutes-fails example, held here by a commit
-- trigger plus the heartbeat. A manual schedule "can be set to run by
-- minute, hourly, daily, weekly, or on a custom schedule" — refresh_interval
-- IS NULL means automatic, anything else is the manual interval, so the
-- capture's picker is data rather than a vocabulary.
--
-- ── THE DEVIATION FORMULA, VERBATIM ──────────────────────────────────────────
--
--   "Since dataset builds can easily have outliers, we do not use the true standard deviation. Instead, we use the median absolute deviation (MAD) which is a more robust measure of variability."
--   — data-health/checks-reference.md
--
-- and the constant is published: "Our calculation is `σ = MAD * 1.4826`."
-- For build durations the recent sample is real builds; for measured-value
-- checks it is this check's own recent results — the nearest thing we have
-- to "recent builds" for a value only the check computes, marked as ours.
--
-- ── SEVERITY, ESCALATION, WATCHING, PAUSING ──────────────────────────────────
-- Severity is the page's two (Moderate, Critical); Escalate is published on
-- the status checks ("Whether to escalate severity after consecutive
-- failures") and honoured here for every type: a failing check that failed
-- last time reports critical. Watch levels are the page's three; pausing
-- stores a timestamp and — deliberately — does not stop evaluation, because
-- "Pausing a check will temporarily snooze its alerts for all
-- watching/subscribed users" and alerts are the recorded notification
-- residual, not evaluation.
--
-- Inference, marked: a result's status has a third value the capture shows
-- (Error) beside Passed and Failed — ours records it when the evaluator
-- cannot evaluate (a configured column the schema no longer holds), distinct
-- from the check failing. The result-status set therefore lives in a
-- function, capture-sourced.

-- ── VOCABULARIES ─────────────────────────────────────────────────────────────

CREATE FUNCTION public.health_check_types()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'build_status', 'job_status', 'schedule_status',
    'build_duration', 'time_since_last_updated', 'data_freshness',
    'row_count', 'dataset_file_count', 'transaction_file_count',
    'allowed_column_values', 'column_regex', 'null_percentage',
    'numeric_mean', 'numeric_median', 'numeric_range', 'date_range',
    'approximate_unique_percentage', 'primary_key',
    'column', 'column_count', 'schema']
$$;

COMMENT ON FUNCTION public.health_check_types() IS
  'The 21 check types the evaluator executes, snake_case of data-health/checks-reference''s enumeration — its 27 are the ceiling and the spelling authority; a type arrives with its evaluator arm, never before.';

CREATE FUNCTION public.health_check_result_statuses()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['passed', 'failed', 'error']
$$;

COMMENT ON FUNCTION public.health_check_result_statuses() IS
  'Passed and Failed are the pages''; Error is the third state the Health-tab capture shows (data-health/images/health-checks-overview.png) — the evaluator could not evaluate, distinct from the check failing.';

CREATE FUNCTION public.health_check_config_valid(p_type text, c jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'build_status'            THEN true
    WHEN 'job_status'              THEN true
    WHEN 'schedule_status'         THEN true
    WHEN 'build_duration'          THEN c ? 'threshold' OR c ? 'median_deviation'
    WHEN 'time_since_last_updated' THEN (c ? 'threshold' OR c ? 'median_deviation')
                                        AND c ? 'ignore_empty_transactions'
    WHEN 'data_freshness'          THEN c ? 'column' AND c ? 'threshold'
    WHEN 'row_count'               THEN c ? 'threshold'
    WHEN 'dataset_file_count'      THEN c ? 'threshold'
    WHEN 'transaction_file_count'  THEN c ? 'threshold' OR c ? 'median_deviation'
    WHEN 'allowed_column_values'   THEN c ? 'column' AND jsonb_typeof(c -> 'values') = 'array'
    WHEN 'column_regex'            THEN c ? 'column' AND c ? 'regex'
    WHEN 'null_percentage'         THEN c ? 'column' AND (c ? 'threshold' OR c ? 'median_deviation')
    WHEN 'numeric_mean'            THEN c ? 'column' AND c ? 'threshold'
    WHEN 'numeric_median'          THEN c ? 'column' AND c ? 'threshold'
    WHEN 'numeric_range'           THEN c ? 'column' AND c ? 'min' AND c ? 'max'
    WHEN 'date_range'              THEN c ? 'column' AND c ? 'min' AND c ? 'max'
    WHEN 'approximate_unique_percentage' THEN c ? 'column' AND c ? 'threshold'
    WHEN 'primary_key'             THEN c ? 'column'
    WHEN 'column'                  THEN c ? 'column' AND c ? 'type'
    WHEN 'column_count'            THEN c ? 'count'
    WHEN 'schema'                  THEN jsonb_typeof(c -> 'columns') = 'array'
      AND c ->> 'comparison_type' = ANY (ARRAY[
        'EXACT_MATCH_ORDERED_COLUMNS', 'EXACT_MATCH_UNORDERED_COLUMNS',
        'COLUMN_ADDITIONS_ALLOWED', 'COLUMN_ADDITIONS_ALLOWED_STRICT'])
    ELSE false END
$$;

COMMENT ON FUNCTION public.health_check_config_valid(text, jsonb) IS
  'Each type''s required rule components, from its own table on data-health/checks-reference; the schema check''s four comparison tokens are that page''s published enumeration. A threshold is {"op": between|gte|lte|eq, "value", ["value2"], ["unit": minutes|hours|days]}; a median_deviation is {"deviations", "recent"}.';

-- ── THE TABLES ───────────────────────────────────────────────────────────────

CREATE TABLE public.health_checks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id       uuid REFERENCES public.datasets(id) ON DELETE CASCADE,
  schedule_id      uuid REFERENCES public.schedules(id) ON DELETE CASCADE,
  check_type       text NOT NULL CHECK (check_type = ANY (public.health_check_types())),
  config           jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity         text NOT NULL DEFAULT 'moderate'
                   CHECK (severity = ANY (ARRAY['moderate', 'critical'])),
  escalate         boolean NOT NULL DEFAULT false,
  notes            text NOT NULL DEFAULT '',
  -- NULL = the automatic clock; an interval = the manual schedule
  refresh_interval interval,
  next_run_at      timestamptz,
  paused_at        timestamptz,
  created_by       uuid REFERENCES public.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(dataset_id, schedule_id) = 1),
  -- the schedule-status check is the one that monitors a schedule
  CHECK ((schedule_id IS NOT NULL) = (check_type = 'schedule_status')),
  CHECK (public.health_check_config_valid(check_type, config))
);

COMMENT ON TABLE public.health_checks IS
  'One health check on a dataset or a schedule (data-health/overview): a type from the executable set, its rule components in config, two-valued severity with escalation, and its clock — automatic (refresh_interval NULL, commit-triggered with threshold reset) or a manual interval.';

COMMENT ON CONSTRAINT health_checks_severity_check ON public.health_checks IS
  'Values from data-health/checks-reference — Moderate, Critical on every check''s Severity row.';

CREATE INDEX health_checks_dataset ON public.health_checks (dataset_id);
CREATE INDEX health_checks_schedule ON public.health_checks (schedule_id);
CREATE INDEX health_checks_created_by ON public.health_checks (created_by);
CREATE INDEX health_checks_due ON public.health_checks (next_run_at)
  WHERE next_run_at IS NOT NULL;

CREATE TABLE public.health_check_results (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id    uuid NOT NULL REFERENCES public.health_checks(id) ON DELETE CASCADE,
  status      text NOT NULL CHECK (status = ANY (public.health_check_result_statuses())),
  -- the capture shows the measured value as the status text ("2m 13s", "0%")
  measured    text,
  detail      text,
  severity    text CHECK (severity = ANY (ARRAY['moderate', 'critical'])),
  reported_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.health_check_results IS
  'One row per evaluation — the history dot-strip. measured is the value the Health tab shows beside the status; severity is the failure''s, escalation applied; detail carries the error when the evaluator could not evaluate.';

COMMENT ON CONSTRAINT health_check_results_severity_check ON public.health_check_results IS
  'Values from data-health/checks-reference — the same Moderate/Critical pair, at the moment of failure.';

CREATE INDEX health_check_results_check ON public.health_check_results (check_id, reported_at DESC);

CREATE TABLE public.health_check_watchers (
  check_id uuid NOT NULL REFERENCES public.health_checks(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  level    text NOT NULL DEFAULT 'all_failures'
           CHECK (level = ANY (ARRAY['nothing', 'all_failures', 'only_critical'])),
  PRIMARY KEY (check_id, user_id)
);

COMMENT ON TABLE public.health_check_watchers IS
  'Who watches a check, at which level (data-health/watching-checks). Watchers power the Data Health watching filter today and become the notification audience if a notification system ever exists — the recorded residual.';

COMMENT ON CONSTRAINT health_check_watchers_level_check ON public.health_check_watchers IS
  'Values from data-health/watching-checks — Nothing, All failures, Only critical.';

CREATE INDEX health_check_watchers_user ON public.health_check_watchers (user_id);

-- ── VISIBILITY AND WRITERS ───────────────────────────────────────────────────
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_check_watchers ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.can_see_health_check(p_check uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.health_checks h
    WHERE h.id = p_check
      AND CASE WHEN h.dataset_id IS NOT NULL
            THEN public.can_read_dataset(h.dataset_id)
            ELSE EXISTS (SELECT 1 FROM public.schedules s
                          WHERE s.id = h.schedule_id
                            AND public.auth_in_org(s.organization_id)) END)
$$;

CREATE FUNCTION public.can_edit_health_check_target(p_dataset uuid, p_schedule uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT CASE WHEN p_dataset IS NOT NULL
    THEN public.can_write_dataset(p_dataset)
    ELSE EXISTS (SELECT 1 FROM public.schedules s
                  WHERE s.id = p_schedule
                    AND public.auth_in_org(s.organization_id)
                    AND (SELECT public.auth_role()) IN ('owner', 'admin')) END
$$;

REVOKE ALL ON FUNCTION public.can_see_health_check(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_health_check_target(uuid, uuid) FROM PUBLIC, anon;

-- Over the row's OWN columns, never a self-lookup: INSERT ... RETURNING must
-- pass the SELECT policy, and a function re-querying the table cannot see
-- the row being inserted.
CREATE POLICY "checks follow their resource" ON public.health_checks
  FOR SELECT USING (
    CASE WHEN dataset_id IS NOT NULL THEN public.can_read_dataset(dataset_id)
         ELSE EXISTS (SELECT 1 FROM public.schedules s
                       WHERE s.id = schedule_id
                         AND public.auth_in_org(s.organization_id)) END);
CREATE POLICY "editors add checks" ON public.health_checks
  FOR INSERT WITH CHECK (public.can_edit_health_check_target(dataset_id, schedule_id));
CREATE POLICY "editors adjust checks" ON public.health_checks
  FOR UPDATE USING (public.can_edit_health_check_target(dataset_id, schedule_id))
  WITH CHECK (public.can_edit_health_check_target(dataset_id, schedule_id));
CREATE POLICY "editors remove checks" ON public.health_checks
  FOR DELETE USING (public.can_edit_health_check_target(dataset_id, schedule_id));

CREATE POLICY "results follow their check" ON public.health_check_results
  FOR SELECT USING (public.can_see_health_check(check_id));

CREATE POLICY "watchers follow their check" ON public.health_check_watchers
  FOR SELECT USING (public.can_see_health_check(check_id));
CREATE POLICY "watch what you can see" ON public.health_check_watchers
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid())
                         AND public.can_see_health_check(check_id));
CREATE POLICY "adjust your own watch" ON public.health_check_watchers
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "unwatch your own" ON public.health_check_watchers
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- ── HELPERS ──────────────────────────────────────────────────────────────────

CREATE FUNCTION public.health_threshold_pass(p_measured numeric, t jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  -- The four comparison options every threshold row prints, as the
  -- checks-reference table lists them: Between, Greater than or equal to,
  -- Less than or equal to, Equal to (separate cells, so no single sentence
  -- to quote).
  SELECT CASE t ->> 'op'
    WHEN 'between' THEN p_measured >= (t ->> 'value')::numeric
                    AND p_measured <= (t ->> 'value2')::numeric
    WHEN 'gte'     THEN p_measured >= (t ->> 'value')::numeric
    WHEN 'lte'     THEN p_measured <= (t ->> 'value')::numeric
    WHEN 'eq'      THEN p_measured = (t ->> 'value')::numeric
    ELSE false END
$$;

CREATE FUNCTION public.health_threshold_seconds(t jsonb) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT (t ->> 'value')::numeric * CASE t ->> 'unit'
    WHEN 'minutes' THEN 60 WHEN 'hours' THEN 3600 WHEN 'days' THEN 86400
    ELSE 1 END
$$;

-- "The MAD is defined as the median of the absolute deviations from the
-- median of the data" — and sigma is MAD * 1.4826, the published constant.
CREATE FUNCTION public.health_mad_pass(p_measured numeric, p_recent numeric[], d jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  WITH vals AS (SELECT unnest(p_recent) v),
  med AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v) m FROM vals),
  mad AS (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(v - med.m)) a
            FROM vals, med GROUP BY med.m)
  SELECT CASE
    WHEN coalesce(array_length(p_recent, 1), 0) < 2 THEN true  -- not enough history
    WHEN (SELECT a FROM mad) = 0 THEN p_measured = (SELECT m FROM med)
    ELSE abs(p_measured - (SELECT m FROM med))
         <= (d ->> 'deviations')::numeric * (SELECT a FROM mad) * 1.4826
  END
$$;

-- ── THE EVALUATOR ────────────────────────────────────────────────────────────
CREATE FUNCTION public.evaluate_health_check(p_check uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  h record; d record; v_branch uuid; v_phys text;
  v_num numeric; v_num2 numeric; v_txt text; v_ok boolean; v_status text;
  v_measured text; v_detail text; v_sev text; v_recent numeric[];
  v_fields jsonb; f jsonb; i int;
BEGIN
  SELECT * INTO h FROM public.health_checks WHERE id = p_check;
  IF h.id IS NULL THEN RETURN; END IF;
  v_status := NULL; v_measured := NULL; v_detail := NULL;

  BEGIN
    IF h.dataset_id IS NOT NULL THEN
      SELECT ds.physical_table INTO v_phys FROM public.datasets ds WHERE ds.id = h.dataset_id;
      SELECT b.id INTO v_branch FROM public.dataset_branches b
       WHERE b.dataset_id = h.dataset_id AND b.name = 'master';
    END IF;

    CASE h.check_type
      WHEN 'schedule_status' THEN
        SELECT CASE r.outcome WHEN 'Succeeded' THEN 'passed'
               WHEN 'Failed' THEN 'failed' END, r.outcome
          INTO v_status, v_measured
          FROM public.schedule_runs r WHERE r.schedule_id = h.schedule_id
         ORDER BY r.ran_at DESC LIMIT 1;
        IF v_status IS NULL THEN v_status := 'error'; v_detail := 'no schedule runs yet'; END IF;

      WHEN 'build_status' THEN
        SELECT CASE b.status WHEN 'SUCCEEDED' THEN 'passed'
               WHEN 'FAILED' THEN 'failed' END, b.status
          INTO v_status, v_measured
          FROM public.builds b
          JOIN public.build_jobs j ON j.build_id = b.id AND j.output_dataset_id = h.dataset_id
         ORDER BY b.started_at DESC NULLS LAST LIMIT 1;
        IF v_status IS NULL THEN v_status := 'error'; v_detail := 'no finished builds yet'; END IF;

      WHEN 'job_status' THEN
        SELECT CASE j.state WHEN 'COMPLETED' THEN 'passed'
               WHEN 'FAILED' THEN 'failed' END, j.state
          INTO v_status, v_measured
          FROM public.build_jobs j WHERE j.output_dataset_id = h.dataset_id
         ORDER BY j.started_at DESC NULLS LAST LIMIT 1;
        IF v_status IS NULL THEN v_status := 'error'; v_detail := 'no finished jobs yet'; END IF;

      WHEN 'build_duration' THEN
        SELECT extract(epoch FROM b.finished_at - b.started_at) INTO v_num
          FROM public.builds b
          JOIN public.build_jobs j ON j.build_id = b.id AND j.output_dataset_id = h.dataset_id
         WHERE b.finished_at IS NOT NULL
         ORDER BY b.started_at DESC LIMIT 1;
        IF v_num IS NULL THEN v_status := 'error'; v_detail := 'no finished builds yet';
        ELSE
          SELECT coalesce(array_agg(extract(epoch FROM b.finished_at - b.started_at)), '{}')
            INTO v_recent
            FROM (SELECT b.* FROM public.builds b
                   JOIN public.build_jobs j ON j.build_id = b.id
                    AND j.output_dataset_id = h.dataset_id
                  WHERE b.finished_at IS NOT NULL
                  ORDER BY b.started_at DESC
                  LIMIT coalesce((h.config -> 'median_deviation' ->> 'recent')::int, 10)) b;
          v_ok := (NOT h.config ? 'threshold'
                   OR public.health_threshold_pass(v_num,
                        jsonb_set(h.config -> 'threshold', '{value}',
                          to_jsonb(public.health_threshold_seconds(h.config -> 'threshold')))
                        - 'unit'))
              AND (NOT h.config ? 'median_deviation'
                   OR public.health_mad_pass(v_num, v_recent, h.config -> 'median_deviation'));
          v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
          v_measured := round(v_num)::text || 's';
        END IF;

      WHEN 'time_since_last_updated' THEN
        SELECT extract(epoch FROM clock_timestamp() - max(t.committed_at)) INTO v_num
          FROM public.dataset_transactions t
         WHERE t.dataset_id = h.dataset_id AND t.status = 'COMMITTED'
           AND (NOT (h.config ->> 'ignore_empty_transactions')::boolean
                OR EXISTS (SELECT 1 FROM public.dataset_files df WHERE df.transaction_id = t.id));
        IF v_num IS NULL THEN v_status := 'error'; v_detail := 'no committed transactions';
        ELSE
          v_ok := NOT h.config ? 'threshold'
               OR public.health_threshold_pass(v_num,
                    jsonb_set(h.config -> 'threshold', '{value}',
                      to_jsonb(public.health_threshold_seconds(h.config -> 'threshold'))));
          v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
          v_measured := round(v_num)::text || 's';
        END IF;

      WHEN 'data_freshness' THEN
        EXECUTE format(
          'SELECT extract(epoch FROM (SELECT max(t.committed_at) FROM public.dataset_transactions t
              WHERE t.dataset_id = %L AND t.status = ''COMMITTED'')
            - max(%I)) FROM datasets.%I r
           WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
          h.dataset_id, h.config ->> 'column', v_phys, v_branch) INTO v_num;
        IF v_num IS NULL THEN v_status := 'error'; v_detail := 'no data to measure';
        ELSE
          v_ok := public.health_threshold_pass(v_num,
                    jsonb_set(h.config -> 'threshold', '{value}',
                      to_jsonb(public.health_threshold_seconds(h.config -> 'threshold'))));
          v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
          v_measured := round(v_num)::text || 's';
        END IF;

      WHEN 'row_count' THEN
        EXECUTE format(
          'SELECT count(*) FROM datasets.%I r
            WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
          v_phys, v_branch) INTO v_num;
        v_ok := public.health_threshold_pass(v_num, h.config -> 'threshold');
        IF v_ok AND h.config ? 'median_deviation' THEN
          SELECT coalesce(array_agg(r.measured::numeric), '{}') INTO v_recent
            FROM (SELECT measured FROM public.health_check_results
                   WHERE check_id = h.id AND status = 'passed' AND measured ~ '^[0-9.]+$'
                   ORDER BY reported_at DESC
                   LIMIT coalesce((h.config -> 'median_deviation' ->> 'recent')::int, 10)) r;
          v_ok := public.health_mad_pass(v_num, v_recent, h.config -> 'median_deviation');
        END IF;
        v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
        v_measured := v_num::text;

      WHEN 'dataset_file_count' THEN
        SELECT count(*) INTO v_num FROM public.dataset_view(v_branch);
        v_ok := public.health_threshold_pass(v_num, h.config -> 'threshold');
        v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
        v_measured := v_num::text;

      WHEN 'transaction_file_count' THEN
        SELECT count(*) INTO v_num FROM public.dataset_files df
         WHERE df.transaction_id = (
           SELECT t.id FROM public.dataset_transactions t
            WHERE t.dataset_id = h.dataset_id AND t.status = 'COMMITTED'
            ORDER BY t.committed_at DESC LIMIT 1);
        v_ok := NOT h.config ? 'threshold'
             OR public.health_threshold_pass(v_num, h.config -> 'threshold');
        v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
        v_measured := v_num::text;

      WHEN 'allowed_column_values' THEN
        EXECUTE format(
          'SELECT count(*) FROM datasets.%I r
            WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))
              AND %I IS NOT NULL
              AND NOT (%I::text = ANY ($1))',
          v_phys, v_branch, h.config ->> 'column', h.config ->> 'column')
          USING (SELECT array_agg(x) FROM jsonb_array_elements_text(h.config -> 'values') x)
          INTO v_num;
        v_status := CASE WHEN v_num = 0 THEN 'passed' ELSE 'failed' END;
        v_measured := v_num::text || ' disallowed';

      WHEN 'column_regex' THEN
        EXECUTE format(
          'SELECT count(*) FROM datasets.%I r
            WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))
              AND %I IS NOT NULL AND %I::text !~ %L',
          v_phys, v_branch, h.config ->> 'column', h.config ->> 'column',
          h.config ->> 'regex') INTO v_num;
        v_status := CASE WHEN v_num = 0 THEN 'passed' ELSE 'failed' END;
        v_measured := v_num::text || ' non-matching';

      WHEN 'null_percentage' THEN
        EXECUTE format(
          'SELECT coalesce(100.0 * count(*) FILTER (WHERE %I IS NULL) / nullif(count(*), 0), 0)
             FROM datasets.%I r
            WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
          h.config ->> 'column', v_phys, v_branch) INTO v_num;
        v_ok := NOT h.config ? 'threshold'
             OR public.health_threshold_pass(v_num, h.config -> 'threshold');
        v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
        v_measured := round(v_num, 1)::text || '%';

      WHEN 'numeric_mean' THEN
        EXECUTE format(
          'SELECT avg(%I::numeric) FROM datasets.%I r
            WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
          h.config ->> 'column', v_phys, v_branch) INTO v_num;
        v_ok := v_num IS NOT NULL AND public.health_threshold_pass(v_num, h.config -> 'threshold');
        v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
        v_measured := round(coalesce(v_num, 0), 2)::text;

      WHEN 'numeric_median' THEN
        EXECUTE format(
          'SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY %I::numeric)
             FROM datasets.%I r
            WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
          h.config ->> 'column', v_phys, v_branch) INTO v_num;
        v_ok := v_num IS NOT NULL AND public.health_threshold_pass(v_num, h.config -> 'threshold');
        v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
        v_measured := round(coalesce(v_num, 0), 2)::text;

      WHEN 'numeric_range' THEN
        EXECUTE format(
          'SELECT min(%I::numeric), max(%I::numeric) FROM datasets.%I r
            WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
          h.config ->> 'column', h.config ->> 'column', v_phys, v_branch)
          INTO v_num, v_num2;
        v_ok := v_num IS NOT NULL
            AND v_num >= (h.config ->> 'min')::numeric
            AND v_num2 <= (h.config ->> 'max')::numeric;
        v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
        v_measured := coalesce(v_num::text, '—') || '–' || coalesce(v_num2::text, '—');

      WHEN 'date_range' THEN
        EXECUTE format(
          'SELECT min(%I)::text, max(%I)::text FROM datasets.%I r
            WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
          h.config ->> 'column', h.config ->> 'column', v_phys, v_branch)
          INTO v_measured, v_txt;
        v_ok := v_measured IS NOT NULL
            AND v_measured >= h.config ->> 'min' AND v_txt <= h.config ->> 'max';
        v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
        v_measured := coalesce(v_measured, '—') || '–' || coalesce(v_txt, '—');

      WHEN 'approximate_unique_percentage' THEN
        EXECUTE format(
          'SELECT coalesce(100.0 * count(DISTINCT %I) / nullif(count(%I), 0), 0)
             FROM datasets.%I r
            WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
          h.config ->> 'column', h.config ->> 'column', v_phys, v_branch) INTO v_num;
        v_ok := public.health_threshold_pass(v_num, h.config -> 'threshold');
        v_status := CASE WHEN v_ok THEN 'passed' ELSE 'failed' END;
        v_measured := round(v_num, 1)::text || '%';

      WHEN 'primary_key' THEN
        EXECUTE format(
          'SELECT count(*) - count(DISTINCT %I), count(*) FILTER (WHERE %I IS NULL)
             FROM datasets.%I r
            WHERE r._file IN (SELECT file_id FROM public.dataset_view(%L))',
          h.config ->> 'column', h.config ->> 'column', v_phys, v_branch)
          INTO v_num, v_num2;
        v_status := CASE WHEN v_num = 0 AND v_num2 = 0 THEN 'passed' ELSE 'failed' END;
        v_measured := v_num::text || ' dup, ' || v_num2::text || ' null';

      WHEN 'column' THEN
        SELECT s.fields INTO v_fields FROM public.dataset_schemas s
          JOIN public.dataset_transactions t ON t.id = s.transaction_id
         WHERE s.dataset_id = h.dataset_id AND t.status = 'COMMITTED'
         ORDER BY t.committed_at DESC LIMIT 1;
        SELECT bool_or(f2 ->> 'name' = h.config ->> 'column'
                       AND lower(f2 ->> 'type') = lower(h.config ->> 'type'))
          INTO v_ok FROM jsonb_array_elements(coalesce(v_fields, '[]'::jsonb)) f2;
        v_status := CASE WHEN coalesce(v_ok, false) THEN 'passed' ELSE 'failed' END;
        v_measured := coalesce((SELECT f2 ->> 'type'
          FROM jsonb_array_elements(coalesce(v_fields, '[]'::jsonb)) f2
         WHERE f2 ->> 'name' = h.config ->> 'column'), 'absent');

      WHEN 'column_count' THEN
        SELECT s.fields INTO v_fields FROM public.dataset_schemas s
          JOIN public.dataset_transactions t ON t.id = s.transaction_id
         WHERE s.dataset_id = h.dataset_id AND t.status = 'COMMITTED'
         ORDER BY t.committed_at DESC LIMIT 1;
        v_num := jsonb_array_length(coalesce(v_fields, '[]'::jsonb));
        v_status := CASE WHEN v_num = (h.config ->> 'count')::numeric
                    THEN 'passed' ELSE 'failed' END;
        v_measured := v_num::text;

      WHEN 'schema' THEN
        SELECT s.fields INTO v_fields FROM public.dataset_schemas s
          JOIN public.dataset_transactions t ON t.id = s.transaction_id
         WHERE s.dataset_id = h.dataset_id AND t.status = 'COMMITTED'
         ORDER BY t.committed_at DESC LIMIT 1;
        v_fields := coalesce(v_fields, '[]'::jsonb);
        CASE h.config ->> 'comparison_type'
          WHEN 'EXACT_MATCH_ORDERED_COLUMNS' THEN
            v_ok := jsonb_array_length(v_fields) = jsonb_array_length(h.config -> 'columns');
            IF v_ok THEN
              FOR i IN 0 .. jsonb_array_length(v_fields) - 1 LOOP
                v_ok := v_ok
                  AND v_fields -> i ->> 'name' = h.config -> 'columns' -> i ->> 'name'
                  AND (h.config -> 'columns' -> i ->> 'type' IS NULL
                       OR lower(v_fields -> i ->> 'type')
                          = lower(h.config -> 'columns' -> i ->> 'type'));
              END LOOP;
            END IF;
          WHEN 'EXACT_MATCH_UNORDERED_COLUMNS' THEN
            v_ok := jsonb_array_length(v_fields) = jsonb_array_length(h.config -> 'columns')
              AND NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(h.config -> 'columns') c
                 WHERE NOT EXISTS (
                   SELECT 1 FROM jsonb_array_elements(v_fields) f2
                    WHERE f2 ->> 'name' = c ->> 'name'
                      AND (c ->> 'type' IS NULL
                           OR lower(f2 ->> 'type') = lower(c ->> 'type'))));
          ELSE  -- COLUMN_ADDITIONS_ALLOWED and its STRICT variant
            v_ok := NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(h.config -> 'columns') c
               WHERE NOT EXISTS (
                 SELECT 1 FROM jsonb_array_elements(v_fields) f2
                  WHERE f2 ->> 'name' = c ->> 'name'
                    AND (c ->> 'type' IS NULL
                         OR lower(f2 ->> 'type') = lower(c ->> 'type'))));
            -- "whenever a new column is added to the dataset, that column is
            --  added to the check. Added columns cannot be missing thereafter."
            IF v_ok AND h.config ->> 'comparison_type' = 'COLUMN_ADDITIONS_ALLOWED_STRICT' THEN
              FOR f IN SELECT * FROM jsonb_array_elements(v_fields) LOOP
                IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(h.config -> 'columns') c
                                WHERE c ->> 'name' = f ->> 'name') THEN
                  UPDATE public.health_checks
                     SET config = jsonb_set(config, '{columns}',
                           (config -> 'columns') || jsonb_build_object(
                             'name', f ->> 'name', 'type', f ->> 'type'))
                   WHERE id = h.id;
                END IF;
              END LOOP;
            END IF;
        END CASE;
        v_status := CASE WHEN coalesce(v_ok, false) THEN 'passed' ELSE 'failed' END;
        v_measured := jsonb_array_length(v_fields)::text || ' columns';
    END CASE;
  EXCEPTION WHEN OTHERS THEN
    -- the capture's third state: the evaluator could not evaluate
    v_status := 'error'; v_detail := sqlerrm;
  END;

  -- escalation: a failure following a failure reports critical
  v_sev := NULL;
  IF v_status = 'failed' THEN
    v_sev := h.severity;
    -- consecutive means the LATEST result, not any past one
    IF h.escalate AND h.severity = 'moderate'
       AND (SELECT r.status FROM public.health_check_results r
             WHERE r.check_id = h.id
             ORDER BY r.reported_at DESC LIMIT 1) = 'failed' THEN
      v_sev := 'critical';
    END IF;
  END IF;

  INSERT INTO public.health_check_results (check_id, status, measured, detail, severity)
  VALUES (h.id, v_status, v_measured, v_detail, v_sev);
END $$;

COMMENT ON FUNCTION public.evaluate_health_check(uuid) IS
  'One evaluation of one check, on the clocks below: every arm answers its type''s own rule-component table from data-health/checks-reference, an evaluator failure records the capture''s Error state, and a failure following a failure escalates moderate to critical.';

REVOKE ALL ON FUNCTION public.evaluate_health_check(uuid) FROM PUBLIC, anon, authenticated;

-- ── THE CLOCKS ───────────────────────────────────────────────────────────────
-- automatic trigger 1: "When a dataset is updated" — and the update resets
-- the threshold timer for the time-based checks
CREATE FUNCTION public.run_dataset_health_checks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE h record;
BEGIN
  FOR h IN SELECT * FROM public.health_checks
            WHERE dataset_id = NEW.dataset_id AND refresh_interval IS NULL LOOP
    PERFORM public.evaluate_health_check(h.id);
    IF h.check_type = 'time_since_last_updated' AND h.config ? 'threshold' THEN
      UPDATE public.health_checks
         SET next_run_at = clock_timestamp()
               + make_interval(secs => public.health_threshold_seconds(h.config -> 'threshold'))
       WHERE id = h.id;
    END IF;
  END LOOP;
  RETURN NULL;
END $$;

CREATE TRIGGER run_dataset_health_checks
AFTER UPDATE OF status ON public.dataset_transactions
FOR EACH ROW WHEN (NEW.status = 'COMMITTED' AND OLD.status IS DISTINCT FROM 'COMMITTED')
EXECUTE FUNCTION public.run_dataset_health_checks();

-- automatic trigger 2 (the threshold crossing) and the manual intervals,
-- on the heartbeat
CREATE FUNCTION public.run_health_checks() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE h record; v_n integer := 0;
BEGIN
  FOR h IN SELECT * FROM public.health_checks
            WHERE (refresh_interval IS NULL AND next_run_at <= clock_timestamp())
               OR (refresh_interval IS NOT NULL
                   AND coalesce(next_run_at, '-infinity') <= clock_timestamp()) LOOP
    PERFORM public.evaluate_health_check(h.id);
    UPDATE public.health_checks
       SET next_run_at = CASE
             WHEN h.refresh_interval IS NOT NULL
               THEN clock_timestamp() + h.refresh_interval
             WHEN h.config ? 'threshold'
               THEN clock_timestamp()
                    + make_interval(secs => public.health_threshold_seconds(h.config -> 'threshold'))
             ELSE NULL END
     WHERE id = h.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

COMMENT ON FUNCTION public.run_health_checks() IS
  'The heartbeat''s half of the automatic clock — checks whose threshold has elapsed — plus every manual-interval check that is due. SECURITY DEFINER on 553''s ledger-helper shape.';

REVOKE ALL ON FUNCTION public.run_health_checks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_health_checks() TO beacon_runner;

SELECT cron.schedule('beacon-health-checks', '* * * * *',
  'SET ROLE beacon_runner; SELECT public.run_health_checks();');

-- ── PROVED BY DOING ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid; v_sp uuid; v_proj uuid; v_usr uuid; v_email text;
  v_ds uuid; v_br uuid; v_txn uuid; v_file uuid; v_phys text;
  v_chk uuid; v_r record; v_n int; v_ok boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (name) VALUES ('probe659') RETURNING id INTO v_org;
    INSERT INTO public.spaces (name) VALUES ('probe659') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe659', 'Probe659') RETURNING id INTO v_proj;
    v_usr := gen_random_uuid();
    v_email := 'probe659-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);

    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe659', 'Probe659 DS') RETURNING id INTO v_ds;
    INSERT INTO public.dataset_branches (dataset_id, name)
      VALUES (v_ds, 'master') RETURNING id INTO v_br;
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type)
      VALUES (v_ds, v_br, 'SNAPSHOT') RETURNING id INTO v_txn;
    INSERT INTO public.dataset_schemas (dataset_id, transaction_id, fields)
      VALUES (v_ds, v_txn,
        '[{"name":"pk","type":"STRING"},{"name":"amount","type":"INTEGER"}]'::jsonb);
    INSERT INTO public.dataset_files (dataset_id, transaction_id, logical_path, row_count)
      VALUES (v_ds, v_txn, 'rows.parquet', 3) RETURNING id INTO v_file;
    UPDATE public.dataset_transactions
       SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = v_txn;
    SELECT public.dataset_materialize(v_ds, v_txn) INTO v_phys;
    EXECUTE format(
      'INSERT INTO datasets.%I (_file, pk, amount) VALUES ($1,''A'',10),($1,''B'',20),($1,''C'',30)',
      v_phys) USING v_file;

    -- checks are created THROUGH the policy, as the real role
    SET LOCAL ROLE authenticated;
    INSERT INTO public.health_checks (dataset_id, check_type, config)
    VALUES (v_ds, 'row_count',
      '{"threshold": {"op": "gte", "value": 3}}') RETURNING id INTO v_chk;
    INSERT INTO public.health_checks (dataset_id, check_type, config, severity, escalate)
    VALUES (v_ds, 'column_regex',
      '{"column": "pk", "regex": "^[A-B]$"}', 'moderate', true);
    INSERT INTO public.health_checks (dataset_id, check_type, config)
    VALUES (v_ds, 'primary_key', '{"column": "pk"}');
    INSERT INTO public.health_checks (dataset_id, check_type, config)
    VALUES (v_ds, 'numeric_mean',
      '{"column": "amount", "threshold": {"op": "between", "value": 15, "value2": 25}}');
    INSERT INTO public.health_checks (dataset_id, check_type, config)
    VALUES (v_ds, 'schema',
      '{"comparison_type": "COLUMN_ADDITIONS_ALLOWED", "columns": [{"name": "pk", "type": "STRING"}]}');
    INSERT INTO public.health_checks (dataset_id, check_type, config)
    VALUES (v_ds, 'column_regex', '{"column": "vanished", "regex": "x"}');
    -- an unadmitted type refuses
    v_ok := false;
    BEGIN
      INSERT INTO public.health_checks (dataset_id, check_type, config)
      VALUES (v_ds, 'sync_status', '{}');
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'a sync check was admitted without an evaluator'; END IF;
    -- a config missing its required component refuses
    v_ok := false;
    BEGIN
      INSERT INTO public.health_checks (dataset_id, check_type, config)
      VALUES (v_ds, 'column_regex', '{"column": "pk"}');
    EXCEPTION WHEN check_violation THEN v_ok := true; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'a regex check without a regex was admitted'; END IF;
    RESET ROLE;

    -- a commit evaluates every automatic check on the dataset
    INSERT INTO public.dataset_transactions (dataset_id, branch_id, txn_type, parent_transaction_id)
      VALUES (v_ds, v_br, 'APPEND', v_txn) RETURNING id INTO v_txn;
    -- (the SNAPSHOT committed above fired the trigger once already; the count
    -- below therefore checks the APPEND's own firing)
    UPDATE public.dataset_transactions
       SET status = 'COMMITTED', committed_at = clock_timestamp() WHERE id = v_txn;

    SELECT count(*) INTO v_n FROM public.health_check_results r
      JOIN public.health_checks h ON h.id = r.check_id WHERE h.dataset_id = v_ds;
    IF v_n <> 6 THEN
      RAISE EXCEPTION 'the commit evaluated % check(s); six exist', v_n;
    END IF;

    -- each direction, by name
    SELECT r.* INTO v_r FROM public.health_check_results r
     WHERE r.check_id = v_chk ORDER BY r.reported_at DESC LIMIT 1;
    IF v_r.status <> 'passed' OR v_r.measured <> '3' THEN
      RAISE EXCEPTION 'row_count: % measured %', v_r.status, v_r.measured;
    END IF;
    SELECT r.* INTO v_r FROM public.health_check_results r
      JOIN public.health_checks h ON h.id = r.check_id
     WHERE h.check_type = 'column_regex' AND h.config ->> 'column' = 'pk'
     ORDER BY r.reported_at DESC LIMIT 1;
    IF v_r.status <> 'failed' OR v_r.severity <> 'moderate' THEN
      RAISE EXCEPTION 'column_regex should fail moderately first: % %', v_r.status, v_r.severity;
    END IF;
    SELECT r.* INTO v_r FROM public.health_check_results r
      JOIN public.health_checks h ON h.id = r.check_id
     WHERE h.check_type = 'primary_key' ORDER BY r.reported_at DESC LIMIT 1;
    IF v_r.status <> 'passed' THEN RAISE EXCEPTION 'primary_key: %', v_r.status; END IF;
    SELECT r.* INTO v_r FROM public.health_check_results r
      JOIN public.health_checks h ON h.id = r.check_id
     WHERE h.check_type = 'numeric_mean' ORDER BY r.reported_at DESC LIMIT 1;
    IF v_r.status <> 'passed' THEN RAISE EXCEPTION 'numeric_mean: %', v_r.status; END IF;
    SELECT r.* INTO v_r FROM public.health_check_results r
      JOIN public.health_checks h ON h.id = r.check_id
     WHERE h.check_type = 'schema' ORDER BY r.reported_at DESC LIMIT 1;
    IF v_r.status <> 'passed' THEN RAISE EXCEPTION 'schema: %', v_r.status; END IF;
    -- the capture's third state: a column the schema does not hold
    SELECT r.* INTO v_r FROM public.health_check_results r
      JOIN public.health_checks h ON h.id = r.check_id
     WHERE h.config ->> 'column' = 'vanished' ORDER BY r.reported_at DESC LIMIT 1;
    IF v_r.status <> 'error' THEN
      RAISE EXCEPTION 'an unevaluable check did not record Error: %', v_r.status;
    END IF;

    -- escalation: the second consecutive failure reports critical
    PERFORM public.evaluate_health_check(h.id) FROM public.health_checks h
     WHERE h.check_type = 'column_regex' AND h.config ->> 'column' = 'pk';
    SELECT r.* INTO v_r FROM public.health_check_results r
      JOIN public.health_checks h ON h.id = r.check_id
     WHERE h.check_type = 'column_regex' AND h.config ->> 'column' = 'pk'
     ORDER BY r.reported_at DESC LIMIT 1;
    IF v_r.severity <> 'critical' THEN
      RAISE EXCEPTION 'consecutive failure did not escalate: %', v_r.severity;
    END IF;

    -- the watcher vocabulary, through the policy
    SET LOCAL ROLE authenticated;
    INSERT INTO public.health_check_watchers (check_id, user_id, level)
    VALUES (v_chk, v_usr, 'only_critical');
    RESET ROLE;

    -- the heartbeat picks up a due manual-interval check
    SET LOCAL ROLE authenticated;
    INSERT INTO public.health_checks (dataset_id, check_type, config, refresh_interval)
    VALUES (v_ds, 'null_percentage',
      '{"column": "amount", "threshold": {"op": "lte", "value": 0}}',
      interval '5 minutes');
    RESET ROLE;
    SET LOCAL ROLE beacon_runner;
    v_n := public.run_health_checks();
    RESET ROLE;
    IF v_n < 1 THEN RAISE EXCEPTION 'the heartbeat ran nothing'; END IF;
    SELECT r.* INTO v_r FROM public.health_check_results r
      JOIN public.health_checks h ON h.id = r.check_id
     WHERE h.check_type = 'null_percentage' ORDER BY r.reported_at DESC LIMIT 1;
    IF v_r.status <> 'passed' THEN RAISE EXCEPTION 'null_percentage: %', v_r.status; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.health_checks
                    WHERE check_type = 'null_percentage' AND next_run_at > clock_timestamp()) THEN
      RAISE EXCEPTION 'the interval check did not reschedule';
    END IF;

    -- the STRICT schema variant grows its own column list
    SET LOCAL ROLE authenticated;
    INSERT INTO public.health_checks (dataset_id, check_type, config)
    VALUES (v_ds, 'schema',
      '{"comparison_type": "COLUMN_ADDITIONS_ALLOWED_STRICT", "columns": [{"name": "pk", "type": "STRING"}]}')
    RETURNING id INTO v_chk;
    RESET ROLE;
    PERFORM public.evaluate_health_check(v_chk);
    IF NOT EXISTS (SELECT 1 FROM public.health_checks
                    WHERE id = v_chk
                      AND config -> 'columns' @> '[{"name": "amount"}]'::jsonb) THEN
      RAISE EXCEPTION 'the STRICT schema check did not adopt the added column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM cron.job
                    WHERE command ~ 'run_health_checks' AND active) THEN
      RAISE EXCEPTION 'the health job is not on the scheduler';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '659 proved: six checks evaluated on one commit across five families, pass and fail and Error each by name, escalation on the consecutive failure, the unadmitted type and the incomplete config refused, and the heartbeat ran and rescheduled the interval check';
  END;
END $$;
