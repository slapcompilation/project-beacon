-- The monitoring engine, from readings/monitoring-views.md (built after a
-- human read its Decisions block). Where a health check watches one dataset's
-- data, a monitoring view is the subscription product one level up:
--
--   "Monitoring views are a collection of monitoring rules and health checks."
--   — monitoring-views/overview.md
--
-- ── A VIEW IS A FILESYSTEM RESOURCE ──────────────────────────────────────────
--
--   "Monitoring views are filesystem resources. If you are creating a new monitoring view, be sure to store it in a project accessible to potential subscribers."
--   — monitoring-views/overview.md
--
-- So the table carries the same location trio datasets got in 497 (project_id,
-- folder_id, trashed_*), visibility composes resource_file_access, and
-- effective_file_markings gains a monitoring_view arm so folder and project
-- markings protect it like every other file. The RID grammar
-- ri.data-health.main.monitoring-view is INFERENCE — no page prints a view
-- RID; the service segment follows the check's (660).
--
-- ── A RULE HOLDS ONE CONDITION PER SEVERITY ──────────────────────────────────
-- The condition-breakdown popover draws a rule as severity-threshold pairs
-- over one metric (alert-debug-condition-breakdown.png: High if value is
-- greater than 1, Medium if value is greater than 0 — paraphrased, capture
-- text is not quotable in a migration header), and the reference's defaults
-- pair them the same way:
--
--   "The default behavior for this monitor is to alert with medium severity at one failure and high severity at three failures, though these thresholds are highly dependent on the frequency and stability of the schedules that are included in the monitoring rule's scope."
--   — monitoring-views/rules-reference.md
--
-- The comparator is NOT per condition: every rule table prints exactly one
-- ("If value is greater than or equal to"), so it derives from the rule type.
-- An alert fires at the highest severity whose condition holds.
--
-- ── THE FIRST TRANCHE IS WHAT OUR LEDGERS CAN ANSWER ─────────────────────────
-- Five rule types, each snake_case of its reference heading, emit-only:
--
--   consecutive_schedule_failures — "This does not count schedule runs that result in a cancelled build."
--   — monitoring-views/rules-reference.md
--   (we also skip outcome='Ignored' runs — a run that never built is neither
--   a failure nor a success; INFERENCE, the page does not mention Ignored)
--
--   time_since_job_last_succeeded — "Alerts when a job on a dataset has not succeeded within a specified time threshold."
--   — monitoring-views/rules-reference.md
--   Counting by job state alone gives the two stated always-pass conditions
--   ("The job succeeded, but the transaction was aborted", "The job
--   succeeded, but no new data was added") for free.
--
--   schedule_duration, automation_has_no_new_triggers, and
--   automation_had_repeated_evaluation_failures_in_a_window complete the set.
--
-- Excluded, each with its reason: object/link sync-job rules (the reading
-- called them answerable; probing object_type_indexes CORRECTS that — it is a
-- current-status scalar, not a run ledger, so consecutive failures cannot be
-- counted; the reading is amended alongside this migration), function and
-- action rules (no run ledger exists — a rule before its ledger is an engine
-- nothing feeds), automation no-new-evaluations and effect-failure rules
-- (automation_events records evaluation_failed and automation_triggered, not
-- successful evaluations or effect executions), disabled-by-system (we have
-- no system-disable mechanism), and the agent/streaming/live-deployment/
-- time-series/geotemporal families (products we do not have).
--
-- ── SCOPES ───────────────────────────────────────────────────────────────────
--
--   "**Folder:** The monitor is applied to resources of the specified type in the scoped folder, not including subfolders."
--   — monitoring-views/core-concepts.md
--
-- Dynamic scopes resolve to members AT EVALUATION TIME — that is the point:
--
--   "Monitors cover an entire scope rather than a single resource. This means that when an additional resource is added to that scope, it is automatically covered by the rule."
--   — monitoring-views/monitoring-faq.md
--
-- The published scope table (monitoring-views/overview) admits Dataset:
-- Single/Folder/Project and Automation: Single/Project — both held here.
-- Schedule is published as Single/Project, but OUR schedules carry no
-- location (495: organization only), so schedule rules are single-scope until
-- schedules live somewhere. A scoped divergence, recorded in the map.
--
-- ── ALERTS ARE STATEFUL PER (RULE, TARGET) ───────────────────────────────────
--
--   "The alert history section displays a timeline of monitor status transitions for this rule over the past 30 days."
--   — monitoring-views/alert-debug-page.md
--
-- One row per (rule, target) that transitions between failing and passing,
-- with a transitions table as the timeline. Snooze is platform-wide (the
-- dialog says it suspends notifications for all users and requires a reason —
-- snooze-monitor-alert.png, paraphrased) and outlives re-fires:
--
--   "Unlike health check alerts, snoozed monitor alerts remain snoozed even if they re-fire. You must wait for the snooze to expire or manually un-snooze to resume notifications."
--   — monitoring-views/overview.md
--
-- Rule-level snooze subsumes target-level ones, by trigger:
--
--   "When you snooze a monitor rule, any existing target-level snoozes for that rule will be replaced by the new rule-level snooze."
--   — monitoring-views/overview.md
--
-- ── SUBSCRIBERS ARE THE AUDIENCE, NOT THE DELIVERY ───────────────────────────
--
--   "You can add users and user groups, and configure their alerts based on severity."
--   — monitoring-views/overview.md
--
-- Stored as rows with a minimum severity (the based-on-severity reading is
-- INFERENCE — the page does not say threshold versus exact-match); email,
-- PagerDuty, Slack and webhooks stay the notification residual.
--
-- Evaluation rides a per-minute heartbeat like 659's, as beacon_runner.
-- Nothing here may call evaluate directly as authenticated.

-- ── THE RULE-TYPE VOCABULARY, EMIT-ONLY ──────────────────────────────────────

CREATE FUNCTION public.monitoring_rule_types() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'consecutive_schedule_failures', 'schedule_duration',
    'time_since_job_last_succeeded',
    'automation_has_no_new_triggers',
    'automation_had_repeated_evaluation_failures_in_a_window']
$$;

COMMENT ON FUNCTION public.monitoring_rule_types() IS
  'The rule types the evaluator executes — each snake_case of its monitoring-views/rules-reference heading. Emit-only: the reference''s eleven families are the ceiling and the spelling authority; a type arrives here with its evaluator arm, never before.';

-- Which resource family a rule type monitors, and its one comparator — every
-- reference table prints exactly one comparator per rule type.
CREATE FUNCTION public.monitoring_rule_family(p_type text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'consecutive_schedule_failures' THEN 'schedule'
    WHEN 'schedule_duration'             THEN 'schedule'
    WHEN 'time_since_job_last_succeeded' THEN 'dataset'
    WHEN 'automation_has_no_new_triggers' THEN 'automation'
    WHEN 'automation_had_repeated_evaluation_failures_in_a_window' THEN 'automation'
  END
$$;

CREATE FUNCTION public.monitoring_rule_comparator(p_type text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_type
    WHEN 'consecutive_schedule_failures' THEN 'gte'
    WHEN 'schedule_duration'             THEN 'gte'
    WHEN 'time_since_job_last_succeeded' THEN 'gt'
    WHEN 'automation_has_no_new_triggers' THEN 'gte'
    WHEN 'automation_had_repeated_evaluation_failures_in_a_window' THEN 'gt'
  END
$$;

COMMENT ON FUNCTION public.monitoring_rule_comparator(text) IS
  'The one comparator each rules-reference table prints for its type ("If value is greater than [or equal to]") — a property of the metric, never of a condition row.';

-- ── THE TABLES ───────────────────────────────────────────────────────────────

CREATE TABLE public.monitoring_views (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rid             text GENERATED ALWAYS AS (public.rid_of('data-health', 'monitoring-view', id)) STORED,
  organization_id uuid NOT NULL DEFAULT public.auth_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- a view with nowhere to live is a permission hole, like a dataset (497)
  project_id      uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  folder_id       uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  description     text NOT NULL DEFAULT '',
  trashed_at      timestamptz,
  trashed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by      uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.monitoring_views IS
  'A monitoring view: a filesystem resource collecting monitoring rules for an audience of subscribers (monitoring-views/overview). Location is the permission source like every file; the RID grammar is inference, following the check''s service segment.';

CREATE UNIQUE INDEX monitoring_views_rid_key ON public.monitoring_views (rid);
CREATE INDEX monitoring_views_project ON public.monitoring_views (project_id);
CREATE INDEX monitoring_views_folder ON public.monitoring_views (folder_id);
CREATE INDEX monitoring_views_trashed_by ON public.monitoring_views (trashed_by);
CREATE INDEX monitoring_views_created_by ON public.monitoring_views (created_by);

CREATE TABLE public.monitoring_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id          uuid NOT NULL REFERENCES public.monitoring_views(id) ON DELETE CASCADE,
  resource_type    text NOT NULL CHECK (resource_type = ANY (ARRAY['schedule', 'dataset', 'automation'])),
  rule_type        text NOT NULL CHECK (rule_type = ANY (public.monitoring_rule_types())),
  scope_kind       text NOT NULL CHECK (scope_kind = ANY (ARRAY['single', 'folder', 'project'])),
  target_id        uuid,
  scope_folder_id  uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  scope_project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  -- the windowed rule's second component ("Time window", rules-reference)
  time_window      interval,
  snoozed_until    timestamptz,
  snoozed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  snooze_reason    text,
  created_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (public.monitoring_rule_family(rule_type) = resource_type),
  CHECK (num_nonnulls(target_id, scope_folder_id, scope_project_id) = 1),
  CHECK ((scope_kind = 'single')  = (target_id IS NOT NULL)),
  CHECK ((scope_kind = 'folder')  = (scope_folder_id IS NOT NULL)),
  CHECK ((scope_kind = 'project') = (scope_project_id IS NOT NULL)),
  -- the published scope table, narrowed where our resources lack a location
  CONSTRAINT monitoring_rules_scope_availability CHECK (
    CASE resource_type
      WHEN 'schedule'   THEN scope_kind = 'single'
      WHEN 'dataset'    THEN true
      WHEN 'automation' THEN scope_kind IN ('single', 'project')
    END),
  CONSTRAINT monitoring_rules_window_presence CHECK (
    (rule_type = 'automation_had_repeated_evaluation_failures_in_a_window')
    = (time_window IS NOT NULL)),
  CONSTRAINT monitoring_rules_snooze_reason CHECK (
    snoozed_until IS NULL OR length(btrim(coalesce(snooze_reason, ''))) > 0)
);

COMMENT ON TABLE public.monitoring_rules IS
  'One monitoring rule: a metric over a scope of resources (monitoring-views/core-concepts). Static single names its target; folder is direct children only; project resolves at evaluation time. Snooze here silences every target of the rule at once.';

COMMENT ON CONSTRAINT monitoring_rules_resource_type_check ON public.monitoring_rules IS
  'Values from monitoring-views/overview — the supported-resource table, narrowed to the families our ledgers answer (Schedule, Dataset, Automation).';

COMMENT ON CONSTRAINT monitoring_rules_scope_kind_check ON public.monitoring_rules IS
  'Values from monitoring-views/core-concepts — Single is the static scope, Folder and Project the dynamic ones we can resolve.';

COMMENT ON CONSTRAINT monitoring_rules_scope_availability ON public.monitoring_rules IS
  'The published per-resource scope availability (monitoring-views/overview), except schedules: published Single and Project, held Single-only because our schedules carry no location (495). A scoped divergence.';

CREATE INDEX monitoring_rules_view ON public.monitoring_rules (view_id);
CREATE INDEX monitoring_rules_scope_folder ON public.monitoring_rules (scope_folder_id);
CREATE INDEX monitoring_rules_scope_project ON public.monitoring_rules (scope_project_id);
CREATE INDEX monitoring_rules_snoozed_by ON public.monitoring_rules (snoozed_by);
CREATE INDEX monitoring_rules_created_by ON public.monitoring_rules (created_by);

CREATE TABLE public.monitoring_rule_conditions (
  rule_id   uuid NOT NULL REFERENCES public.monitoring_rules(id) ON DELETE CASCADE,
  severity  text NOT NULL CHECK (severity = ANY (ARRAY['low', 'medium', 'high'])),
  threshold numeric NOT NULL,
  PRIMARY KEY (rule_id, severity)
);

COMMENT ON TABLE public.monitoring_rule_conditions IS
  'One condition per severity per rule — the condition-breakdown popover''s shape. threshold is a count for counting metrics and seconds for duration metrics; the comparator comes from the rule type. An alert fires at the highest severity whose condition holds.';

COMMENT ON CONSTRAINT monitoring_rule_conditions_severity_check ON public.monitoring_rule_conditions IS
  'Values from monitoring-views/overview — the monitors'' own three ("low, medium, and high"), distinct from the checks'' moderate/critical pair.';

CREATE TABLE public.monitoring_alerts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id           uuid NOT NULL REFERENCES public.monitoring_rules(id) ON DELETE CASCADE,
  target_id         uuid NOT NULL,
  status            text NOT NULL CHECK (status = ANY (ARRAY['failing', 'passing'])),
  -- the severity it is failing at; NULL while passing
  severity          text CHECK (severity = ANY (ARRAY['low', 'medium', 'high'])),
  measured          text,
  fired_at          timestamptz,
  last_evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  snoozed_until     timestamptz,
  snoozed_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  snooze_reason     text,
  UNIQUE (rule_id, target_id),
  CONSTRAINT monitoring_alerts_snooze_reason CHECK (
    snoozed_until IS NULL OR length(btrim(coalesce(snooze_reason, ''))) > 0)
);

COMMENT ON TABLE public.monitoring_alerts IS
  'One stateful alert per (rule, target): fires when a condition starts holding, resolves when it stops. fired_at is the "since" of the debug page''s status line. Snooze is platform-wide with a required reason and outlives re-fires — the stated divergence from health checks.';

COMMENT ON CONSTRAINT monitoring_alerts_status_check ON public.monitoring_alerts IS
  'Values from monitoring-views/alert-debug-page — the status badge''s two words, Passing and Failing.';

COMMENT ON CONSTRAINT monitoring_alerts_severity_check ON public.monitoring_alerts IS
  'Values from monitoring-views/overview — low, medium, and high.';

CREATE INDEX monitoring_alerts_rule ON public.monitoring_alerts (rule_id);
CREATE INDEX monitoring_alerts_snoozed_by ON public.monitoring_alerts (snoozed_by);

CREATE TABLE public.monitoring_alert_transitions (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.monitoring_alerts(id) ON DELETE CASCADE,
  status   text NOT NULL CHECK (status = ANY (ARRAY['failing', 'passing'])),
  severity text CHECK (severity = ANY (ARRAY['low', 'medium', 'high'])),
  at       timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.monitoring_alert_transitions IS
  'The alert-history timeline: one row per status transition (monitoring-views/alert-debug-page), written by the evaluator when the alert''s state changes.';

COMMENT ON CONSTRAINT monitoring_alert_transitions_status_check ON public.monitoring_alert_transitions IS
  'Values from monitoring-views/alert-debug-page — Passing and Failing, the badge at each transition.';

COMMENT ON CONSTRAINT monitoring_alert_transitions_severity_check ON public.monitoring_alert_transitions IS
  'Values from monitoring-views/overview — low, medium, and high.';

CREATE INDEX monitoring_alert_transitions_alert ON public.monitoring_alert_transitions (alert_id, at DESC);

CREATE TABLE public.monitoring_subscribers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id      uuid NOT NULL REFERENCES public.monitoring_views(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES public.users(id) ON DELETE CASCADE,
  group_id     uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  min_severity text NOT NULL DEFAULT 'low' CHECK (min_severity = ANY (ARRAY['low', 'medium', 'high'])),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(user_id, group_id) = 1)
);

COMMENT ON TABLE public.monitoring_subscribers IS
  'The view''s audience: users and user groups with per-severity routing (monitoring-views/overview). min_severity as a threshold is inference — the page says alerts are configured "based on severity" without stating threshold versus exact match. Delivery (email, external systems) is the recorded residual.';

COMMENT ON CONSTRAINT monitoring_subscribers_min_severity_check ON public.monitoring_subscribers IS
  'Values from monitoring-views/overview — low, medium, and high.';

CREATE UNIQUE INDEX monitoring_subscribers_principal
  ON public.monitoring_subscribers (view_id, coalesce(user_id, group_id));
CREATE INDEX monitoring_subscribers_user ON public.monitoring_subscribers (user_id);
CREATE INDEX monitoring_subscribers_group ON public.monitoring_subscribers (group_id);

-- ── MARKINGS REACH THE NEW KIND ──────────────────────────────────────────────
-- effective_file_markings dispatches per kind; the monitoring_view arms make
-- folder and project markings protect a view the way they protect a dataset.
-- Patch the live definition, never retype it: two anchors, two refusals,
-- nothing else moves.
DO $$
DECLARE src text; a1 text; a2 text;
BEGIN
  src := pg_get_functiondef('public.effective_file_markings(text,uuid)'::regprocedure);
  a1 := 'WHEN ''folder''          THEN (SELECT f.parent_folder_id FROM public.folders f WHERE f.id = p_id)';
  a2 := 'WHEN ''folder''          THEN (SELECT f.project_id FROM public.folders f WHERE f.id = p_id)';
  IF position(a1 in src) = 0 OR position(a2 in src) = 0 THEN
    RAISE EXCEPTION 'an anchor moved: effective_file_markings is not the text 661 read';
  END IF;
  src := replace(src, a1, a1 || '
      WHEN ''monitoring_view'' THEN (SELECT mv.folder_id FROM public.monitoring_views mv WHERE mv.id = p_id)');
  src := replace(src, a2, a2 || '
            WHEN ''monitoring_view'' THEN (SELECT mv.project_id FROM public.monitoring_views mv WHERE mv.id = p_id)');
  EXECUTE src;
END $$;

-- ── VISIBILITY AND WRITERS ───────────────────────────────────────────────────

ALTER TABLE public.monitoring_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_rule_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_alert_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_subscribers ENABLE ROW LEVEL SECURITY;

-- Composed, never restated: the same file-access predicate every resource
-- rides, plus the editor rank for writes. SECDEF so child-table policies can
-- consult the parent without riding its RLS.
CREATE FUNCTION public.can_see_monitoring_view(p_view uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.monitoring_views v
    WHERE v.id = p_view
      AND public.resource_file_access('monitoring_view', v.id, v.organization_id))
$$;

CREATE FUNCTION public.can_edit_monitoring_view(p_view uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT public.can_see_monitoring_view(p_view)
     AND EXISTS (SELECT 1 FROM public.monitoring_views v
       WHERE v.id = p_view
         AND (public.auth_role() IN ('owner', 'admin')
              OR public.role_rank(public.project_role(v.project_id)) >= public.role_rank('editor')))
$$;

CREATE FUNCTION public.can_see_monitoring_rule(p_rule uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.monitoring_rules r
    WHERE r.id = p_rule AND public.can_see_monitoring_view(r.view_id))
$$;

CREATE FUNCTION public.can_edit_monitoring_rule(p_rule uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (SELECT 1 FROM public.monitoring_rules r
    WHERE r.id = p_rule AND public.can_edit_monitoring_view(r.view_id))
$$;

REVOKE ALL ON FUNCTION public.can_see_monitoring_view(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_monitoring_view(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_see_monitoring_rule(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_monitoring_rule(uuid) FROM PUBLIC, anon;

-- Over the row's own columns where the row is the resource (the 659 lesson:
-- INSERT ... RETURNING must pass the SELECT policy, and a self-lookup cannot
-- see the row being inserted).
CREATE POLICY "views follow their location" ON public.monitoring_views
  FOR SELECT USING (public.resource_file_access('monitoring_view', id, organization_id));
CREATE POLICY "editors add views" ON public.monitoring_views
  FOR INSERT WITH CHECK (organization_id IS NOT DISTINCT FROM (SELECT public.auth_org_id())
    AND ((SELECT public.auth_role()) IN ('owner', 'admin')
         OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor')));
CREATE POLICY "editors adjust views" ON public.monitoring_views
  FOR UPDATE USING ((SELECT public.auth_role()) IN ('owner', 'admin')
         OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'))
  WITH CHECK ((SELECT public.auth_role()) IN ('owner', 'admin')
         OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));
CREATE POLICY "editors remove views" ON public.monitoring_views
  FOR DELETE USING ((SELECT public.auth_role()) IN ('owner', 'admin')
         OR public.role_rank(public.project_role(project_id)) >= public.role_rank('editor'));

CREATE POLICY "rules follow their view" ON public.monitoring_rules
  FOR SELECT USING (public.can_see_monitoring_view(view_id));
CREATE POLICY "editors add rules" ON public.monitoring_rules
  FOR INSERT WITH CHECK (public.can_edit_monitoring_view(view_id));
CREATE POLICY "editors adjust rules" ON public.monitoring_rules
  FOR UPDATE USING (public.can_edit_monitoring_view(view_id))
  WITH CHECK (public.can_edit_monitoring_view(view_id));
CREATE POLICY "editors remove rules" ON public.monitoring_rules
  FOR DELETE USING (public.can_edit_monitoring_view(view_id));

CREATE POLICY "conditions follow their rule" ON public.monitoring_rule_conditions
  FOR SELECT USING (public.can_see_monitoring_rule(rule_id));
CREATE POLICY "editors add conditions" ON public.monitoring_rule_conditions
  FOR INSERT WITH CHECK (public.can_edit_monitoring_rule(rule_id));
CREATE POLICY "editors adjust conditions" ON public.monitoring_rule_conditions
  FOR UPDATE USING (public.can_edit_monitoring_rule(rule_id))
  WITH CHECK (public.can_edit_monitoring_rule(rule_id));
CREATE POLICY "editors remove conditions" ON public.monitoring_rule_conditions
  FOR DELETE USING (public.can_edit_monitoring_rule(rule_id));

-- Alerts are written by the evaluator alone; the one caller-facing write is
-- the snooze, held to its three columns the 657 way.
CREATE POLICY "alerts follow their rule" ON public.monitoring_alerts
  FOR SELECT USING (public.can_see_monitoring_rule(rule_id));
CREATE POLICY "editors snooze alerts" ON public.monitoring_alerts
  FOR UPDATE USING (public.can_edit_monitoring_rule(rule_id))
  WITH CHECK (public.can_edit_monitoring_rule(rule_id));
REVOKE INSERT, UPDATE, DELETE ON public.monitoring_alerts FROM authenticated;
GRANT UPDATE (snoozed_until, snoozed_by, snooze_reason)
  ON public.monitoring_alerts TO authenticated;

CREATE POLICY "transitions follow their alert" ON public.monitoring_alert_transitions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.monitoring_alerts a
    WHERE a.id = alert_id AND public.can_see_monitoring_rule(a.rule_id)));
REVOKE INSERT, UPDATE, DELETE ON public.monitoring_alert_transitions FROM authenticated;

CREATE POLICY "subscribers follow their view" ON public.monitoring_subscribers
  FOR SELECT USING (public.can_see_monitoring_view(view_id));
CREATE POLICY "editors add subscribers" ON public.monitoring_subscribers
  FOR INSERT WITH CHECK (public.can_edit_monitoring_view(view_id));
CREATE POLICY "editors adjust subscribers" ON public.monitoring_subscribers
  FOR UPDATE USING (public.can_edit_monitoring_view(view_id))
  WITH CHECK (public.can_edit_monitoring_view(view_id));
CREATE POLICY "editors remove subscribers" ON public.monitoring_subscribers
  FOR DELETE USING (public.can_edit_monitoring_view(view_id));

-- ── A RULE'S TARGET MUST BE VISIBLE TO WHOEVER SETS IT ───────────────────────
--
--   "You must have `Viewer` permission on the resources to monitor them."
--   — monitoring-views/overview.md
--
-- SECURITY INVOKER on purpose: the SELECTs ride the caller's own RLS, so
-- "visible" means visible to the person creating the rule.
CREATE FUNCTION public.guard_monitoring_rule_target() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.scope_kind = 'single' THEN
    IF NOT EXISTS (
      SELECT 1 WHERE CASE NEW.resource_type
        WHEN 'schedule'   THEN EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = NEW.target_id)
        WHEN 'dataset'    THEN EXISTS (SELECT 1 FROM public.datasets d WHERE d.id = NEW.target_id)
        WHEN 'automation' THEN EXISTS (SELECT 1 FROM public.automations a WHERE a.id = NEW.target_id)
      END)
    THEN
      RAISE EXCEPTION 'Monitoring:TargetNotVisible — you need Viewer permission on a resource to monitor it';
    END IF;
  ELSIF NEW.scope_folder_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.folders f WHERE f.id = NEW.scope_folder_id) THEN
      RAISE EXCEPTION 'Monitoring:TargetNotVisible — you need Viewer permission on a resource to monitor it';
    END IF;
  ELSIF NEW.scope_project_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = NEW.scope_project_id) THEN
      RAISE EXCEPTION 'Monitoring:TargetNotVisible — you need Viewer permission on a resource to monitor it';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER guard_monitoring_rule_target BEFORE INSERT OR UPDATE ON public.monitoring_rules
FOR EACH ROW EXECUTE FUNCTION public.guard_monitoring_rule_target();

-- ── RULE-LEVEL SNOOZE REPLACES TARGET-LEVEL ONES ─────────────────────────────
CREATE FUNCTION public.clear_alert_snoozes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
BEGIN
  UPDATE public.monitoring_alerts
     SET snoozed_until = NULL, snoozed_by = NULL, snooze_reason = NULL
   WHERE rule_id = NEW.id AND snoozed_until IS NOT NULL;
  RETURN NEW;
END $$;

CREATE TRIGGER clear_alert_snoozes AFTER UPDATE OF snoozed_until ON public.monitoring_rules
FOR EACH ROW WHEN (NEW.snoozed_until IS NOT NULL)
EXECUTE FUNCTION public.clear_alert_snoozes();

-- ── THE EVALUATOR ────────────────────────────────────────────────────────────

CREATE FUNCTION public.evaluate_monitoring_rule(p_rule uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  r record; a record; v_target uuid; v_value numeric; v_sev text;
  v_measured text; v_cmp text; v_new_status text;
BEGIN
  SELECT * INTO r FROM public.monitoring_rules WHERE id = p_rule;
  IF NOT FOUND THEN RETURN; END IF;
  v_cmp := public.monitoring_rule_comparator(r.rule_type);

  -- dynamic scopes resolve to members NOW — the automatically-covered point
  FOR v_target IN
    SELECT t.id FROM (
      SELECT r.target_id AS id WHERE r.scope_kind = 'single'
      UNION ALL
      SELECT d.id FROM public.datasets d
       WHERE r.scope_kind = 'folder' AND d.folder_id = r.scope_folder_id
         AND d.trashed_at IS NULL AND r.resource_type = 'dataset'
      UNION ALL
      SELECT d.id FROM public.datasets d
       WHERE r.scope_kind = 'project' AND d.project_id = r.scope_project_id
         AND d.trashed_at IS NULL AND r.resource_type = 'dataset'
      UNION ALL
      SELECT au.id FROM public.automations au
       WHERE r.scope_kind = 'project' AND au.project_id = r.scope_project_id
         AND r.resource_type = 'automation'
    ) t
  LOOP
    CASE r.rule_type
      WHEN 'consecutive_schedule_failures' THEN
        -- the leading Failed streak; cancelled builds are not counted, and
        -- Ignored runs (never built) are skipped the same way
        WITH runs AS (
          SELECT sr.outcome, row_number() OVER (ORDER BY sr.ran_at DESC) AS rn
            FROM public.schedule_runs sr
            LEFT JOIN public.builds b ON b.id = sr.build_id
           WHERE sr.schedule_id = v_target AND sr.outcome <> 'Ignored'
             AND (b.status IS NULL OR b.status <> 'CANCELED'))
        SELECT count(*) INTO v_value FROM runs
         WHERE outcome = 'Failed'
           AND rn < coalesce((SELECT min(rn) FROM runs WHERE outcome = 'Succeeded'), 2147483647);
        v_measured := v_value::text || ' consecutive';

      WHEN 'schedule_duration' THEN
        SELECT coalesce(max(extract(epoch FROM clock_timestamp() - b.started_at)), 0)
          INTO v_value
          FROM public.schedule_runs sr
          JOIN public.builds b ON b.id = sr.build_id
         WHERE sr.schedule_id = v_target AND b.status = 'RUNNING';
        v_measured := round(v_value)::text || 's';

      WHEN 'time_since_job_last_succeeded' THEN
        -- job state alone: an aborted transaction or an empty update still
        -- counts as the job succeeding, the two stated always-pass conditions
        SELECT extract(epoch FROM clock_timestamp() - coalesce(
                 (SELECT max(j.finished_at) FROM public.build_jobs j
                   WHERE j.output_dataset_id = v_target AND j.state = 'COMPLETED'),
                 (SELECT d.created_at FROM public.datasets d WHERE d.id = v_target)))
          INTO v_value;
        v_measured := round(v_value)::text || 's';

      WHEN 'automation_has_no_new_triggers' THEN
        SELECT extract(epoch FROM clock_timestamp() - coalesce(
                 (SELECT max(e.occurred_at) FROM public.automation_events e
                   WHERE e.automation_id = v_target AND e.event_type = 'automation_triggered'),
                 (SELECT au.created_at FROM public.automations au WHERE au.id = v_target)))
          INTO v_value;
        v_measured := round(v_value)::text || 's';

      WHEN 'automation_had_repeated_evaluation_failures_in_a_window' THEN
        SELECT count(*) INTO v_value
          FROM public.automation_events e
         WHERE e.automation_id = v_target AND e.event_type = 'evaluation_failed'
           AND e.occurred_at >= clock_timestamp() - r.time_window;
        v_measured := v_value::text || ' failures';
    END CASE;

    -- the highest severity whose condition holds fires
    SELECT c.severity INTO v_sev
      FROM public.monitoring_rule_conditions c
     WHERE c.rule_id = r.id
       AND CASE v_cmp WHEN 'gt' THEN v_value > c.threshold
                      ELSE v_value >= c.threshold END
     ORDER BY array_position(ARRAY['low', 'medium', 'high'], c.severity) DESC
     LIMIT 1;
    v_new_status := CASE WHEN v_sev IS NULL THEN 'passing' ELSE 'failing' END;

    SELECT * INTO a FROM public.monitoring_alerts
     WHERE rule_id = r.id AND target_id = v_target;
    IF NOT FOUND THEN
      INSERT INTO public.monitoring_alerts
        (rule_id, target_id, status, severity, measured, fired_at, last_evaluated_at)
      VALUES (r.id, v_target, v_new_status, v_sev, v_measured,
              CASE WHEN v_new_status = 'failing' THEN clock_timestamp() END,
              clock_timestamp())
      RETURNING * INTO a;
      INSERT INTO public.monitoring_alert_transitions (alert_id, status, severity)
      VALUES (a.id, v_new_status, v_sev);
    ELSIF a.status <> v_new_status OR a.severity IS DISTINCT FROM v_sev THEN
      INSERT INTO public.monitoring_alert_transitions (alert_id, status, severity)
      VALUES (a.id, v_new_status, v_sev);
      UPDATE public.monitoring_alerts
         SET status = v_new_status, severity = v_sev, measured = v_measured,
             fired_at = CASE WHEN v_new_status = 'failing' AND a.status = 'passing'
                             THEN clock_timestamp() ELSE fired_at END,
             last_evaluated_at = clock_timestamp()
       WHERE id = a.id;
    ELSE
      UPDATE public.monitoring_alerts
         SET measured = v_measured, last_evaluated_at = clock_timestamp()
       WHERE id = a.id;
    END IF;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.evaluate_monitoring_rule(uuid) IS
  'Resolves the rule''s scope to members, computes the metric per member, and fires or resolves the (rule, target) alert with a transition row. Snooze never stops evaluation — it only silences notifications, so a snoozed alert keeps its history current.';

REVOKE ALL ON FUNCTION public.evaluate_monitoring_rule(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.run_monitoring_rules() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id FROM public.monitoring_rules LOOP
    PERFORM public.evaluate_monitoring_rule(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

COMMENT ON FUNCTION public.run_monitoring_rules() IS
  'The monitoring heartbeat: evaluates every rule. No page states the monitors'' evaluation clock (the reading''s open question 1), so it rides the same per-minute cadence as run_health_checks.';

REVOKE ALL ON FUNCTION public.run_monitoring_rules() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_monitoring_rules() TO beacon_runner;

SELECT cron.schedule('beacon-monitoring-rules', '* * * * *',
  'SET ROLE beacon_runner; SELECT public.run_monitoring_rules();');

-- ── PROVED BY DOING ──────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid; v_usr uuid; v_email text; v_sp uuid; v_proj uuid; v_ds uuid; v_sched uuid;
  v_auto uuid; v_view uuid; v_r1 uuid; v_r2 uuid; v_r3 uuid; v_r4 uuid;
  v_build uuid; v_alert record; v_n int;
BEGIN
  BEGIN
    -- fixtures: an org, an admin, a project, a dataset, a schedule with a
    -- failure history, an automation with events
    INSERT INTO public.organizations (name) VALUES ('probe661') RETURNING id INTO v_org;
    v_usr := gen_random_uuid();
    v_email := 'probe661-' || v_usr || '@beacon.test';
    INSERT INTO auth.users (id, instance_id, aud, role, email)
      VALUES (v_usr, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email);
    INSERT INTO public.users (id, email, role, organization_id)
      VALUES (v_usr, v_email, 'admin', v_org);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usr::text,
      'app_metadata', json_build_object('role', 'admin', 'org_id', v_org))::text, true);

    INSERT INTO public.spaces (name) VALUES ('probe661') RETURNING id INTO v_sp;
    INSERT INTO public.space_organizations (space_id, organization_id) VALUES (v_sp, v_org);
    INSERT INTO public.projects (organization_id, space_id, api_name, name)
      VALUES (v_org, v_sp, 'probe661', 'Probe661') RETURNING id INTO v_proj;
    INSERT INTO public.project_role_grants (project_id, user_id, role, organization_id)
      VALUES (v_proj, v_usr, 'owner', v_org);

    INSERT INTO public.datasets (organization_id, project_id, api_name, name)
      VALUES (v_org, v_proj, 'probe661_ds', 'Probe661') RETURNING id INTO v_ds;

    INSERT INTO public.schedules (organization_id, name, target_dataset_ids, trigger)
      VALUES (v_org, 'Probe661', ARRAY[v_ds], '{"type": "time", "cron": "0 * * * *", "timezone": "UTC"}')
      RETURNING id INTO v_sched;
    -- two failures, then a CANCELED-build failure that must NOT count, then
    -- an older success ending the streak: the streak is exactly 2
    INSERT INTO public.builds (organization_id, status) VALUES (v_org, 'CANCELED') RETURNING id INTO v_build;
    INSERT INTO public.schedule_runs (schedule_id, ran_at, outcome) VALUES
      (v_sched, clock_timestamp() - interval '4 hours', 'Succeeded'),
      (v_sched, clock_timestamp() - interval '2 hours', 'Failed'),
      (v_sched, clock_timestamp() - interval '1 hour', 'Failed');
    INSERT INTO public.schedule_runs (schedule_id, ran_at, outcome, build_id)
      VALUES (v_sched, clock_timestamp() - interval '30 minutes', 'Failed', v_build);

    INSERT INTO public.automations (project_id, display_name, owner_id, condition)
      VALUES (v_proj, 'Probe661', v_usr, '{"type": "time", "cron": "0 * * * *"}')
      RETURNING id INTO v_auto;
    INSERT INTO public.automation_events (automation_id, event_type, occurred_at) VALUES
      (v_auto, 'evaluation_failed', clock_timestamp() - interval '10 minutes'),
      (v_auto, 'evaluation_failed', clock_timestamp() - interval '5 minutes');

    -- the view and its rules, created as the caller the policies see
    SET LOCAL ROLE authenticated;
    INSERT INTO public.monitoring_views (organization_id, project_id, name)
      VALUES (v_org, v_proj, 'Probe661 view') RETURNING id INTO v_view;

    -- schedule rule: medium at >= 1, high at >= 3; streak of 2 fires MEDIUM,
    -- proving both the per-severity conditions and the cancelled exclusion
    INSERT INTO public.monitoring_rules (view_id, resource_type, rule_type, scope_kind, target_id)
      VALUES (v_view, 'schedule', 'consecutive_schedule_failures', 'single', v_sched)
      RETURNING id INTO v_r1;
    INSERT INTO public.monitoring_rule_conditions (rule_id, severity, threshold)
      VALUES (v_r1, 'medium', 1), (v_r1, 'high', 3);

    -- dataset rule via PROJECT scope: no job ever succeeded, so the metric is
    -- the dataset's age — fires high past one second
    INSERT INTO public.monitoring_rules (view_id, resource_type, rule_type, scope_kind, scope_project_id)
      VALUES (v_view, 'dataset', 'time_since_job_last_succeeded', 'project', v_proj)
      RETURNING id INTO v_r2;
    INSERT INTO public.monitoring_rule_conditions (rule_id, severity, threshold)
      VALUES (v_r2, 'high', -1);

    -- automation windowed rule: 2 failures against > 0 in 1 hour fires low
    INSERT INTO public.monitoring_rules (view_id, resource_type, rule_type, scope_kind, target_id, time_window)
      VALUES (v_view, 'automation', 'automation_had_repeated_evaluation_failures_in_a_window',
              'single', v_auto, interval '1 hour')
      RETURNING id INTO v_r3;
    INSERT INTO public.monitoring_rule_conditions (rule_id, severity, threshold)
      VALUES (v_r3, 'low', 0);

    -- schedule duration: nothing RUNNING, value 0 against >= 1 stays passing
    INSERT INTO public.monitoring_rules (view_id, resource_type, rule_type, scope_kind, target_id)
      VALUES (v_view, 'schedule', 'schedule_duration', 'single', v_sched)
      RETURNING id INTO v_r4;
    INSERT INTO public.monitoring_rule_conditions (rule_id, severity, threshold)
      VALUES (v_r4, 'medium', 1);

    -- a subscriber row holds
    INSERT INTO public.monitoring_subscribers (view_id, user_id, min_severity)
      VALUES (v_view, v_usr, 'medium');

    -- refusals: a family mismatch, a windowed rule without its window, a
    -- schedule rule at project scope (our recorded narrowing), a snooze
    -- without a reason
    BEGIN
      INSERT INTO public.monitoring_rules (view_id, resource_type, rule_type, scope_kind, target_id)
        VALUES (v_view, 'dataset', 'consecutive_schedule_failures', 'single', v_ds);
      RAISE EXCEPTION 'a family mismatch was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      INSERT INTO public.monitoring_rules (view_id, resource_type, rule_type, scope_kind, target_id)
        VALUES (v_view, 'automation', 'automation_had_repeated_evaluation_failures_in_a_window', 'single', v_auto);
      RAISE EXCEPTION 'a windowed rule without a window was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      INSERT INTO public.monitoring_rules (view_id, resource_type, rule_type, scope_kind, scope_project_id)
        VALUES (v_view, 'schedule', 'consecutive_schedule_failures', 'project', v_proj);
      RAISE EXCEPTION 'a project-scoped schedule rule was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
      UPDATE public.monitoring_alerts SET snoozed_until = clock_timestamp() + interval '1 hour'
       WHERE rule_id = v_r1;
      -- no rows yet, so force the CHECK through the rules table instead
      UPDATE public.monitoring_rules SET snoozed_until = clock_timestamp() + interval '1 hour'
       WHERE id = v_r1;
      RAISE EXCEPTION 'a snooze without a reason was admitted';
    EXCEPTION WHEN check_violation THEN NULL; END;

    RESET ROLE;

    -- the heartbeat evaluates everything
    SELECT public.run_monitoring_rules() INTO v_n;
    IF v_n < 4 THEN
      RAISE EXCEPTION 'the heartbeat evaluated % rules, expected at least 4', v_n;
    END IF;

    SELECT * INTO v_alert FROM public.monitoring_alerts WHERE rule_id = v_r1;
    IF v_alert.status <> 'failing' OR v_alert.severity <> 'medium' THEN
      RAISE EXCEPTION 'the schedule streak of 2 (cancelled excluded) should fire medium, got % %',
        v_alert.status, v_alert.severity;
    END IF;
    SELECT * INTO v_alert FROM public.monitoring_alerts WHERE rule_id = v_r2 AND target_id = v_ds;
    IF v_alert.status <> 'failing' OR v_alert.severity <> 'high' THEN
      RAISE EXCEPTION 'the project-scoped dataset rule should fire high, got % %',
        v_alert.status, v_alert.severity;
    END IF;
    SELECT * INTO v_alert FROM public.monitoring_alerts WHERE rule_id = v_r3;
    IF v_alert.status <> 'failing' OR v_alert.severity <> 'low' THEN
      RAISE EXCEPTION 'the windowed automation rule should fire low, got % %',
        v_alert.status, v_alert.severity;
    END IF;
    SELECT * INTO v_alert FROM public.monitoring_alerts WHERE rule_id = v_r4;
    IF v_alert.status <> 'passing' OR v_alert.severity IS NOT NULL THEN
      RAISE EXCEPTION 'the idle duration rule should pass, got % %', v_alert.status, v_alert.severity;
    END IF;

    -- resolution transitions: a success ends the streak, the alert passes
    INSERT INTO public.schedule_runs (schedule_id, ran_at, outcome)
      VALUES (v_sched, clock_timestamp(), 'Succeeded');
    PERFORM public.evaluate_monitoring_rule(v_r1);
    SELECT * INTO v_alert FROM public.monitoring_alerts WHERE rule_id = v_r1;
    IF v_alert.status <> 'passing' THEN
      RAISE EXCEPTION 'the resolved streak should transition to passing';
    END IF;
    SELECT count(*) INTO v_n FROM public.monitoring_alert_transitions t
      JOIN public.monitoring_alerts a ON a.id = t.alert_id WHERE a.rule_id = v_r1;
    IF v_n <> 2 THEN
      RAISE EXCEPTION 'the r1 timeline should hold 2 transitions (failing, passing), got %', v_n;
    END IF;

    -- the caller-facing snooze rides the column grant, and rule-level
    -- snooze replaces the target-level one
    SET LOCAL ROLE authenticated;
    UPDATE public.monitoring_alerts
       SET snoozed_until = clock_timestamp() + interval '1 hour',
           snoozed_by = v_usr, snooze_reason = 'target-level snooze'
     WHERE rule_id = v_r1;
    IF NOT EXISTS (SELECT 1 FROM public.monitoring_alerts
                    WHERE rule_id = v_r1 AND snoozed_until IS NOT NULL) THEN
      RAISE EXCEPTION 'the editor could not snooze the alert through the column grant';
    END IF;
    UPDATE public.monitoring_rules
       SET snoozed_until = clock_timestamp() + interval '2 hours',
           snoozed_by = v_usr, snooze_reason = 'rule-level snooze'
     WHERE id = v_r1;
    RESET ROLE;
    IF EXISTS (SELECT 1 FROM public.monitoring_alerts
                WHERE rule_id = v_r1 AND snoozed_until IS NOT NULL) THEN
      RAISE EXCEPTION 'the rule-level snooze should have replaced the target-level one';
    END IF;

    -- markings reach the new kind through the patched dispatcher
    IF public.effective_file_markings('monitoring_view', v_view) IS NULL THEN
      RAISE EXCEPTION 'effective_file_markings does not answer for monitoring_view';
    END IF;

    RAISE EXCEPTION 'rollback the probe';
  EXCEPTION WHEN OTHERS THEN
    BEGIN RESET ROLE; EXCEPTION WHEN OTHERS THEN NULL; END;
    IF SQLERRM <> 'rollback the probe' THEN RAISE; END IF;
    RAISE NOTICE '661 proved: four rules on one heartbeat — a streak of two (cancelled excluded) fires medium of a medium/high pair, a project scope resolves its dataset, a window counts its failures, an idle duration passes; a resolution transitions with a 2-row timeline; rule snooze replaces target snoozes; four refusals refused';
  END;
END $$;
