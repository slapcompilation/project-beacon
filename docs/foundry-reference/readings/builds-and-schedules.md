---
verify: strict
---

# Builds and schedules — the pipeline layer

Pages read in full: `data-integration/builds.md`, `data-integration/schedules.md`,
`building-pipelines/triggers-reference.md`, `building-pipelines/create-schedule.md`,
`building-pipelines/common-schedules.md`.
Read because this is the largest structural absence left: `dataset_inputs`
declares derivation and nothing computes it.

Read in full, and **nothing below quotes it**: `transforms-python-spark/overview.md`.
Stated rather than trimmed — Spark and the JVM data stack are an explicit
non-goal (CLAUDE.md), so the page set the boundary and contributed no sentence
this build rests on.

## 1. The three nouns

From `data-integration/builds.md`:

> "A **Build** is the mechanism used to compute new versions of
> [datasets](/docs/foundry/data-integration/datasets/) in Foundry."

> "A build is composed of **jobs**, each of which is a unit of work that is
> defined by shared logic and computes one or more output datasets."

> "A job specification, or **JobSpec**, is a definition of how a job should
> be constructed. JobSpecs are published when changes are made to data
> transformation logic in Foundry"

> "Input dataset dependencies are declared as a set of *InputSpecs*, each of
> which specifies a particular input dataset."

And the third noun closes the loop:

> "Running a build results in a one-time computation of a set of output
> datasets. To keep data flowing through the system,
> [schedules](/docs/foundry/data-integration/schedules/) are used to run
> builds over time."

## 2. Job states and the build lifecycle

The seven job states, verbatim from the page's list: `WAITING`,
`RUN_PENDING`, `RUNNING`, `ABORT_PENDING`, `ABORTED`, `FAILED`, `COMPLETED`.
The lifecycle's resolution step, each clause load-bearing:

> "Detects cycles in the specified input datasets and fails the build if
> there are cycles present."

> "Opens new
> [transactions](/docs/foundry/data-integration/datasets/#transactions) on
> each output dataset to ensure that only the active build can write to the
> output dataset. This is known as *build locking*."

> "If a job in a build fails, all directly-dependent jobs and transactions on
> output datasets within that build will be terminated."

> "Note that if a job in a build fails, previously completed jobs may still
> have written data to their output datasets."

Staleness is the economy of the whole system:

> "An output dataset is considered *fresh* if the
> [build resolution](#build-resolution) step determines that input datasets
> and the logic specified within the JobSpec have not changed since the last
> time the output dataset was built. If an output dataset is fresh, it will
> not be recomputed in subsequent builds."

> "To override the build system's default staleness behavior, you can run a
> **force build**, which recomputes all datasets as part of the build,
> regardless of whether they are already up-to-date."

## 3. Schedules: trigger, run, history

From `data-integration/schedules.md`:

> "In a schedule, the **trigger** defines the condition that must be
> satisfied for the associated build to be run."

> "If a schedule is triggered while the previous run is still in action, then
> it will remain triggered and run only after the previous schedule is
> finished."

The run history's three outcomes are verbatim `Succeeded` / `Ignored` /
`Failed`, and Ignored is precise:

> "**Ignored**. The run was attempted, but a build was not created. An
> ignored run likely indicates that everything is up-to-date and there was no
> work to do."

Pausing resets observation:

> "When a schedule is paused, its trigger state is reset and all observed
> events are forgotten."

Scope is two modes, with the page's own reliability argument:

> "The former (user mode) is prone to unexpected changes if the permissions
> of the user change, since the schedule runs as if the user were running the
> build."

## 4. The trigger grammar

From `building-pipelines/triggers-reference.md`:

> "Foundry supports arbitrary nesting of `AND` and `OR` triggers, enabling
> the creation of specific customized triggers."

Time triggers are five-field Unix cron with a time zone; the allowed-values
table admits `*` `-` `/` `,` everywhere plus `L` and `#` in the day fields.
Wall-clock semantics are stated exactly:

> "If the time moves forward, a time trigger satisfied in between the time
> change will not be satisfied"

Event triggers hold until consumed:

> "An event trigger remains satisfied after the event has occurred until the
> entire trigger is satisfied and the schedule is run."

The four event types, verbatim names: **New logic**, **Data updated**,
**Job succeeded**, **Schedule ran successfully** — with Data updated defined
as "Occurs when a transaction is committed that updates a dataset."

## 5. The schedule editor

From `building-pipelines/create-schedule.md`: the editor lives in Data
Lineage ("Manage Schedules" from the dataset's Actions menu), takes target
datasets marked on the graph, excluded datasets, the trigger (Any of / All
of / Advanced with `AND` `OR` and parentheses), a build type —

> "**Single build:** Build the target datasets (no other datasets will be
> built)."

> "**Full build (include upstream):** Build all target datasets and all
> upstream datasets of this target, except excluded datasets."

— a connecting build (between inputs and targets, with the worked D1…D7
branch example), the two build scopes (by Projects / by user account), and
advanced settings: abort on failure, retry attempts, force build, and
re-trigger upon successful build. `common-schedules.md` gives the four
canonical configurations, including the AND-of-time-and-event gotcha:

> "This means that if **Parent A** is consistently updating *after* 9 AM,
> e.g. at 9:10 AM every day, then **Dataset D** will be built daily at 9 AM,
> with data from **Parent A** that is 23 hours and 50 minutes old."

## Decisions I had to make (mine, not Palantir's, unless quoted)

1. **The logic is SQL, and Postgres stands in for Spark** — the exact
   precedent 442 set for indexing. A JobSpec's logic is one SQL SELECT over
   its declared inputs; Python/Spark transforms are the JVM stack CLAUDE.md
   rules out. Validation is a plan walk: EXPLAIN the query and refuse any
   base relation that is not a declared input's materialized table (ours).
2. **InputSpecs ARE `dataset_inputs`.** The rows already exist, already
   carry marking stops, already draw in Data Lineage. `job_specs` adds what
   is missing: the output dataset (one per JobSpec — multi-output jobs
   recorded), the logic, and a version that bumps on every logic change,
   which is what staleness compares.
3. **Two ledgers**: `builds` (status, branch, force flag, requester, scope)
   and `build_jobs` (the seven documented states, the opened transaction,
   the error). A job writes through a real transaction on the output —
   build locking is literally our open-transaction rule. Jobs run in
   dependency order, sequentially; parallel execution is recorded, not
   built. Dependent-abort on failure per the page; completed jobs keep
   their data, also per the page.
4. **Staleness compares two facts**: the inputs' latest committed
   transactions and the JobSpec version, against what the last successful
   job recorded. Fresh outputs are skipped; force builds everything; a
   scheduled run whose whole target set is fresh creates NO build and
   records `Ignored` — matching the page's "a build was not created".
5. **Slice B1** builds JobSpecs + builds + the engine + a Builds surface
   and a Build-now button. **Slice B2** builds schedules: the trigger
   grammar as jsonb (time with five-field cron + timezone, the four event
   types, arbitrary AND/OR nesting), a pg_cron heartbeat evaluating
   triggers each minute, run history with the three outcomes, pause
   resetting trigger state, and the Data Lineage schedules panel. Cron
   tokens `L` and `#` are recorded, not built, in B2's first pass.
6. **Scope**: project-scoped schedules preferred (the page's own
   reliability argument); user-scoped runs under the stored user via the
   claims-swap pattern 486 established. Build permission: creating a
   JobSpec or running a build takes the editor role on the output's
   project, same as writing the dataset.
7. **Recorded, not built**: connecting builds and excluded datasets,
   retry attempts, re-trigger on success, incremental transforms, live
   logs, multi-output jobs, Data Connection syncs and exports and health
   checks as job kinds (each names a system we do not have).

## Built (2026-08-13) — slice B1: migrations 493–494, PR #557

Decisions 1–4 shipped as recited, with three build-time findings:

- `run_build` is SECURITY INVOKER — forced by Postgres (SET ROLE is illegal
  in a definer function) and better for it: the logic executes with its
  author's own rights, so RLS bounds every input read and a transform can
  reach nothing its author could not already call by hand. The one
  privileged step, the physical-table swap, is a guarded definer helper.
- The plan-walk allowlist needed dataset_view's own plumbing
  (dataset_files/transactions/branches) — the CTEs inline it into the plan.
- dataset_view replays from the branch HEAD through parent_transaction_id:
  an APPEND without a parent silently orphans the chain (zero rows, no
  error). The engine was right; the first fixture lied.

## Built (2026-08-13) — slice B2: migrations 495–496, PR #558

Decision 5 shipped as recited: the trigger grammar as jsonb (five-field cron
with the four core tokens, L and # refused by name; the four event types
verbatim; arbitrary AND/OR nesting), the pg_cron minute hand carrying only
the heartbeat while every documented semantic lives in run_schedules where
it is testable, the three run outcomes with Ignored meaning a build was not
created, events sticky until the run consumes them, pause forgetting
everything observed, and the schedules panel on Data Lineage. Scope ships
user mode (the 486 claims swap); project mode is stored and recorded,
waiting on a service execution identity. The matcher implements the page's
odd dom/dow OR rule, asserted against the page's own example. Build-time
finds: schedule_runs.ran_at takes clock_timestamp (now() freezes inside one
transaction and unorders history), and the audit suite's cron-job check had
passed vacuously for its whole life — the first real cron job made its
regex actually parse, and it did not.

## Open questions

1. The plan-walk validation of logic SQL is entirely ours — if the operator
   knows how Foundry sandboxes SQL transforms (transforms-sql is unmirrored),
   that beats the inference.
2. "New logic" as an event trigger wants JobSpec-publication events; B2 can
   raise them from job_specs updates — confirm that reading of "the logic to
   compute a dataset is updated".
3. Does a build on a non-default branch write branch transactions the way
   our dataset branching already models? (I propose yes — the machinery
   exists; create-schedule's branch note supports it.)

---

# Addendum (2026-08-14) — the sentence B1 skipped, and what the screenshot says

Re-read `data-integration/builds.md` in full, plus its
`images/builds.png` (the Builds application), because the first reading
covered three of Build resolution's four bullets and silently dropped the
fourth.

## What the prose says

> "Detects if other builds are in progress that would change the inputs into
> the build. If so, the build may be *queued* and wait for the other build to
> complete."

— `data-integration/builds.md`, the **Build resolution** section.

That is the entire published account of build queuing. I grepped all 1,184
mirrored pages for `queued`: five other hits, none about builds (Data
Connection agent concurrency, a Slate browser-connection limit, a CDC
changelog backlog). **No build status vocabulary is published anywhere** —
the page enumerates the seven JOB states in caps and never lists build
statuses at all.

Note what the sentence is and is not. It is a **contention** rule: my build
waits because another build is rewriting *my inputs*, so proceeding would
read data that is about to change. It is **not** a work queue for capacity,
and it is not about how long a request may live. Our own reason for wanting
a queue — a build outliving the caller's HTTP request — is a substrate
problem that this mechanism happens to also solve, and the two must not be
confused in the design.

Also note what it does not say: not *will* be queued, but **may**. Foundry
leaves itself room; a build whose inputs are being rewritten is a risk, not
a certainty.

## What the image adds that the prose does not

`images/builds.png` — the Builds application, a build of `region and 3 more`:

- **Build info reads `Status: Running`** with a spinner icon. So build status
  is title-case display vocabulary in the UI, distinct from the `RUNNING`
  API token, and the page's silence on build statuses is a documentation
  gap rather than evidence there are none.
- **The Build progress legend names five**: `Queued · Running · Succeeded ·
  Failed · Canceled`. This is the Gantt chart of *jobs*, so these are the
  seven API job states rendered for humans — `Queued` covers `WAITING` and
  `RUN_PENDING`, `Succeeded` is `COMPLETED`, `Canceled` is `ABORTED`. **We
  need no new job state**; ours already carry the API tokens.
- **A per-job timeline**: `Started job (3s) → Waited for resources (34s) →
  Running (4m36s) → Finished`. So queueing happens at *two* levels in
  Foundry — the build waits on input contention, and a job waits on compute
  resources. The second is a Spark cluster fact and has no analogue here.
- **`Started by: Build schedule`** — a build records its origin, and the UI
  surfaces it. We store the reverse link only (`schedule_runs.build_id`).
- **`Progress: 0 of 4 jobs succeeded`**, **`Estimated 23m 53s`**, and per-job
  **`Typically 19m 5s`** — derived from job history, not stored state.
- **A `Cancel build` control**, which is the "aborted … upon user request"
  half of the `ABORTED` job state. We have the state and no way to reach it.

## Decisions (mine, not Palantir's, unless quoted)

1. **The queue is the builds table, not a message queue.** The sentence says
   "the build may be queued" — the build itself carries the waiting. A pgmq
   queue would hold a second copy of the fact `builds` already states, which
   is the parallel-system mistake this repo has made three times. **This
   reverses what I proposed to the operator** ("queue-backed builds,
   Supabase Queues") before reading the page.

2. **`builds.status` gains `QUEUED`.** *Inference on the token*: no build
   status vocabulary is published, and our existing four
   (`RUNNING/COMPLETED/FAILED/ABORTED`) were already derived from the job
   states. `QUEUED` continues that derivation and matches the UI's `Queued`.

3. **Contention is defined as: another build in `RUNNING` or `QUEUED` has an
   output dataset that is an input to mine.** Read straight off "other
   builds ... that would change the inputs into the build". Not
   output-output collision — that is *build locking*, which B1 already
   built with open transactions.

4. **`run_build` splits into resolution and execution.** Resolution keeps
   every B1 step (cycle detection, validation, permission, staleness) and
   ends by either executing immediately or leaving the build `QUEUED`.
   Callers keep the same signature and the same return, and in the
   uncontended case the behaviour is byte-identical to today.

5. **The existing minute hand drains it.** `run_schedules` already runs
   under pg_cron with the 486 claims swap; a queued build is executed the
   same way, as `builds.requested_by`, when its blocker is gone. No second
   cron entry, no worker process. *Inference*: Foundry drains its queue with
   infrastructure we do not have, and this is the substrate's equivalent —
   recorded in `substrate-reference` as an accommodation.

6. **Deadlock is refused, not waited on.** If two queued builds each block
   the other, nothing can drain. The drainer detects a cycle among blocked
   builds and fails them with a named error rather than leaving rows that
   never move. *Inference entirely* — the page says nothing about it, and I
   would rather fail loudly than build a state that can wedge.

7. **Recorded, not built**: `Cancel build` (needs an abort path through open
   transactions), `Started by` on the build row, and duration estimates from
   job history. Each is real and visible in the screenshot; none is needed
   to make queuing correct, and shipping them together would hide which
   part the operator is approving.

## Questions

1. **"may be queued" — under what condition is it *not*?** My reading queues
   whenever contention exists. If Foundry only queues when the contending
   build writes an input the job actually reads (InputSpec granularity, a
   subset of views), that is narrower than ours and I cannot tell from the
   page.
2. **Does a queued build re-evaluate staleness when it finally runs?** It
   must — the blocking build just changed its inputs, which is the whole
   point — but the page does not say, and the alternative (freezing the
   resolution taken at submit time) is defensible. I propose re-evaluating.
3. Does the operator's course material show the Builds application's queue,
   or a build sitting in `Queued`? One screenshot would settle both of the
   above.

---

# Addendum II (2026-08-14) — the API reference answers both questions, and falsifies a decision

The operator asked me to crawl rather than proceed on inference. The answers
were not in the prose corpus at all: `api/` was **unmirrored**, all 1,243
pages of it, because its pages carry no `pageProps.markdown`. They carry the
**spec** — request and response schemas, field descriptions and enums — at
`page.content.endpoint`. `scripts/mirror-foundry-docs.mjs` now renders that
shape, and `api/v2/orchestration-v2-resources` (28 pages) is mirrored.

**This is where Foundry publishes vocabulary the user documentation only
gestures at.** Every finding below is a quote from a mirrored page, not an
inference.

## Answer to Q1: there is no queued build status, because queuing is not a build status

> `status` · enum · required
> one of `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`
> "The status of the build."

— `api/v2/orchestration-v2-resources/builds-get-build.md`, the `Build` response.

Four values, and `QUEUED` is not among them. So **Decision 2 of Addendum I was
wrong**: adding a `QUEUED` build status would have invented a token that
contradicts the published API.

A queued build is `RUNNING`. The waiting lives one level down, on the job:

> `jobStatus` · enum · required
> one of `WAITING`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`, `DID_NOT_RUN`

and `startedTime` is documented as

> "The time this job started waiting for the dependencies to be resolved."

— `api/v2/orchestration-v2-resources/jobs-get-job.md`.

A job's clock starts when it begins **waiting**, and `WAITING` is a first-class
status. That is the same shape the Builds screenshot showed from the other
side: the Gantt legend's `Queued` is a *job* bar, and the per-job timeline
reads `Started job → Waited for resources → Running → Finished`.

**So the mechanism is smaller than I proposed and invents nothing**: a build
whose inputs another build is rewriting stays `RUNNING` with its jobs
`WAITING`. We already have `WAITING` in `build_jobs.state`.

## Answer to Q2: staleness is consulted when the build runs

`forceBuild` is documented as

> "Whether to ignore staleness information when running the build."

— `builds-create-build.md`, and identically in `schedules-create-schedule.md`,
`schedules-replace-schedule.md`, `schedules-get-schedule.md` and the two
schedule-version pages.

The phrase is **"when running the build"**, repeated verbatim in six places,
not "when creating" or "when submitting". A build that waits and then runs
consults staleness at the moment it runs. I proposed re-evaluating; the
wording supports it. *Not airtight* — no page states it for the queued case
specifically — but it is the reading the published field name carries.

`DID_NOT_RUN` is the corroboration: Foundry keeps a job row for a target it
decided not to compute. *Inference*: that is the fresh-and-skipped case.

## Three places our vocabulary is simply wrong

493 derived build statuses from the job states because no page published
them. The page exists; two of our four tokens are wrong, and so are both
build types.

| ours | published | source |
|---|---|---|
| `builds.status = 'COMPLETED'` | `SUCCEEDED` | `builds-get-build.md` |
| `builds.status = 'ABORTED'` | `CANCELED` | `builds-get-build.md` |
| `p_build_type = 'single'` | `manual` — "Manually specify all datasets to build." | `builds-create-build.md` |
| `p_build_type = 'full'` | `upstream` — "Target the specified datasets along with all upstream datasets except the ignored datasets." | `builds-create-build.md` |

`COMPLETED` and `ABORTED` are the *job* tokens from `data-integration/builds.md`.
Builds and jobs have **different vocabularies**, and we collapsed them.

`connecting`, which B1 recorded as "not built" for lack of a shape, is now
fully specified: "All datasets between the input datasets (exclusive) and the
target datasets (inclusive) except for the datasets to ignore", with
`inputRids`, `targetRids` and `ignoredRids`.

## What else the spec publishes that we do not have

Quotes, all from `builds-get-build.md` / `builds-create-build.md`:

- `abortOnFailure` — "If any job in the build is unsuccessful, immediately
  finish the build by cancelling all other jobs." This is the prose page's
  "Optionally, a build can be configured to abort all non-dependent jobs at
  the same time", as a real field.
- `retryCount` — "The number of retry attempts for failed Jobs within the
  Build. A Job's failure is not considered final until all retries have been
  attempted" — with `retryBackoffDuration` {value, unit}.
- `fallbackBranches` — "The branches to retrieve JobSpecs from if no JobSpec
  is found on the target branch."
- `scheduleRid` — "Schedule RID of the Schedule that triggered this build. If
  a user triggered the build, Schedule RID will be empty." This is the
  screenshot's `Started by: Build schedule`.
- `branchName`, `createdTime`, `createdBy`, `finishedTime`, `jobRids`.
- Cancel is asynchronous: "The build's status will not update immediately …
  the build is expected to be canceled soon."

## Revised decisions

1. **No new build status.** Decision 2 of Addendum I is withdrawn.
2. **Correct the vocabulary first**: `COMPLETED`→`SUCCEEDED`,
   `ABORTED`→`CANCELED`, `single`→`manual`, `full`→`upstream`. Every value
   now traces to a page, which is the standing rule.
3. **Queuing is job-level waiting.** Resolution detects that another
   unfinished build outputs a dataset that is an input to one of our jobs,
   and that job stays `WAITING` instead of running. The build is `RUNNING`
   throughout, and finishes when its jobs do.
4. **The minute hand advances waiting jobs**, under the 486 claims swap, as
   `builds.created_by`. Unchanged from Addendum I, and still ours: Foundry
   drains with infrastructure we do not have.
5. **Staleness is re-evaluated when a waiting job runs**, on the wording of
   `forceBuild`. Marked as strongly indicated rather than stated.
6. **`scheduleRid` and `abortOnFailure` come along**, because both are one
   column and both are already true of our engine in prose form.
7. **Still recorded, not built**: retries with backoff, `fallbackBranches`,
   `connecting` targets, `ignoredRids`, `notificationsEnabled`,
   `DID_NOT_RUN` job rows for fresh targets, and Cancel build.

## Questions that remain

1. **Does a job wait, or does the build refuse?** "may be queued" still
   leaves Foundry room to reject rather than wait. I build waiting.
2. **`DID_NOT_RUN` = fresh-and-skipped is inference.** Ours deletes fresh
   targets from the jobset entirely and returns NULL when all are fresh
   ("Ignored"), so Foundry keeps a row where we keep none. Recorded as a
   structural difference, not corrected here.

---

## Upstream moved (2026-08-18) — and it named a default we do not have

The drift sweep re-mirrored `building-pipelines/`. No quotation here went stale.
`create-schedule` gained two settings, and the first one **states a default that
our scheduler does not implement**:

> "* **Allow overlapping runs:** By default, a schedule does not start a new run while another run of the same schedule is in progress. Enable this setting to allow runs to overlap. Use this setting to:"

> "  * **Reduce latency in a pipeline with a long sequence of jobs:** A new run can begin processing new input data at the start of the pipeline before an earlier run finishes processing data through the entire pipeline."

> "  * **Use one schedule to keep multiple datasets up to date:** A single schedule starts builds for each dataset as needed, without requiring a separate schedule for each dataset."

`schedule_candidates()` (553) selects on `NOT s.paused` and nothing else. It has
no idea whether a run of the same schedule is still going, so **we always
overlap** — Foundry's opt-in behaviour, shipped as our only behaviour, and never
stated anywhere.

**This is not a regression.** The sentence is new upstream, so the default was
not knowable when 493–496 were built. What makes it worth acting on is that it
is a *silent* divergence: nothing fails, runs just pile up, and the pg_cron
heartbeat fires every minute — which is precisely the shape that produces
overlap in the first place.

The second setting is a different kind of thing and is only recorded:

> "* **Customize behavior on job failure:** By default, when a job fails, the build cancels its dependent jobs. Enable this setting to specify datasets for which a job failure should not cancel dependent jobs. If a job for one of the specified datasets fails, the build continues to run its dependent jobs."

## Decisions from the sweep

1. **Allow-overlapping-runs is worth building, and the default is the point.**
   `schedules.allow_overlapping_runs boolean NOT NULL DEFAULT false`, with
   `schedule_candidates()` skipping a schedule that already has a run in flight
   unless it is set. Small, exactly cited, and it makes the behaviour we already
   have into a *choice* rather than an accident. Not built yet: this block has
   not been recited.
2. **The failure-behaviour setting is recorded, not built.** "Cancels its
   dependent jobs" is a build-graph behaviour we do have, but the per-dataset
   exemption list is a second mechanism, and the page says nothing about how the
   exempted datasets are chosen or stored.
3. **A guard is what would have caught this, and none exists.** Nothing compares
   our scheduler's behaviour against the page's stated defaults; the drift check
   only says a page moved. **The class is "a documented default we silently
   invert"** — worth remembering the next time a page states a default rather
   than a capability.

## Questions from the sweep

1. **What counts as "in progress" for the overlap check — the build, or every
   job in it?** A build with a long tail of jobs is arguably still running long
   after its trigger fired. `blocks:` the exact predicate in
   `schedule_candidates()`.
2. **Does a suppressed run queue or vanish?** "does not start a new run" says the
   run does not begin and stops. Whether the trigger is remembered and fires late,
   or is simply dropped, decides whether a minute-resolution heartbeat loses work.
   `blocks:` the same build.
