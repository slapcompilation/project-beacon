---
verify: strict
---

# Materializations — the merged state, written back out as a dataset

**CORRECTED 2026-08-15.** Read in full: `object-edits/materializations.md`,
`object-edits/how-edits-applied.md`, `object-indexing/funnel-batch-pipelines.md`.
Of the ten images, **two** were opened — `materializations-2` and
`materializations-3`, the two the decisions rest on.
`object-link-types/property-metadata.md` was cited in the original header and
**was never opened**; the API-name rule quoted here comes from
`materializations.md` itself, which states it directly.

Read because it is §2 of the derived queue: the merged state — datasource plus
user edits — is exactly what `object_state()` already computes, and it is the
one thing the Ontology produces that we never hand back to the dataset layer.

## 1. What it is

> "Ontology users can create **materializations** of indexed data from the
> Ontology that contains the latest state of each object by combining data from
> both input datasources and user edits."

Two published use cases, and neither is "so the ontology works":

> "Building downstream Foundry pipelines that require the latest state of each
> object including user edits."

> "Enabling downloads of Ontology data containing the latest state of all
> objects for an object type."

And it is optional, which is the OSv2 change:

> "Object Storage v2 does not require materialized datasets to enable user
> edits. … This makes materializations optional in OSv2 such that users would
> only need to create materializations if needed for the two main use cases
> mentioned above."

## 2. What the images add that the prose does not

The prose says "materialized dataset" throughout. **The product does not.**

`images/materializations-3.png` — the object type's **Output datasets** panel:

- A section headed **Output datasets**, subtitled:

> "You can copy data contained in objects of this type into derived datasources."
> — object-edits/images/materializations-3.png

- Under it, a list headed **Object datasets** — that is the noun in the UI.
- Each row: the dataset name, **Status: `Up to date`**, and **Build interval**
  as an editable dropdown reading `Periodic` or `Automatic`.
- A **+ Create new object dataset** button.

The creation dialog is headed **Create new object dataset**:

> "Choose how often you want the object dataset to be rebuilt"
> — object-edits/images/materializations-2.png

> "Object datasets are built whenever updates to objects are detected. As
> builds may happen more frequently this can increase costs."
> — object-edits/images/materializations-2.png

> "Object datasets are built when input datasources update or every 6 hours."
> — object-edits/images/materializations-2.png

labelled **Automatic** and **Periodic** respectively.

So the two modes are a **stored per-dataset setting with published names**, not
a derived behaviour, and several object datasets may sit on one type with
different intervals. The prose describes the same two modes in paragraph form
and never names them.

**Periodic is the trigger pair we already built.** "when input datasources
update or every 6 hours" is word for word the rule `run_stale_indexes`
implements for the index.

## 3. The schema is the Ontology's, not the datasource's

> "In OSv1, the schema of the input datasource is copied and used as the schema
> of the writeback dataset."

> "OSv2 changes this behavior to increase the legibility of the Foundry
> Ontology. Since users are materializing data from the Ontology, the schema
> used for materialized datasets is copied from the Ontology definitions
> instead of relying on the backing datasource configuration. Specifically, the
> **API Name** metadata of each property is used as the schema of the
> materialized dataset."

And a warning we should obey by *not* copying it:

> "`__` prefixed columns (e.g. `__is_deleted`, `__patch_offset`) in the
> materialized dataset are metadata columns used by Foundry for deduplication
> purposes and do not represent any information on the state of the object
> type. These columns could be renamed or removed from future releases without
> prior warning and should not be used in production workflows."

## 4. Retention is not ours to choose

> "In OSv2, materialized datasets are subject to a retention that is not
> customizable. Historical transactions are constantly deleted and only the
> latest snapshot is guaranteed to be available. In this case, users will have
> to set up a transform downstream if it is important to keep historical
> snapshots of object type states."

## 5. Branching, stated as a limitation

> "Materializations cannot be created on a branch."

> "Materializations cannot be edited on a branch."

## Decisions (mine, not Palantir's, unless quoted)

1. **The noun is `object_datasets`**, from the UI, not "materializations" from
   the prose. One row per output: the object type, the dataset it writes, and
   the build interval. Several per type is explicit in the page ("OSv2 also
   allows multiple materialized datasets to be created, in case users want to
   materialize only a subset of the properties").
2. **`build_interval` is `automatic` or `periodic`**, the dialog's own two
   values, stored rather than inferred.
3. **It is a build job, like the index.** 513 taught `job_specs` to output an
   object type; this teaches it to take one as an INPUT — a spec whose output
   is a real dataset and whose source is an object type. The job writes a
   `SNAPSHOT` transaction of the merged state. No new engine, no new scheduler:
   `periodic` is the arms `run_stale_indexes` already asks, and `automatic`
   adds one more — after an index build completes for that type.
4. **The schema comes from the property API names**, per the quote, and the
   `__` columns are deliberately not reproduced: they are named as unstable and
   they exist for a deduplication step our collapse does not have.
5. **Retention: each build writes a SNAPSHOT and older transactions on that
   dataset are dropped.** "only the latest snapshot is guaranteed to be
   available" is a promise about what a reader may rely on; deleting is how it
   is kept. *Inference on the mechanism*, quote on the guarantee.
6. **Refused on a branch**, by name, because the page states it twice.
7. **Recorded, not built**: materializing as a restricted view, the marking and
   mandatory-control provenance that carries from the backing dataset, and the
   multi-datasource subset selection. Each needs the restricted-view plumbing to
   answer first, and the page devotes most of its length to exactly that.

## Questions

1. ~~Does an object dataset have its own status, or is it the build's?~~
   **Answered, after a wrong first answer** — see
   `ontology-backend-architecture.md`. I first cited the Phonograph page, which
   is OSv1 and in planned deprecation. **OSv2 has no scalar status to
   reconcile**: "a dedicated pipeline graph that shows the status of various
   jobs in a Funnel pipeline" is the surface, and the truth is the job's state.
   So the object dataset's `Up to date` chip reports its last build and needs
   no column, which is the same conclusion by a better route.
2. **What does `automatic` watch, exactly?** "whenever updates to objects are
   detected" — an index build completing is the obvious signal here, but an
   edit applied without a reindex is also an update to objects. I propose both.

## Built (2026-08-15) — migrations 515–516

Decisions 1–7 shipped as recited. `object_datasets` carries the type, the
dataset and the `build_interval` with the dialog's two values; `job_specs`
gained `source_object_type_id`, so a materialization is a third job shape — a
dataset output whose logic is the copy — on the engine 513 already extended.
Retention deletes the older transactions, leaving the latest snapshot. The
status is not stored: it is the last build job, per the OSv2 correction.

**Two corrections, both from the standing suite on the next run.**

1. **The schema was wrong, and my migration comment justified it falsely.** 515
   said the index table is "keyed by property API name — which is exactly what
   the page demands". It is not: the index keys by **property id**. For the
   seeded Aircraft the index reads `tail_number` where the API name is
   `tailNumber`. `SELECT *` copied property ids into the object dataset and
   made the page's own sentence false. 516 renames each column to its API name
   on the way out. The *index* keeps its own keying — no page says the index is
   API-named, and only the materialized dataset's schema is dictated.

   The test caught it by asserting the output column exists. **An assertion
   about the artifact survives a wrong belief; a comment asserting the belief
   does not.**

2. `build_jobs.source_object_type_id` had no index, which `catalog.test.ts`
   asks of every foreign key on every run.

**Not enforced, and deliberately so**: "Materializations cannot be created on a
branch." Our ontology branching has no session-level current branch — a branch is
made *from* working state by `save_to_new_branch`, and object datasets are not
a branchable resource kind. Inventing a `current_ontology_branch()` to refuse
against would be structure with no caller. Revisit if object datasets ever
enter working state.
