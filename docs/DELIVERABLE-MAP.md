# What is left to build

The only planning document. It says what is NOT built; the moment something
ships, its entry is deleted rather than annotated. A file that accumulates
"✅ SHIPPED" lines becomes a history, and history is what git is for.

**The queue is now derived, not judged.** It used to be ordered "by the size of
the structural absence", which meant by my estimate of it. It is now ordered by
Foundry's own architecture: `object-backend/overview` names six services and
draws how they connect, and `readings/ontology-backend-architecture.md` maps
each one onto ours. An entry earns its place by being a connection the diagram
draws and we do not.

Every service has a counterpart — Ontology Metadata, object databases, Object
Set Service, Actions, the Object Data Funnel, Functions on Objects. What is
missing is not a service. It is wiring.

---

## The build order

### 1. The index is a build

**The connection the diagram draws and we do not.** `mark_index_stale_on_commit`
fires when a datasource transaction commits, so the platform knows an object
type's index is behind — and nothing reindexes. `index_object_type` is reachable
from tests, from its own migrations' assertions, and from a button. No timer, no
trigger, no build.

Foundry's Funnel "is comprised of a series of Foundry build jobs" that "run
whenever their respective datasources are updated" and, when user edits exist,
"every 6 hours". We built that engine in 493–508 — job specs, builds, the seven
job states, build locking, contention queuing, a trigger grammar whose
`tableUpdated` is exactly "a new transaction is committed to the table", and a
minute-hand heartbeat. **The two halves were built separately and never joined.**

This is the ontology half of the sentence the pipeline layer was built to
finish: derivation was declared and nothing computed it. Reindexing is the same
absence, one layer up.

Reading written, Decisions recited, not yet built.

### 2. Materializations

The merged state — datasource plus user edits — written back out as a dataset,
"the latest state of each object", schema taken from the Ontology rather than
the datasource. We compute exactly that state in `object_state()` and never
expose it. Cheap once §1 lands, because the build that indexes already produces
it. Propagation is automatic or the same six-hour cadence.

### 3. Automate

The condition-and-effect layer above Actions, whose effects are "Submit Foundry
actions" and "Execute Foundry functions" — both of which now exist and are
verified live. Conditions are time-based, object-data-based, or both. Mirrored
(42 pages) and unread.

### 4. Cross-organization principal visibility — PREMISE CORRECTED, NEEDS A READING

The guest picker adds foreign principals by ID because registries are
org-siloed. This entry used to say "Foundry's Control Panel searches the
enrollment", and **that was our inference, not a citation**. The one sentence
found on looking says something different and narrower:

> "You will only be able to view groups for which you have `View group
> membership` permission on the group's Organization."
> — `platform-security-management/manage-groups`

So the mechanism is a **grantable per-organization permission** that widens who
you can see, not a global search. That is a permission type we do not have, and
it belongs beside the granular policies in the security phase rather than being
bolted onto the guest picker.

**No longer "small".** It needs its own reading — `manage-groups`,
`manage-roles-`, and the Organization permissions surface — before anything is
built. Do not build from this entry as written.

---

### 5. Drop `object_type_indexes.status` — two of four steps done

523 and 524 did steps 1 and 2: `object_type_index_ready()` is the predicate,
and all ten functions that gated on `x.status = 'success'` now ask it —
including the eight on the hot read path.

**523 hid every object, and 524 fixed it forward.** The pure OSv2 predicate
asked only whether the last index BUILD JOB completed, and every index that
existed had been built before 513 made reindexing a build job. None had one, so
the answer was false for all of them and exploration, counts, aggregations,
histograms, quicksearch and restricted views all went dark. The platform suite
caught it on the next run, which is exactly why this was worth its own change.
`object_type_index_ready()` now prefers the job and falls back to the legacy
scalar **only** where no job exists.

Remaining, and **the order is fixed by a mistake, not by preference**:

3. **Make `index_object_type` unreachable except through a build job — DONE
   (528, reverted by 529/530, reapplied unchanged as 532).** The indexer takes
   the build job it runs under and refuses without a RUNNING one for that type,
   so the hole closes by signature rather than by census. Revoking EXECUTE
   cannot do it — `run_build_job` is SECURITY INVOKER and would lose the
   privilege along with everyone else. All three platform fixtures and the
   Reindex button now go through `run_index_build`.

   **The blocker was a real bug, and not the one I named.** 528 was reverted on
   the theory that its guard broke the `restrictedViews` fixture. It did not.
   Forcing that fixture down the build path for the first time exposed a defect
   that had been there since 513: a restricted-view backing leaves
   `object_type_datasources.dataset_id` NULL — **by CHECK**, not by accident —
   and `job_spec_input_state` aggregated on it, which is what
   `jsonb_object_agg` reports as "field name must not be null". Every
   restricted-view-backed object type was unbuildable, and no test saw it
   because all three fixtures called the indexer directly, which is the very
   hole step 3 closes. `job_blocked_by` took the same NULL and *silently*
   matched nothing, so such a reindex never waited for the build rewriting its
   data. 531 resolves both through `object_type_input_datasets()`, per
   `object-edits/materializations`: "Backing dataset: The backing dataset of
   the restricted view."

   Two lessons, both already paid for once. **A component that only fails when
   something else forces it down a new path is not the component at fault** —
   my note sent the next reader to the property/datasource loop, which was the
   one part of the indexer that already resolved the view correctly. And **a
   fixture that exercises an engine by calling its internals is not testing the
   engine**; the three that did hid this for nineteen migrations.
4. **The fallback arm comes out of `object_type_index_ready()` — DONE (533).**
   Third attempt, and the first whose argument is about the system: an index
   row exists only if `index_object_type` ran, which since 532 requires a
   RUNNING job, so the ELSE arm cannot be taken. The three ways that chain
   could break were checked rather than assumed — RLS refuses a direct INSERT
   (verified **as `authenticated`**), the only `DELETE` on `builds` fires at
   `n = 0`, and "no index reading success may fail `ready()`" is an assertion.
   The single-writer claim it rests on is now a standing platform test.
5. **`status` is deleted — DONE (534, 535).** The scalar carried two facts and
   the second one was the work. "This index succeeded" was already the job's;
   "this index is stale" was three triggers writing `'not started'`.

   The page names the replacement: "When the schema of an object type changes
   and the previous pipeline's schema is no longer up-to-date, a new
   **replacement pipeline** must be provisioned"
   (`object-indexing/funnel-batch-pipelines`). **`object_types.version` is
   already that schema version** — it bumps on a type edit and on any property
   change, which is why `mark_index_stale_properties` was dead code rather than
   merely unattached. So `job_spec_fresh`, which already compared
   `bj.spec_version` to the spec's version, now compares against the type's,
   and all three trigger functions are **deleted with nothing replacing them**:
   a datasource swap and a data commit were always covered by
   `job_spec_input_state`.

   I first built this as a trigger copying the type's version onto the spec. It
   tripped `guard_job_spec` — publishing a spec takes the editor role, and
   provisioning a pipeline is not a person publishing anything. **The refusal
   was right and the design was wrong**: a second copy of a version that
   already exists is state to keep in step. The guard was left alone.

   The indexer also stops swallowing its own failure — it raises, and the job
   records it, "in the pipeline graph" as the FAQ puts it. Surfaces read
   `object_type_index_report()`, which reports the seven job states, so the
   Object types page can now say *indexing* where it used to say *not indexed*.

**Why the order is this way.** 525 backfilled a build for every existing index
and asserted none was left without one — true. 526 removed the arm on that
basis and the read path went dark again, because the assertion described the
*rows that existed*, not the *system*: a fixture indexing a new type has no
build, and eight exploration cases failed immediately. 527 put the arm back.

That is the same error as 523 one level up — proving a property of the current
data and treating it as a property of the system. The suite caught both within
one run, which is the only reason neither reached CI.

### 6. Automate: the retry ladder and the published limits

Two divergences found by reading `retries` and `limits` AFTER shipping 517.

**The fallback fires too early.** Ours runs on any failure; the page says
fallbacks "will only execute if an object failed non-retryably, or the maximum
number of retries has been reached". That needs the retry ladder underneath it:
per-effect retries (action and Logic only), and event retries with an interval
under 24 hours and a count between 1 and 5.

**The object-set cap is ours and it is wrong.** `object_set_keys` truncates at
10,000. Published: 100,000 for `Objects added`/`Objects removed`, 1,000,000 for
`Run on all objects`, and exceeding it is an ERROR at save or evaluation — not
a silent truncation, which is what we do and is the worse behaviour.

Also unbuilt and published: 45-minute queue wait and 4-hour run ceilings.

## The deprecation audit (2026-08-15)

Every page carrying a **planned deprecation** callout was checked against what
we build. The result: **one** deprecated design had reached the schema.

| deprecated in Foundry | what we have |
|---|---|
| Object Storage v1 (Phonograph), "unavailable after June 30, 2026" | `object_type_indexes.status` was its scalar. 520 replaces it; §5 above drops it. |
| Writeback datasets (OSv1's edit persistence) | never built — we built object datasets, the OSv2 replacement |
| "Ignore inherited permissions" | never built; C1 recorded the deprecation as the reason folders organize and never gate |
| "Propagate view requirements", superseded by Projects and Markings | never built; we have both replacements |
| Metric changed [Sunset] (Automate condition) | excluded by name in the Automate reading |
| Gaia Milsym Creatable interface | not our domain |

**Re-run this when the mirror grows.** `grep -rl "planned deprecation"
docs/foundry-reference/mirror/` is the whole scan, and it is cheap. A page can
acquire the callout between one reading and the next, which is how a build
copies a design Foundry has already left.

## Known gaps, not queued

**Replacement pipelines.** A schema change should build a second index in the
background and swap it, "without impacting the live data being served to users".
Ours rebuilds in place, so the type is unavailable while it runs. Worth doing
when it hurts.

**`authorized_group_ids` compiles fail-closed** until scoped sessions bind it
(`readings/security-phase.md`, open question 2).

**The five `…of interface` action-rule variants** are unblocked (B5 built in
450) but unbuilt (`ONTOLOGY-BUILD-MAP.md` Phase C).

**Recorded from the functions reading**: batched execution, `VALIDATE_ONLY`
mode, the `returnEdits` options, interface and struct edits, retries with
backoff, `fallbackBranches`, `connecting` build targets, Cancel build.

**A function version on a branch — ANSWERED, and the answer is "not for what we
build".** I recorded this as a question for the operator after 536. Two mirrored
pages settle it, and I should have read them before asking:

> "You can develop, publish, and consume functions on a global branch. This is
> currently supported for **TypeScript v1 functions and AIP Logic functions**."
> — `functions/branching-functions`

> "**TypeScript v2 and Python functions:** Currently, you cannot modify
> TypeScript v2 or Python functions on a branch. You may reference a specific
> version of a function on a branch and test that version before merging it
> back to the `main` branch. However, the function code will only be able to
> leverage the schemas that exist on the `main` branch."
> — `global-branching/integrations`

**We built the v2 contract** (`readings/functions.md`), so `function_versions`
must NOT gain a branch — that would be building something Foundry does not have
for our flavour. And the read-side sentence is already satisfied: nothing in the
function execution path consults the branch overlay, so a function's ontology
reads see `main`, which is what the page requires. Verified, not assumed.

The screenshots also correct an assumption worth recording: a branched version
is a **normal version number carrying a `Branched pre-release` label**
(`4.0.1 Branched pre-release` next to a plain `4.0.0`, and "Releasing: 6.0.0
(unstable)"), **not** a semver prerelease tag. If branching ever reaches our
functions, the marker is a flag beside the version, not `-rc1` inside it.

**Nesting a version resolver inside a query over its own table loses
uncommitted rows.** Observed reproducibly in 536: `WHERE id =
function_resolve_version(...)` over `function_versions` misses rows written
earlier in the same transaction, while the identical predicate inline finds
them, and the function receives the right arguments throughout. Minimal
reproductions in both `sql` and `plpgsql` did **not** reproduce it, so the
mechanism is not yet pinned. Committed rows are unaffected. Both call sites now
resolve into a variable first, which sidesteps it — but the cause is unexplained
and could bite another pair of functions.

**`ObjectMap` is parked.** `features/objects/ObjectMap.tsx` + `basemap.ts` are
`@surface-orphan-ok`: a maplibre map that plots any object with a geopoint
property, kept deliberately ahead of its caller.

**Property base types beyond the 22.** Geoshape, Attachment, Time series and the
rest each wait for something that stores one.

**47% of the documentation is not mirrored**, concentrated in `api/` (1,131
pages) — the corpus that has falsified our CHECK constraints twice. Refresh the
index with `--urls` before concluding a page does not exist.
