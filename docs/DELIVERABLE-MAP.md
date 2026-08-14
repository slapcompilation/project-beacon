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

### 4. Enrollment-wide principal discovery

The guest picker adds foreign principals by ID because registries are
org-siloed; Foundry's Control Panel searches the enrollment. Small, recorded in
`readings/enrollments-and-organizations.md`.

---

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
