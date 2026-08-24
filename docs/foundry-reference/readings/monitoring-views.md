---
verify: strict
---

# Monitoring views

The successor the check-groups page names — data-health's Decision 7 sent me
here. Where a health check watches one dataset's data, a monitoring view is a
subscription product: rules over scopes of resources, alerts routed by
severity, and a filesystem resource to hold them.

**What I read, counted rather than asserted.** All seven pages of
`monitoring-views/`: `overview` (147), `core-concepts` (25), `rules-reference`
(423, every rule table), `alert-debug-page` (67), `external-systems` (119),
`monitoring-faq` (23), `check-groups` (165 — the Sunset page, read whole so
its exclusion is a reading, not a guess).

**Images: seven of fourteen parsed** — `data-health-add-monitoring-rule.png`,
`troubleshoot-alerts.png`, `snooze-monitor-alert.png`,
`snooze-monitor-alert-hover-details.png`, `run-history-redirect.png`,
`alert-debug-page-overview.png`, `alert-debug-condition-breakdown.png` — the
seven of the live product. The seven I skipped, named: `create-group.png`,
`check-groups.png`, `checkgroup-manage-permissions.png`, `cga-overview.png`,
`cga-actions-toolbar.png`, `cga-snoozing-checks.png`, `cga-context-panel.png`
— all on the check-groups page, whose own banner sunsets the product they
capture.

## 1. What the product is

> "Monitoring views are a collection of monitoring rules and health checks."

— `monitoring-views/overview.md`

It lives inside the same application our 660 surface just built:

> "To create a new monitoring view, navigate to the **Monitoring View** tab in the top right corner of the **Data Health** application and select **New monitoring view**."

— `monitoring-views/overview.md`

And it is not a dataset appendage the way a health check is:

> "Monitoring views are filesystem resources. If you are creating a new monitoring view, be sure to store it in a project accessible to potential subscribers."

— `monitoring-views/overview.md`

The captures confirm the filesystem placement: the view's breadcrumb reads
`Dataset > Notional monitoring view` with a favourite star and a File menu
(`monitoring-views/images/troubleshoot-alerts.png`), and the view has three
tabs — Troubleshoot alerts, Manage monitors, Manage subscriptions — behind an
"All monitoring views" back link, with an "Alert summary" of three colored
dot-counts, red/orange/blue (`monitoring-views/images/troubleshoot-alerts.png`).

## 2. Core grammar: metric, resource, scope, rule, view, subscriber

`core-concepts` defines the ladder. The definition that separates this
product from health checks is the scope:

> "**Static scopes** monitor a fixed resource that you explicitly select"

— `monitoring-views/core-concepts.md`

with `Single` its only member, against the dynamic ones:

> "**Dynamic scopes** automatically update as resources are added or removed, without requiring manual changes to the monitor"

— `monitoring-views/core-concepts.md`

`Folder` is direct children only —

> "**Folder:** The monitor is applied to resources of the specified type in the scoped folder, not including subfolders."

— `monitoring-views/core-concepts.md`

— and `Project` spans "the project or multiple projects". Three more dynamic
scopes exist only for function and action monitors: Workflow Lineage,
Workshop, OSDK application. The FAQ states why dynamic scope is the point:

> "Monitors cover an entire scope rather than a single resource. This means that when an additional resource is added to that scope, it is automatically covered by the rule."

— `monitoring-views/monitoring-faq.md`

A view is an audience artifact:

> "**Monitoring view:** A collection of monitoring rules that a group of subscribers care about."

— `monitoring-views/core-concepts.md`

**A vocabulary trap, twice on one capture.** The wizard's scope menu names the
prose's `Workshop` scope "Workshop module" and the prose's `OSDK application`
scope "Developer Console application"
(`monitoring-views/images/data-health-add-monitoring-rule.png`) — the same
UI-versus-prose split as the build/job tokens. The same capture shows the
wizard's four steps in a left rail: Select scope, Configure monitors, Select
monitoring view, Summary
(`monitoring-views/images/data-health-add-monitoring-rule.png`).

## 3. Severity is the routing key, and a rule holds one condition PER severity

Monitors have their own three-valued severity — not the checks' two:

> "You can also determine the level of severity for the alert: low, medium, and high."

— `monitoring-views/overview.md`

> "Severity acts as a routing mechanism: in-Foundry notifications and each external integration are configured against a specific severity level, and only alerts matching that severity trigger the integration."

— `monitoring-views/core-concepts.md`

The reference's defaults keep pairing thresholds with severities — "The
default behavior for this monitor is to alert with medium severity at one
failure and high severity at three failures, though these thresholds are
highly dependent on the frequency and stability of the schedules that are
included in the monitoring rule's scope." (`monitoring-views/rules-reference.md`,
consecutive schedule failures) — and the debug page's condition popover makes
the shape explicit: "CONDITION — High if value is greater than 1, Medium if
value is greater than 0"
(`monitoring-views/images/alert-debug-condition-breakdown.png`). **A rule is a
set of (severity, threshold) conditions over one metric**, and an alert fires
at the highest severity whose condition holds.

## 4. The rules catalogue, sorted by what our ledgers can answer

Eleven resource families in `rules-reference`. Sorted against our catalog
(probed 2026-08-24: `schedules`+`schedule_runs` 495, `builds`+`build_jobs`
493, `automations` 517 + `automation_events` 622, `functions` 501 with **no
run ledger**, actions with **no execution ledger**):

**Answerable today:**
- **Schedule rules** — consecutive failures (which "does not count schedule
  runs that result in a cancelled build" — `monitoring-views/rules-reference.md`)
  and schedule duration.
- **Dataset rule** — time since job last succeeded:

> "Alerts when a job on a dataset has not succeeded within a specified time threshold."

— `monitoring-views/rules-reference.md`

  with two stated always-passing conditions distinguishing it from the
  freshness *check*: "The job succeeded, but the transaction was aborted" and
  "The job succeeded, but no new data was added"
  (`monitoring-views/rules-reference.md`).
- ~~**Object and link rules** — sync-jobs-failing over consecutive index-build
  failures; our 643/644 repair and replacement pipelines are the analogue of
  the active/replacement pipeline pair the page names.~~ **Corrected while
  building 661**: I called this answerable without probing the ledger.
  `object_type_indexes` (442) is a current-status scalar — one row per type,
  no run history — so consecutive failures cannot be counted. Object and link
  rules join the blocked tranche until an index-run ledger exists.
- **Automation rules** — no new evaluations, no new triggers, repeated
  execution/evaluation failures in a window, and

> "Alerts if an automation was disabled by the system due to reaching limits or triggering cycles. This rule is non-configurable, alerting with high severity when the automation is disabled."

— `monitoring-views/rules-reference.md`

**Second tranche, blocked on a ledger that does not exist:** function rules
(duration p95 — "The p95 is measured over a sliding window of recent data." —
`monitoring-views/rules-reference.md` — and the three failure-count rules
split by user-facing) and action rules (same pair). Building the rule before
the run ledger would be an engine nothing feeds.

**Not ours:** agent rules (data-connection agents — JVM heap, keystore
certificates), streaming datasets, live deployments, time series syncs,
geotemporal observations — products we do not have.

The FAQ's division of labour keeps 659 honest — the content, freshness and
schema checks stay checks:

> "**Dataset-level checks that only exist as health checks:** Content, freshness, and schema checks; data expectations; Object Storage v1 (Phonograph) and `foundry-sync` checks."

— `monitoring-views/monitoring-faq.md`

## 5. Alerts: fire, resolve, history, snooze

Alerts are stateful, not point events. The debug page renders their lifecycle:

> "The alert history section displays a timeline of monitor status transitions for this rule over the past 30 days."

— `monitoring-views/alert-debug-page.md`

The history capture alternates `Failing High` and `Passing` badges with
timestamps; the metrics card prints "Current value / Threshold" as `3 / 1`
with the window duration beside it, and the Executions chart draws
success/failure stacked bars against a dashed threshold line whose legend
carries the function version and failure type — "Failure, runtime_error,
1.7.1" (`monitoring-views/images/alert-debug-page-overview.png`). The
troubleshoot list marks each row `Monitor` or `Check` — both products in one
list — and its REPORTED column ages alerts as "Since 14 days ago"
(`monitoring-views/images/snooze-monitor-alert-hover-details.png`).

Snoozing exists at two levels, both platform-wide rather than per-user. The
dialog: "Suspend monitor alert notifications for all users until…"
(`monitoring-views/images/snooze-monitor-alert.png`), a required reason, and
its own warning that monitor snoozes outlive re-fires; the prose states the
divergence from checks:

> "Unlike health check alerts, snoozed monitor alerts remain snoozed even if they re-fire. You must wait for the snooze to expire or manually un-snooze to resume notifications."

— `monitoring-views/overview.md`

And rule-level snooze subsumes:

> "When you snooze a monitor rule, any existing target-level snoozes for that rule will be replaced by the new rule-level snooze."

— `monitoring-views/overview.md`

The snoozed row's bell carries who/when/why on hover
(`monitoring-views/images/snooze-monitor-alert-hover-details.png`), and a
"Hide snoozed alerts" toggle banners the hidden count
(`monitoring-views/images/run-history-redirect.png`).

## 6. Subscribers and permissions

> "You can add users and user groups, and configure their alerts based on severity."

— `monitoring-views/overview.md`

Visibility composes two permissions — the view's location and the resources:

> "Even if a user with all necessary permissions subscribes a user or group to a monitoring view, those new subscribers will not receive alerts on any resources if they do not have explicit access permissions to that monitoring view."

— `monitoring-views/monitoring-faq.md`

> "You must have `Viewer` permission on the resources to monitor them."

— `monitoring-views/overview.md`

## 7. What stays out, each with its page's own reason

- **Email, PagerDuty, Slack, webhooks** (`external-systems` whole): the
  in-platform notification system we do not have, plus external egress. The
  Slack section's exportable-markings dance is a Data Connection feature.
  Subscribers are still worth storing — they are the audience the alert
  summary and a future notification system read, exactly as 659's watchers.
- **Check groups**: the page's own Sunset banner; read whole, nothing built.
- **The alert debug page**: "The alert debug page only provides detailed
  diagnostics for function and action type resources."
  (`monitoring-views/alert-debug-page.md`) — both second-tranche resources
  here, so the page waits for them. Its SOP card also hangs off Notepad,
  a product we do not build.
- **Lineage redirects and pre-filtered run history**: need Workflow Lineage.
- **The ontology project-scope precondition** (migrate-to-project-based
  permissions) does not bind us — our ontology resources already live in
  projects.

## Decisions

1. **A monitoring view is a filesystem resource**: `monitoring_views` rows
   with a compass location (project or folder), permissions from that
   location like every other resource, and a RID. The grammar
   `ri.data-health.main.monitoring-view.<uuid>` is inference — no page or
   capture prints a view RID; the service segment follows the check's.
2. **A rule is (resource_type, scope, metric, conditions)**:
   `monitoring_rules` in a view carrying resource_type from the families we
   can answer, scope_kind `single | folder | project` (static single names a
   resource; folder is direct children only; project spans projects), and
   **one condition per severity** — `(severity, threshold)` pairs over one
   comparator, the popover's shape, evaluated highest-first. Severity is the
   monitors' own three-valued set `low | medium | high`, declared from
   overview.md — distinct from the checks' moderate/critical, both stay.
3. **First tranche of rule families**: schedule (consecutive failures
   excluding cancelled, duration), dataset (time since job last succeeded
   with the two always-pass conditions), automation (no new triggers and
   windowed evaluation failures — 661's probe corrected the rest: successful
   evaluations and effect executions are not events `automation_events`
   records, and no system-disable mechanism exists). Object/link, function
   and action rules wait for a run ledger — a rule before its ledger is an
   engine nothing feeds.
4. **Alerts are stateful per (rule, target)**: `monitoring_alerts` fire and
   resolve as the condition starts and stops holding, with a transition
   history (the debug page's 30-day timeline) and the firing severity.
   Snooze is platform-wide with a required reason and an until-timestamp, at
   alert level (persists across re-fires, the stated divergence from checks)
   and rule level (replaces target-level snoozes).
5. **Subscribers are rows** (user or group, per-severity routing), the same
   pattern as 659's watchers one level up. They power the subscriptions tab
   and the alert summary; email and external systems stay the recorded
   residual.
6. **Evaluation rides the existing heartbeat family**: dynamic scopes resolve
   to members at evaluation time (the FAQ's automatically-covered), on the
   same pg_cron cadence as `run_health_checks`.
7. **The surface is the Monitoring View tab of /data-health**: view list, the
   three tabs (Troubleshoot alerts with the Monitor/Check merge, alert
   summary dots, snooze; Manage monitors; Manage subscriptions), as its own
   PR after the engine. The four-step creation wizard collapses to a form —
   scope, monitors, view, the capture's order.

## Questions

1. **What clock does a monitor evaluate on?** No page states the evaluation
   frequency of monitoring rules — only checks got the automatic/manual
   grammar. Ours: the per-minute heartbeat, the only clock we have.
   `blocks: nothing.`
2. **Is an alert keyed by rule-and-target or per firing?** The debug page's
   "on createCampaignUsingCode since 5 minutes ago" header
   (`monitoring-views/images/alert-debug-page-overview.png`) and the history
   timeline imply one stateful alert per (rule, target) that transitions;
   nothing states it outright. Ours: one row per (rule, target), history in a
   second table. `blocks: nothing.`
3. **The p95 sliding window length** is unstated ("recent data"). Second
   tranche anyway. `blocks: nothing.`
4. **Does a view's own location gate subscribing or only receiving?** The FAQ
   says subscribers without view access receive nothing; whether subscribing
   itself is refused is unstated. Ours: subscribing requires seeing the view.
   `blocks: nothing.`
