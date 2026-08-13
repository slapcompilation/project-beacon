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
