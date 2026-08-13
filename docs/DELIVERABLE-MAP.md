# What is left to build

The only planning document. It says what is NOT built; the moment something
ships, its entry is deleted rather than annotated. A file that accumulates
"✅ SHIPPED" lines becomes a history, and history is what git is for.

**The course-derived queue is empty.** The six entries this file carried —
object types over datasources, link types, action types, Object Explorer,
Data Lineage, Security — all shipped (migrations 405–492), each with its
reading in `foundry-reference/readings/`. What follows is the next queue,
ordered by the size of the structural absence rather than by a course,
because the course is finished.

---

## The build order

### 1. Builds and schedules — the pipeline layer

The largest absent pillar. Datasets exist with branches and transactions,
and `dataset_inputs` DECLARES derivation — but nothing computes: every
dataset is written by hand, `out-of-date-with-parent` in Data Lineage can
never self-heal, and the action-type schedule rule was skipped because it
"names a system we have no counterpart for". Foundry's shape: a transform
reads inputs and writes an output dataset; a build runs transforms; a
schedule triggers builds. Pages are mirrored (`data-integration/builds.md`,
`schedules.md`, `building-pipelines/`); the reading comes before any build.

### 2. Compass: folders and the resource hierarchy

A project is a folder (`ri.compass.main.folder`) and holds files — ours is
flat: resources point at a project, nothing nests. Markings and roles both
claim to inherit "through the file system" we do not have.

### 3. Functions

Typed, versioned server logic on objects — what action types' function rule
already points at, and what derived properties want.

### 4. Enrollment-wide principal discovery

The guest picker adds foreign principals by ID because registries are
org-siloed; Foundry's Control Panel searches the enrollment. Small, recorded
in `readings/enrollments-and-organizations.md`.

---

## Known gaps, not queued

**`authorized_group_ids` compiles fail-closed** until scoped sessions bind
it (`readings/security-phase.md`, open question 2).

**The five `…of interface` action-rule variants** are unblocked (B5 built in
450) but unbuilt (`ONTOLOGY-BUILD-MAP.md` Phase C).

**`ObjectMap` is parked.** `features/objects/ObjectMap.tsx` + `basemap.ts`
are `@surface-orphan-ok`: a maplibre map that plots any object with a
geopoint property, kept deliberately ahead of its caller.

**Property base types beyond the 22.** Geoshape, Attachment, Time series and
the rest each wait for something that stores one.
