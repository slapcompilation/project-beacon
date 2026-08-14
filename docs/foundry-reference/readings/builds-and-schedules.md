---
verify: strict
---

# Builds and schedules — the pipeline layer

Pages read in full: `data-integration/builds.md`, `data-integration/schedules.md`,
`building-pipelines/triggers-reference.md`, `building-pipelines/create-schedule.md`,
`building-pipelines/common-schedules.md`, `transforms-python-spark/overview.md`.
Read because this is the largest structural absence left: `dataset_inputs`
declares derivation and nothing computes it.

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
