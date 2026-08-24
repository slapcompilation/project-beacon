---
verify: strict
---

# Data Health

The gap sweep's largest find: a fully enumerated product with zero presence
here. Health checks watch datasets and schedules for the failures nobody
notices until a consumer does — stale data, shrunken row counts, schema
drift — and the whole grammar is published: the check types, their rule
components, the evaluation clock, the severity ladder, even the deviation
formula.

**What I read, counted rather than asserted.** All eleven pages of
`data-health/`: `overview` (52), `check-types` (44), `check-evaluation` (34),
`checks-reference` (416, the whole table and every rule-component row),
`watching-checks` (36), `notifications` (35), `check-groups-overview` (165 —
`create-watch-check-group` and `view-check-group` are byte-identical copies
of it, verified by diff), `builds-checks-faq` (227 — read whole; it is Spark
operational troubleshooting, salted joins and shrinkwrap files, and touches
nothing we build), `marketplace-data-health` (21). The **`health-checks/`
section is a byte-identical duplicate** of eight of these pages — the
seventh double-mirrored slug set, and this time a whole section.

**Images: four of fifteen parsed** — `health-checks-overview.png`,
`one-hour-check.png`, `Manual-checks.png`, `watching-individual-checks.png`,
the four carrying the app, the rule editor and the schedule and watch
grammars. Not parsed, named: `notifications.png`, `notification-settings.png`,
`issues.png`, `enabling-issues.png` (the notification/issue integrations §6
rules out), `create-group.png`, `check-groups.png`,
`checkgroup-manage-permissions.png`, `cga-overview.png`,
`cga-actions-toolbar.png`, `cga-snoozing-checks.png`, `cga-context-panel.png`
(the sunset check-groups UI), `shrinkwrap@2x.png` (the FAQ's Spark file).
One referenced image is **missing from the mirror**: `watch-alerts.png`
(`watching-checks.md` line 11) — its content is restated by the prose list
beneath it.

## 1. What the product is

> "Health checks enable monitoring and alerting on common issues across datasets and other resource types. You can monitor for potential issues related to dataset status, time, size, content, and schema using customizable checks. When problems are detected, you will receive in-platform notifications and emails alerting you to the issue."

— `data-health/overview.md`

Checks attach to **Datasets, Schedules and Tables**; the surface is a
**Health tab** on the resource plus a platform-wide **Data Health**
application ("filter or sort datasets by their status or name… toggle to
show only the datasets that you are watching"). This is monitoring of
DATA, not of definitions — `ontology_violations()` is a different product.

## 2. The twenty-seven check types, five families

`checks-reference` opens with the whole set as a table: **Status** (Schedule
status, Build status, Job status, Sync status), **Time** (Build duration,
Data freshness, Sync duration, Sync freshness, Time since last updated, Time
since sync last updated), **Size** (Dataset file count, Dataset partition,
Row count, Transaction file count, Transaction file size), **Content**
(Allowed column values, Approximate unique percentage, Column regex,
Approximate column relation, Date range, Null percentage, Numeric mean,
Numeric median, Numeric range, Primary key), **Schema** (Column, Column
count, Schema). Some also support Iceberg and Virtual tables — resource
kinds we do not have.

Every check's configuration is a **rule-component table** — column name,
threshold ("Between, Greater than or equal to, Less than or equal to, Equal
to" over days/minutes/hours or counts), severity, notes, the issues flag —
and two components recur enough to be mechanisms of their own:

- **Median deviation**, defined exactly:

> "Since dataset builds can easily have outliers, we do not use the true standard deviation. Instead, we use the median absolute deviation (MAD) which is a more robust measure of variability."

— `data-health/checks-reference.md`

  with the constant published: "Our calculation is `σ = MAD * 1.4826`."

- **Escalate**: "Whether to escalate severity after consecutive failures" —
  on the status checks.

The **Schema check** carries its own four-token comparison vocabulary,
enumerated with meanings: `EXACT_MATCH_ORDERED_COLUMNS`,
`EXACT_MATCH_UNORDERED_COLUMNS`, `COLUMN_ADDITIONS_ALLOWED`,
`COLUMN_ADDITIONS_ALLOWED_STRICT` ("whenever a new column is added to the
dataset, that column is added to the check").

Distinctions that matter for evaluators: job status runs "for each and every
build of a particular dataset", while a build duration or status check
updates only for the build's terminal output; the three freshness
checks differ by clock
(transaction time vs a timestamp column's max vs a sync's time); the
**Dataset partition** check is a Spark storage heuristic ("If there are 50
or more files in total, the check passes if at least 90% of the files are
more than 96MB in size") with no analogue in our storage.

## 3. The evaluation clock

> "Time-based checks can be configured to evaluate either automatically or on a manual schedule."

— `data-health/check-evaluation.md`

Automatic means two triggers: "When a dataset is updated" and "When a
dataset passes the threshold you have configured" — and the update resets
the threshold timer ("adding the time threshold minimum to the current
time"; the page walks a 58-minute pass and a 62-minute fail). Manual
schedules run "by minute, hourly, daily, weekly, or on a custom schedule";
the capture's picker enumerates the intervals — 5, 10, 30 minutes, Hour, 2
hours, 6 hours, Day — plus weekly day-of-week with a time and timezone
(`data-health/images/Manual-checks.png`).

## 4. Severity, watching, pausing

Severity is two-valued — **Moderate, Critical** — with the guidance that
critical bounds should be looser. Watch levels are three:

> "**Nothing** will never notify you of a failure, regardless of severity."

— `data-health/watching-checks.md`

plus **All failures** and **Only critical**; the capture adds a fourth menu
entry, "Subscribe others to watch…"
(`data-health/images/watching-individual-checks.png`). **Pausing** "will
temporarily snooze its alerts for all watching/subscribed users"; deleting
removes configuration and schedule.

## 5. What the app capture shows

`health-checks-overview.png`: the dataset's **Health** tab (marked Beta)
lists checks with count chips by state, and each row carries the check type
with its **column as a chip**, a STATUS that shows the measured value
("2m 13s", "0%", "Left: 100, Right: 100", "String") or Passed/Failed — and
one row shows a bare **Error** state, a third result kind beside pass and
fail. Each row has a REPORTED AT, a MONITORING VIEW column, and a
HISTORY REPORTS dot-strip of recent results. The right rail details one
check: Watch dropdown, description, a monitoring-views line reading
"Not included in any monitoring views"
(`data-health/images/health-checks-overview.png`), Last run, and a **RID**
in the `ri.data-health.main.check…` grammar
(`data-health/images/health-checks-overview.png`). The rule editor draws a
threshold slider colored green into amber and "Edit severity" / "Edit
median" links (`data-health/images/one-hour-check.png`).

## 6. What stays out, each with its page's own reason

- **Check groups are sunset**: "no new check groups can be created. We
  recommend [migrating your check groups to monitoring views]" — the page's
  own lifecycle says do not build them. **Monitoring views** are the
  successor and a separate unread section (`monitoring-views/`, 7 pages) —
  the follow-on reading, and the MONITORING VIEW column above is its hook.
- **Notifications and emails** need the notification system this platform
  does not have (the recurring residual); the **Issues integration**
  ("Data Health will file an issue upon check failure… automatically close
  the issue once the check resolves") needs the Issues product we also lack.
  Watchers are still worth storing: the Data Health app filters by "datasets
  that you are watching", a consumer that exists without email.
- **Sync checks** (status/duration/freshness/time-since) monitor exports to
  external databases we do not run.
- **Dataset partition** is a Spark storage heuristic; our datasets are not
  parquet file layouts.
- **Iceberg and Virtual table variants** are resource kinds we lack.
- **Marketplace packaging** and the **FAQ**'s Spark operations.
- **Data expectations** (checks defined in transform code) belong to a
  transforms authoring layer we do not have; the page notes they are the
  build-abort path.

## Decisions

1. **Two tables**: `health_checks` — the target (dataset XOR schedule), a
   `check_type` from a function-valued set that admits ONLY types the
   evaluator executes (the emit-only rule; the reference's 27 are the
   ceiling and the spelling authority), a per-type `config` jsonb whose
   required fields are CHECKed per type (the audit-categories pattern), a
   two-valued severity, the escalate flag, notes, and the schedule mode
   (automatic, or an interval from the capture's enumeration). And
   `health_check_results` — one row per evaluation: status
   passed/failed/error (the capture's three), the measured value, the
   severity it failed at, reported_at. Results are the history strip.
2. **The first tranche of check types is the set our stores can answer
   today**, roughly: build status, job status, schedule status, build
   duration, time since last updated, data freshness, row count, dataset
   file count, transaction file count, allowed column values, column regex,
   null percentage, numeric mean/median/range, date range, primary key,
   unique percentage, column, column count, schema (with the four published
   comparison tokens). Excluded with reasons: the four sync checks, dataset
   partition, transaction file size (we do not store file sizes), and the
   approximate-column-relation cross-dataset check (second tranche).
   Content checks run against the dataset's physical table; the "approximate"
   in unique-percentage is Foundry's engine constraint — ours computes
   exactly, named as the page names it, noted.
3. **Evaluation lives where the page puts it**: an automatic path triggered
   by transaction commit (the dataset-updated trigger), a threshold timer
   and the manual intervals on the pg_cron heartbeat family, and the
   update-resets-the-threshold semantics from the worked example. Median
   deviation uses the published formula verbatim: MAD × 1.4826 over the
   configured number of recent builds.
4. **Watchers are rows** (user, check, level from the page's three), with
   pause as a timestamp; they power the watching filter now and become the
   notification audience if a notification system ever exists.
5. **Escalate is honoured**: consecutive failures raise Moderate to
   Critical, because the component is published on the status checks.
6. **The surface comes after the engine**, as its own PR: a Health tab on
   the dataset page with the capture's grammar (status with measured value,
   history dot-strip, watch menu) and the platform-wide Data Health listing.
   The check RID joins the `ri.data-health.main.check` grammar the capture
   shows.
7. **Monitoring views are the successor product and the next reading** —
   check groups are not built, on their own page's sunset instruction.

## Questions

1. **Does a failed automatic evaluation reschedule?** The worked example
   covers pass-then-reset and fail-at-threshold; whether a failing check
   re-fires on a timer until the dataset updates is unstated. Ours: the
   threshold fires once per crossing, and the next commit resets — the
   example's own arithmetic. `blocks: nothing.`
2. **What does Error mean as a result?** Only the capture shows it (a
   column regex over a missing column, plausibly). Ours: the evaluator
   recording its own failure to evaluate — config referencing a column the
   schema lost — distinct from the check failing. `blocks: nothing.`
3. **Row count "against the last successful check result"** — the reference
   mentions comparing to the previous passing check's count in one
   sentence. Second tranche, with difference-from-last-check on the numeric
   checks. `blocks: nothing.`
