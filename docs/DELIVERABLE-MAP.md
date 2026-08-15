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

3. **Make `index_object_type` unreachable except through a build job —
   ATTEMPTED AND REVERTED (528, reverted by 529/530).** The shape is right: the
   indexer takes the build job it runs under and refuses without a RUNNING one,
   so the hole closes by signature rather than by census. Revoking EXECUTE
   cannot do it — `run_build_job` is SECURITY INVOKER and would lose the
   privilege along with everyone else.

   **Blocked on one question.** With the guard in place, the `restrictedViews`
   fixture's object type fails to index *through a build* — "field name must
   not be null" — while the same type indexes fine when the indexer is called
   directly. The guard passes before any of the body runs and the body is
   otherwise identical, so something about that type resolves differently on
   the build path. It is a restricted-view-backed type whose properties are a
   **mix of datasource-bound and unbound** (the primary key carries no
   `datasource_id`, the others do) and `index_object_type` loops per
   datasource — that is where to look first.

   Answer that, reapply 528 unchanged, then move the three fixtures and
   `apps/web/src/features/objectTypes/indexing.ts` onto `run_index_build`.
4. Then the fallback arm in `object_type_index_ready()` is unreachable **by
   construction**, and comes out.
5. Then `index_object_type` stops writing `status`, and the column is dropped.

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

**`ObjectMap` is parked.** `features/objects/ObjectMap.tsx` + `basemap.ts` are
`@surface-orphan-ok`: a maplibre map that plots any object with a geopoint
property, kept deliberately ahead of its caller.

**Property base types beyond the 22.** Geoshape, Attachment, Time series and the
rest each wait for something that stores one.

**47% of the documentation is not mirrored**, concentrated in `api/` (1,131
pages) — the corpus that has falsified our CHECK constraints twice. Refresh the
index with `--urls` before concluding a page does not exist.
