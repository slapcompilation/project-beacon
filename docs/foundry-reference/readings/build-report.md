---
verify: strict
---

# The build report — the page a build gets

**Pages read in full: 3** — `data-integration/application-reference` (the
Builds application's own paragraph), `data-integration/builds` (the job states,
the lifecycle and the live-logs section), and
`building-pipelines/create-batch-pipeline-pb` for the sentence its capture
carries. `readings/builds-and-schedules.md` is the *engine* reading for this
layer — three nouns, job states, the trigger grammar — and it does not read the
screen; this does, the way `dataset-preview.md` did for the dataset view.

**Captures, counted: these pages reference 7 and I opened 3** —
`data-integration/images/builds.png` (the report, four jobs, 2022),
`building-pipelines/images/build-progress.png` (the same report with one job,
waiting for resources, 2022) and
`data-integration/images/live-logs-build-page.png` (the 2024 report with the log
viewer open). **The four I did not open, named:**
`live-logs-overview.png`, `live-logs-color-coding.png`, `live-logs-json.png`,
`live-logs-pause.png` — every one a detail of the log viewer, which has no
engine here (no `job_logs` table exists, and none is planned in this pass), so
opening them would refine a gap rather than inform the build. The earlier
surface-map pass listed all four as skipped *while calling the log viewer a
large gap*, which its refuter fairly objected to; naming the reason is the
difference.

---

## 1. What the application is

> "**Builds application** — formerly called Job Tracker — allows you to view all [builds](/docs/foundry/data-integration/builds/) occurring across Foundry and explore details about each build, including information about execution progress, scheduling, and past success and failure rates."
— data-integration/application-reference.md

Three things in one sentence: **all builds**, **details about each**, and **past
success and failure rates**. The first is a list with no capture anywhere in the
mirror; the second is the report below; the third is the schedule card's
`RECENT RUNS`.

## 2. The report's four regions

> Header: a breadcrumb `Builds › Build of: 🗒 region and 3 more`; at the right `Explore lineage` with a lineage glyph, `View actions`, an outlined `⊖ Cancel build`, and a three-count pill `⟳ 0 | ✓ 10 | ✗ 6`.
> — data-integration/images/builds.png

> The single-job case names the dataset alone: `Builds › Build of: 🗒 Flight Alerts data`, and its pill reads `⟳ 1 | ✓ 0 | ✗ 0`.
> — building-pipelines/images/build-progress.png

**The pill is not this build's job counts.** In `builds.png` the build is
Running over four jobs and the pill's first number is `0`; in
`build-progress.png` a Running build with one job shows `1`. A number that is 0
while four jobs run cannot be counting them. It is the same pill the dataset
view and Data Health wear, and no page explains it — recorded as unattested
here and in `SURFACE-BUILD-MAP.md` §1, now with the evidence that rules out the
obvious reading.

> Left column `Build info`, eight rows: `Status ⟳ Running` with a spinner glyph, `Duration 5m 15s`, `Estimated ⓘ 23m 53s`, `Started Today at 7:31 PM`, `Ended --`, `Started by Build schedule`, `Progress 0 of 4 jobs succeeded`, and `Build ID 336-d8408bc42127` in a read-only field with a copy glyph.
> — data-integration/images/builds.png

> With no history the estimate is absent rather than zero: `Estimated ⓘ --`.
> — building-pipelines/images/build-progress.png

**Status is title-case on this screen** — `Running` — where the API's token is
`RUNNING`. That is the two-vocabularies rule of CLAUDE.md showing up in a
capture: the ledger takes the API's words, the screen takes the prose's.

> Beneath it a `Build schedule` card: the schedule's name in bold (`Ontology`), a `WHEN TO BUILD` heading, the sentence "This schedule will run when **any** of the following occur:" and then one chip per trigger dataset — `government_restriction_daily…`, `covid_daily_status (master)`, `geozone (master)`.
> — data-integration/images/builds.png

> The 2024 card is the same shape with a time trigger and three additions: the sentence reads "This schedule will run:" over a single chip `🕐 Every 5 minutes (Europe/P…)`; a `RECENT RUNS` row of ten dots (nine green, the tenth amber and ringed); `Last modified 6 months ago by <user>`; and two buttons, `📈 Metrics` and `📅 Schedule`.
> — data-integration/images/live-logs-build-page.png

## 3. Build progress, and the legend that gained a colour

> Right pane headed `Build progress` with two toggles — `Gantt chart` on, `Progress details` off — then a `▼ Job status` filter button and a `🔍 Dataset path…` search.
> — data-integration/images/builds.png

> The Gantt draws one row per output dataset (`region`, `world`, `subregion`, `country`) as a blue bar over a time axis running 07:31:03 PM to 07:36:00 PM, dated `May 3, 2022` beneath.
> — data-integration/images/builds.png

> The legend under it, five entries: `Queued` (grey) · `Running` (blue) · `Succeeded` (green) · `Failed` (red) · `Canceled` (grey).
> — data-integration/images/builds.png

> The 2024 legend has six, a purple `Waiting` between Queued and Running, and the toggles have become a segmented control `Job status | Progress details | Critical path ⓘ` with `⌘K` in the path search.
> — data-integration/images/live-logs-build-page.png

**This legend is the display vocabulary for a job**, and it is neither of the two
sets `builds-and-schedules.md` records. The prose tokens are `WAITING
RUN_PENDING RUNNING ABORT_PENDING ABORTED FAILED COMPLETED`; the API's are
`WAITING RUNNING SUCCEEDED FAILED CANCELED DID_NOT_RUN`. The legend is the
API's five, title-cased, plus `Queued` — and the 2024 capture separates `Queued`
from `Waiting`, which the earlier one did not.

## 4. The Datasets table, and what a row expands to

> Below the Gantt a table with four sortable headers — `Datasets | Start time ▲ | Duration ⇅ | Status ⇅` — and two controls at the row's right, `☰ Logs` and `Actions ▾`.
> — data-integration/images/builds.png

> A row: the dataset's name as a link (`region`) with its full path underlined beneath (`/datasources/notional/pipeline/data/ontology/region`); `Today at 7:31 PM`; `5m 10s` over a grey second line `Typically 19m 5`; and in Status a part-filled progress bar over the words `Running stage 9 of 14…`.
> — data-integration/images/builds.png

> Where the job has no history that second line reads `No previous runs`, and the Status bar is a striped indeterminate one over `Waiting for resources`.
> — building-pipelines/images/build-progress.png

> The row expands to `Job type: Transforms (python-1)` and a four-step timeline: `Started job / Today at 7:31 PM / (3s)` with a green tick, `Waited for resources / Today at 7:31 PM / (34s)` with a green tick, `Running / Today at 7:31 PM / (4m 36s)` with a blue spinner and a `Spark details` button, and `Finished / ETA: Today at 7:51 PM` with a grey `?`.
> — data-integration/images/builds.png

> The timeline shows only the steps reached: a job still queued draws two — `Started job (3s)` ticked, then `Waiting for resources (2m 28s)` with a purple `⋯` — and nothing after.
> — building-pipelines/images/build-progress.png

## 5. The log viewer, which has no engine here

> "You can access live logs through the Builds application. Select the **View live** button in the top right corner of the log viewer when viewing a job to start generating."
— data-integration/builds.md

> The 2024 report puts the viewer where the Gantt was: a `Logs` tab with a `Wrap lines` toggle, the dataset chip `issues_inbox_view ✕` and `⬇ Download logs ▾`; below them two datetime bounds, a `Filter logs` box, `Columns ▾` and `View live`; then a table whose columns are `level` (an `INFO` badge), `time`, `message`, `params`, `unsafeParams`, `origin`, each cell carrying a `⋯`; and a `Collapse ^` at the foot, with `Build progress` pushed beneath it.
> — data-integration/images/live-logs-build-page.png

Nothing stores a log line here, so none of this is built. Recorded, with the
four unopened captures named in the header.

## What the images add that the prose does not

- Every one of the eight `Build info` rows, and that `Estimated` is `--` rather
  than `0` when there is no history (§2).
- That the schedule card carries `RECENT RUNS`, `Last modified … by` and two
  buttons in the newer era, and a trigger sentence that changes with the
  trigger kind — the any-of-the-following form for datasets, the bare
  will-run form for a cron, both quoted in §2.
- The Gantt's shape, its axis, and **both** legends — the five-entry one and the
  six-entry one that separates `Waiting` from `Queued` (§3).
- The Datasets row's second lines: `Typically 19m 5` and `No previous runs` (§4).
- That the per-job timeline truncates at the step reached (§4).
- That the header pill cannot be this build's job counts (§2).

## Connects to

- `readings/builds-and-schedules.md` — the engine: 493's `builds` and
  `build_jobs`, 495's `schedules` and `schedule_runs`, 506's `schedule_id` and
  `abort_on_failure`, 507's `job_blocked_by`.
- `readings/dataset-preview.md` §3 — the dataset's History tab is the same job
  seen from its output; `build_jobs.transaction_id` is the join.
- `SURFACE-BUILD-MAP.md` §3.2, which this reading is the source for.

## Decisions (2026-09-16 — NOT YET READ BY A HUMAN)

1. **The report is a page at `/builds/:id`**, and `/builds` stays the list the
   application's own sentence describes ("view all builds occurring across
   Foundry"). The list has no capture in the mirror; it keeps the shape it has.
2. **Status renders title-case** (`Running`, `Succeeded`, `Canceled`) because
   that is what the screen shows, while `builds.status` keeps the API tokens.
   The same fold the dataset view's Summary cards already do.
3. **The job legend is the six-entry one**, the newer capture's, mapped from our
   seven prose tokens: `WAITING` → `Queued`, `RUN_PENDING` → `Waiting`,
   `RUNNING` → `Running`, `COMPLETED` → `Succeeded`, `FAILED` → `Failed`,
   `ABORTED` and `ABORT_PENDING` → `Canceled`.
4. **`Typically <median>` is computed, not stored**: the median duration of
   completed jobs of the same `job_spec_id`, with `No previous runs` when there
   are none — which is exactly the pair the two captures show. It needs no
   migration.
5. **`Estimated` is not built.** It is an ETA projection over a running job, and
   the only honest input we have is the same median — which is already printed
   on the row. A second number derived from the first would look like a
   forecast and be a restatement.
6. **The per-job timeline draws the steps our columns support** — `Started job`
   and `Finished`, with `Running` between them while the job is live — and
   **invents no `Waited for resources` step**, because nothing here records a
   resource wait. 507's `job_blocked_by` records a *different* wait (a build
   rewriting this job's inputs) and is recorded as its own line, not folded in.
7. **Not built, each for want of an engine:** the log viewer whole,
   `Spark details`, `Cancel build`, `Actions ▾`, `Progress details`,
   `Critical path`, `Metrics` on the schedule card, and the header pill.

## Questions

1. **What does the pill count?** Ruled out as this build's jobs (§2). It is on
   four screens now and explained on none.
2. **What is `Queued` against `Waiting`?** The 2024 legend separates them; the
   prose's job states have `WAITING` and `RUN_PENDING` and never name which is
   which. Decision 3 maps them in the order the two lists appear, which is an
   inference.
3. **Does `Progress details` replace the Gantt or annotate it?** Both captures
   have it off, and no page describes it.
4. **Is the builds list per-user or platform-wide?** "all builds occurring
   across Foundry" reads platform-wide; our read policy is organisation-scoped
   for a stated reason, and no page settles who may view a build.
