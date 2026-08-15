---
verify: strict
---

# The Ontology backend, service by service — and where ours sits

**CORRECTED 2026-08-15.** Read in full: `object-backend/overview.md`,
`object-indexing/funnel-batch-pipelines.md`, `object-edits/how-edits-applied.md`,
`object-edits/materializations.md`. Images opened: `osv2-arch.png` and
`funnel` `pipeline2.png` — **not** `osv1-arch.png` and not the other four
screenshots. Consulted **by grep only**: `object-indexing/faq.md`. **Never
opened**: `object-indexing/overview.md`, `funnel-streaming-pipelines.md`,
`direct-datasources.md`, `data-restrictions.md`.

The architecture map and the finding it produced rest on the four pages read in
full and on `osv2-arch.png`, all of which are quoted. The four unopened pages
are why "streaming pipelines" and "direct datasources" appear nowhere in the
decisions — that is an absence, not a judgement, and they should be read before
anything touches indexing again.

Read because every audit so far has checked **vocabulary** — do our CHECK values
trace to a page — and none has checked **shape**: is the thing wired together
the way Foundry wires it. This is the floor plan that makes the build order fall
out of the architecture instead of out of my judgement.

## 1. The six services, and the two layers

> "The Ontology backend is responsible for three main functions:
> **Datasource management** to feed the Ontology and manage schema definitions
> within the Ontology.
> **Querying, searching, and aggregating objects** from the Ontology with
> support for specific filtering and permissioning.
> **Orchestration of writing to the Ontology**, including indexing of
> datasources and edits to Ontology objects based on decisions made or actions
> taken in Foundry."

`images/osv2-arch.png` draws it as two boxes. **Dataset Layer**: datasets, and
the Object Data Funnel that consumes them. **Object Layer**: object databases,
Object Set Service, Functions on Objects, Actions. The Ontology Metadata
Service spans both across the top. One arrow leaves the Object Layer and
re-enters the Dataset Layer, labelled **User edits**, running from Actions back
into the Funnel.

| service | what the page says it does | ours |
|---|---|---|
| Ontology Metadata Service | "defines the set of ontological entities that exist … metadata of object types, the link types … the action types" | `object_types`, `link_types`, `action_types`, interfaces, shared properties, value types |
| Object databases | "storing the indexed object data … also responsible for indexing, querying, and orchestrating user edits" | the `objects` schema, one real table per type (442) |
| Object Set Service | "serving reads from the Ontology … searching, filtering, aggregating, and loading of objects" | `object_sets`, `object_set_where`, `evaluate_object_set` |
| Actions | "responsible for applying user edits to object databases" | `apply_action`, `apply_function_edits`, `object_edits` |
| Object Data Funnel | "orchestrating data writes into the Ontology … reads data from Foundry datasources … and user edits (from Actions) and indexes these data into object databases" | `index_object_type` (442) |
| Functions on Objects | "logic that can be executed quickly in operational contexts" | F1 + F2, the QuickJS isolate |

Every service has a counterpart. The gap is not a missing service — it is how
one of them **runs**.

## 2. The Funnel is a build pipeline, and ours is a function

> "A Funnel batch pipeline is comprised of a series of **Foundry build jobs**"

Four, each named:

> "In the **changelog** job, Funnel automatically computes the data difference
> for all datasources when the datasources receive new data or transactions"

> "In the **merge changes** job, all changelog datasets from the changelog step
> and any recent user edits coming from Actions are joined by the object type's
> primary key to merge all changes and store them in a separate dataset."

> "Funnel starts an **indexing** job per object database to convert all rows in
> the final dataset with all merged changes into a format compatible with the
> object databases"

> "**hydration** … downloading the index files from the dataset into the disks
> of the OSv2 database search nodes"

442 read this page and collapsed the four deliberately, and said so: ours does
"the one job Postgres can do honestly — read the datasource's current view,
merge the edit log through `object_state()`, and write a real table with real
columns per property". That collapse is still right. Hydration is a Spark
cluster fact; a changelog dataset is an incremental-compute optimisation;
Postgres reads the merged view directly.

**What is not still right is that it is a function nobody calls.**

## 3. The finding: staleness is detected and nothing acts on it

`mark_index_stale_on_commit` fires when a dataset transaction commits, so the
platform knows the index is behind. `index_object_type` is invoked by tests, by
the assertions inside its own migrations, and by a generated client entry a
a person can press. **No timer, no trigger, no build runs it.**

Foundry's answer is published and specific:

> "Live pipelines run whenever their respective datasources are updated.
> Additionally, if user edits on objects are detected, live pipelines will run
> every six hours regardless of any explicit backing dataset update"

and the same six hours appears from the other side in `how-edits-applied`:

> "Whenever there is a new data transaction in object type datasources, or
> In the absence of new data in the datasources, every 6 hours, if edits had
> been detected on any objects."

This is the **same structural absence** our own deliverable map once described
for datasets, in our words rather than Palantir's: derivation was declared and
nothing computed it, which is what the pipeline layer was built to close. The
ontology half is still open — `index_status` declares staleness, and nothing
reindexes.

And everything needed now exists. 493–508 built job specs, builds, build jobs
with the seven documented states, a queue, schedules with a trigger grammar
whose `tableUpdated` is literally "a new transaction is committed to the table
on the target branch", and a pg_cron heartbeat that already runs every minute.
The two halves were built separately and were never joined.

## 4. What the monitoring pages corroborate

`monitoring-views/rules-reference` publishes rules named **"Changelog jobs
failing"**, **"Merge changes job failing"**, **"Sync jobs failing"** and
**"Sync propagation delay"**, each scoped to "the object or link" and to "the
active pipeline or the replacement pipeline". Those rule names only exist
because indexing is a pipeline of named jobs. It is the strongest confirmation
that the four-stage shape is load-bearing rather than descriptive — and the
reason our collapse must stay *declared*, so it is legible as a choice.

## 5. Two shapes we do not have at all

**Replacement pipelines.** "When the schema of an object type changes … a new
replacement pipeline must be provisioned … the live pipeline continues to run
on its usual cadence, [and] Funnel will orchestrate a replacement pipeline in
the background without impacting the live data being served to users." Ours
rebuilds in place, so a schema change makes the type unavailable while it runs.

**Materializations.** "materializations of indexed data from the Ontology that
contains the latest state of each object by combining data from both input
datasources and user edits" — the merged state written back out as a dataset,
with its schema taken from the Ontology ("the API Name metadata of each
property is used as the schema of the materialized dataset"), propagating
either automatically or on the same six-hour cadence. We compute exactly that
state in `object_state()` and never expose it as a dataset.

## Decisions (mine, not Palantir's, unless quoted)

1. **The index becomes a build.** Not a fifth mechanism: a `job_specs` row whose
   output is the object type's index, run by the engine 493–508 already ships,
   so it appears in the Builds app, carries the seven job states, obeys build
   locking, and is queued behind whatever rewrites its inputs. That last one is
   free and correct — a reindex that waits for the dataset build feeding it is
   exactly what 507 was built to express.
2. **Its trigger is the published pair**: `tableUpdated` on each datasource, OR
   a six-hour cron — "whenever there is a new data transaction … or … every 6
   hours, if edits had been detected". Both already expressible in B2's grammar,
   so this is configuration, not new vocabulary.
3. **The four-job collapse stays**, and stays declared. Hydration and changelog
   datasets are Spark facts. *Inference*: that the collapse remains honest once
   indexing is a build — the build has one job where Foundry has four, and the
   migration will say so in those words.
4. **Full-versus-incremental stays full.** "The default threshold is set to 80%
   of rows changed in the same transaction" is a cost heuristic for Spark;
   Postgres re-reads the view. Recorded, not built.
5. **Replacement pipelines: recorded, not built.** They need two live indexes
   for one type and an atomic swap. Worth doing when a schema change on a large
   type actually hurts, not before.
6. **Materializations come after**, because they are the same merged state
   pointed at a dataset, and are far cheaper once indexing is a build that
   already produces it.

## Questions

1. **Does a reindex belong to the same build as its datasource's transform, or
   its own build?** Foundry runs Funnel pipelines as separate pipelines from
   the user's transforms, which suggests its own. I propose its own build,
   triggered by the datasource's, so contention queuing handles the ordering.
2. **What happens to an object type whose index build fails?** The type has an
   `index_status`; a build has a status; those can disagree. I propose the build
   is the source of truth and `index_status` becomes a projection of it, but I
   have not found a page that settles it.

## Built (2026-08-15) — migrations 513–514

Decisions 1–3 shipped as recited. An index job is a `job_specs` row whose
output is an object type, run by the engine 493–508 already ships: it carries
the seven job states, settles through `settle_build`, obeys `job_spec_fresh`,
and `job_blocked_by` learned that an index job's inputs are its type's
datasources — so a reindex queues behind the build rewriting the data it is
about to read, which was free. The four-job collapse stays and says so in the
migration. `run_stale_indexes` implements both published arms and hangs off the
minute hand that already ran schedules.

Open question 1 is answered by building: the reindex is **its own build**,
separate from the transforms feeding it, and contention queuing orders the two.

**Question 2, answered — and my first answer was OSv1's.**

I cited `object-databases/object-storage-v1` for a `in progress` status value.
**That page is Phonograph**, which is in planned deprecation and "will be
unavailable after June 30, 2026". Taking a status vocabulary from it and
applying it to our build was importing the legacy backend's shape. The
metadata page gives the same tell in plain sight: its Index status entry ends
"Read more about index statuses" and links to the **OSv1** page.

**OSv2 has no scalar index status.** The status is the pipeline's job states:

> "The Ontology Manager application has a dedicated pipeline graph that shows
> the status of various jobs in a Funnel pipeline. A green tick in the Object
> Storage v2 node in the graph indicates that the indexing is complete and the
> object type is ready to be queried from OSv2."

— `object-indexing/faq`, and the same page again on failure: "indexing jobs
will not succeed and will report the underlying problem in the pipeline graph
in the Ontology Manager application." `funnel-batch-pipelines` sends you to the
same place — "check the pipeline errors through the **Live pipeline** dashboard
in the object type's **Datasources** tab. Choose the failed job in the pipeline
graph, then select **Failed job**."

`object-indexing/images/pipeline2.png` shows what that surface actually is, and
it is nothing like OSv1's single chip:

- An **Object Storage V2** panel — "the backend service that stores and serves
  information about objects" — listing each **data store** with **two**
  independent chips, `Data:` and `Schema:` (the screenshot reads `No data
  indexed` and `Up to date`), plus **+ Add new data store**. Two axes and many
  stores, matching "an indexing job per object database".
- A **Live pipeline** graph — "Append the latest changes made to any backing
  datasets into relevant stores" — with a node per job (`…changelog` → `Merge
  changes` → `Indexing` → `Object Storage V2`), a tick on the finished ones,
  and a percentage on the running one, which reads 90% complete alongside how
  long ago it started.

**So the v2 answer is stronger than the one I proposed.** There is no status to
reconcile: the truth is the build job's state, which 513 already stores in the
seven documented values, and every surface reads the pipeline. `success /
failed / not started` on `object_type_indexes` is an OSv1-shaped scalar we
inherited from a page that points at Phonograph for its own definition.

**Do not add `in progress`.** That was my proposal one turn ago and it would
have imported a fourth legacy value into a v2 system. The correction is the
other direction: `object_type_indexes` becomes a projection of the last index
build job — or stops carrying a status at all — and progress is the job's, not
a column's.

*Inference, marked*: that our single index job maps onto the graph's four
nodes as one node. 442's collapse already says this; the pipeline graph is
where a user would notice it.

## Built (2026-08-15) — migrations 513–514

Decisions 1–3 shipped as recited. An index job is a `job_specs` row whose
output is an object type, run by the engine 493–508 already ships: it carries
the seven job states, settles through `settle_build`, obeys `job_spec_fresh`,
and `job_blocked_by` learned that an index job's inputs are its type's
datasources — so a reindex queues behind the build rewriting the data it is
about to read, which was free. The four-job collapse stays and says so in the
migration. `run_stale_indexes` implements both published arms and hangs off the
minute hand that already ran schedules.

Open question 1 is answered by building: the reindex is **its own build**,
separate from the transforms feeding it, and contention queuing orders the two.

**Question 2 is answered by the documentation, in two places.**

> "**Index status:** The status of the last reindex of the object type and its
> backing datasources. It can be `success`, `failed`, or `not started`."

— `object-link-types/object-type-metadata`.

> "The Phonograph section of the **Datasources** tab of an object type or link
> type displays the status of the last reindex to be started. The status can be
> `success`, `in progress`, or `failed`."

— `object-databases/object-storage-v1`.

"The status of the last reindex" — twice, in both spellings. Index status is a
**projection of the last reindex job**, never an independent state. Now that a
reindex *is* a build job, the job is what it projects from.

**And that exposes a justification of 442's that has expired.** 442 omitted a
running state and said why: "No 'running': the build is synchronous here, so
the spinner is the pending call, not a stored state." That was true when a
reindex could only run inline. **513 made it asynchronous** — a contended index
job now sits in `WAITING` while another build finishes — so a reindex genuinely
is in progress with nothing able to say so. The OSv1 page publishes exactly
that value.

Note the two published spellings are a third instance of the two-vocabularies
pattern: the metadata view says `not started` where the Datasources view says
`in progress`. Ours currently carries the metadata three.

**The mistake, because it was live.** `run_stale_indexes` selected
`ot.organization_id`, and `object_types` has no such column — a type reaches
its organization through its project. `run_schedules` calls it and pg_cron runs
that every minute, so from the moment 513 applied, the whole heartbeat raised
and **schedules stopped with it**: both calls share one command string, and the
first statement aborts it. Roughly four minutes of production outage, ended by
514.

What let it through is worth keeping. 513's assertions checked that the wiring
*existed* — that `run_schedules` mentions `run_stale_indexes`, that the
constraints are present — and never ran the query. **A bad column name is
invisible to a text search.** The standing suite caught it on the next run, and
caught it from the *schedules* tests rather than the new ones, because those
call the heartbeat for real.

So: an assertion that greps a function body proves the edit landed, not that
the function works. At least one assertion per migration has to execute the
thing. 514's do.
