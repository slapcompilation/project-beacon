# Reading — datasets, RIDs, and the object backend

This is the reading that answers the four open questions left at the end of
`create-object-type.md`. All four were the same question wearing different hats:
**what sits underneath an object type, and what does the Ontology actually consume
from it?**

Pages read in full:
- `mirror/data-integration/datasets.md`
- `mirror/dataset-preview/overview.md`
- `mirror/analytics-connectivity/identify-dataset-rid.md`
- `mirror/object-backend/overview.md`
- `mirror/object-backend/object-storage-v2-breaking-changes.md`
- `mirror/object-backend/osv1-osv2-migration.md`
- `mirror/object-indexing/overview.md`
- `mirror/object-indexing/data-restrictions.md`
- `mirror/object-indexing/funnel-batch-pipelines.md`
- `mirror/object-indexing/direct-datasources.md`

Images read closely:
- `object-backend/images/osv2-arch.png` — the whole architecture on one page
- `analytics-connectivity/images/location-rid.png` — the About sidebar, RID + Location
- `dataset-preview/images/dataset.png` — the Dataset Preview surface, numbered 1–5

---

## 1. What a dataset is

> "A **dataset** is the most essential representation of data from when it lands in
> Foundry through when it is mapped into the Ontology. Fundamentally, a dataset is
> **a wrapper around a collection of files** which are stored in a backing file
> system."

The reason to have the wrapper is named outright: "integrated support for
**permission management, schema management, version control, and updates over
time**." Four jobs. That list is the specification.

Three shapes of data, and the storage choice differs per shape:

| shape | how it is stored |
|---|---|
| **Structured** (tabular) | files in an open format (Parquet) **plus a schema** stored alongside |
| **Unstructured** | either a schema-less dataset **or a media set**, "a separate resource type optimized for media workflows" |
| **Semi-structured** (XML, JSON) | no dedicated option — "upload these files to a dataset without a schema, then infer a tabular schema in a downstream data transformation" |

So a media set is not a kind of dataset; it is a sibling resource. The manual
upload dialog offers the two as distinct choices.

### Transactions — the version-control half

> "When you open a dataset in Foundry and see rows and columns, what you are
> seeing is actually the latest *dataset view*."

Lifecycle, three states: `OPEN` (files can be written) → `COMMITTED` (written files
are in the latest view) or `ABORTED` ("any files that were written during the
transaction are ignored").

> "Dataset transactions are the basis of Foundry's support for data versioning,
> sometimes referred to as 'Git for data.' A transaction is analogous to a *commit*
> in Git: an atomic change to the contents of a dataset."

**Four transaction types**, and they are the whole vocabulary:

- **`SNAPSHOT`** — "replaces the current view of the dataset with a completely new
  set of files." The basis of batch pipelines. The simplest type.
- **`APPEND`** — "adds new files to the current dataset view." Cannot modify
  existing files: "if an `APPEND` transaction is opened and existing files are
  overwritten, then attempting to commit the transaction will fail." The basis of
  incremental pipelines.
- **`UPDATE`** — "like an `APPEND`, adds new files to a dataset view, but may also
  overwrite the contents of existing files." Carries a warning: overwriting "will
  break the append-only requirement for incremental pipelines… downstream pipelines
  cannot process data incrementally and must fall back to `SNAPSHOT` (batch)
  processing." And: "Do not overwrite existing files in an `UPDATE` transaction
  unless there is no other option."
- **`DELETE`** — "removes files that are in the current dataset view." Critically:
  "committing a `DELETE` transaction **does not delete the underlying file** from
  the backing file system—it simply removes the file reference from the dataset
  view." Its real use is retention policies.

The worked example is worth keeping verbatim, because it is the semantics in four
lines:

> 1. `SNAPSHOT` contains files `A` and `B`
> 2. `APPEND` adds file `C`
> 3. `UPDATE` modifies file `A` to have different contents, `A'`
> 4. `DELETE` removes file `B`
>
> "At this point, the current dataset view would contain `A'` and `C`. If we added
> a fifth `SNAPSHOT` transaction containing file `D`, the current dataset view
> would then only contain `D`…"

### Dataset views — the algorithm

> 1. "Start with an empty set of files.
> 2. The view at a given time begins at the latest `SNAPSHOT` transaction before
>    that point in time. If there is no `SNAPSHOT` transaction present, then take
>    the earliest transaction for the dataset instead.
> 3. For the first transaction in the view, and for each subsequent transaction…"
>    `SNAPSHOT`/`APPEND` add; `UPDATE` adds and replaces; `DELETE` removes.

And the invariant that falls out of it:

> "the number of views in a dataset's history is **equal to the number of
> `SNAPSHOT` transactions** it contains."

A view can span branches: transactions from `master` form the start of a branch's
view "if subsequent transactions on the branch are also `APPEND` (or, strictly,
*not* `SNAPSHOT`) transactions."

### Schemas sit on the view, not the dataset

> "A schema is metadata **on a *dataset view*** that defines how the files within
> the view should be interpreted."

Two consequences the page states directly:

1. **A schema is a claim, not a guarantee.** "there is no guarantee that the files
   in a dataset actually conform to the specified schema. For example, it is
   possible to apply a Parquet schema to a dataset that contains CSV files. In this
   case, client applications attempting to read the contents of the dataset would
   encounter errors."
2. **Schemas change over time**, because they are per-view. "a new transaction may
   introduce a new column to a tabular dataset or change the type of a field."

### The fifteen field types

`BOOLEAN` `BYTE` `SHORT` `INTEGER` `LONG` `FLOAT` `DOUBLE` `DECIMAL` `STRING`
`MAP` `ARRAY` `STRUCT` `BINARY` `DATE` `TIMESTAMP`

Four take parameters: `DECIMAL` needs `precision` and `scale` ("a good default is
`precision: 38` and `scale: 18`. `38` is the highest possible precision value");
`MAP` needs `mapKeyType` and `mapValueType`; `ARRAY` needs `arraySubType`; `STRUCT`
needs `subSchemas`. They point at Spark's data types for the definitions.

**This closes a loop from `base-types.md`.** That page said "All field types are
valid base types except for `Map` and `Binary` types" — but never listed the field
types, because they belong to the *dataset*, not the ontology. So: **13 primitive
base types** (15 − `Map` − `Binary`), plus the 9 advanced ones (Vector, Geopoint,
Geoshape, Attachment, Time series, Geotemporal series, Media reference, Cipher
text, Struct), plus arrays of any base type except Vector and Time series.

File formats: **Parquet, Avro, Text**. Text covers CSV and JSON, with parsing detail
in a schema field called `customMetadata`.

### The backing filesystem

> "The files tracked within a dataset are **not stored in Foundry itself**. Instead,
> a mapping is maintained between a file's *logical path* in Foundry and its
> *physical path* in a backing file system."

HDFS or, "more commonly", S3. This is the substrate line: a dataset is the logical
object; the bytes live elsewhere and are addressed by a path mapping.

---

## 2. What Dataset Preview shows — and streaming

The application "provides you with a variety of details of a given dataset,
including metadata, build history, health, and more. Additional features are
available for **streaming datasets**."

Five numbered regions, matching the annotated screenshot:

1. **Dataset header** — name, display name, location, **selected branch**; plus
   share, move, rename.
2. **Information panel** — three sections. **About** (created/updated + who, table
   size, "any tools and input datasets used to create the data", tags; and an
   **Edit schema** view that "will infer a schema for CSV and JSON files", with
   parsing options to drop jagged rows, change encoding, or add columns like file
   path, byte offset, import timestamp, row number). **Columns** (type, description,
   "data stats (percentage of null values, distributions and samples)").
   **Schedules**.
3. **Tab views** — Preview, History, Details, Health, Compare.
4. **Preview table**.
5. **Actions** — an "All actions" dropdown, with Analyze (Contour) and Build pulled
   out for quick access.

**History** carries job/build information with a Summary of statuses over time, and
lets you "create branches on historical transactions of your data that have not
been deleted by a retention policy" — branch from a past transaction, via the
ellipsis menu.

**Details** breaks into: Schema, Files (downloadable), **Job spec**, Syncs, Custom
metadata, Resource usage metrics, and (streams only) Last run details.

**Compare** does three distinct jobs: two datasets against each other; a dataset
against an older transaction of itself; a dataset against a branch, "to see how
merging that branch will affect the dataset."

### Streaming datasets differ, specifically

The differences are all stated as callouts, and they are consistent:

- **History**, **Health** and **Compare** "will only appear when the view is set to
  **Archive**." History then "shows the archive transactions alongside the streaming
  jobs"; Health checks "refer to the archive dataset rather than the stream."
- Two extra tabs exist only for streams: **Stream** (current and historical job
  info over a selectable time period) and **Metrics** (charts, a dropdown of
  metrics "with recommended debugging metrics highlighted", thresholds and warning
  indicators with debug links, and a **Troubleshoot and Debug mode** toggle giving
  "a step-by-step walkthrough to debug stream outages").
- The preview table "provides a small sample of recently streamed rows. It will
  update automatically when set to **Live updates**. Sorting, filtering, and
  charting are only available when the page is set to **Archive**."

So a streaming dataset is one resource with **two faces**: a live face (sample,
auto-updating, no analysis) and an **archive** face (a normal dataset with
transactions, health and comparison). Every analytical capability hangs off the
archive.

### Upload

Five file types upload directly into a dataset: `.csv`, `.tsv`, `.xls`, `.xlsm`,
`.xlsx`. For `.csv`/`.tsv` "Foundry will attempt to infer the schema of the new
file." Then a real rule, not a UI detail:

> "If the filename **and schema** of the new file are identical to a previous
> upload, you can **update** data in the existing dataset. If the filename is
> different from previous uploads, you can **append** data to an existing dataset."

Filename identity selects the transaction type. The flow is: create a dataset in a
folder, then drag and drop the file in.

### The preview table itself

> "By default, the preview table will show a limited sample of the data… However,
> **any action taken on the data, such as filtering or sorting, will apply to the
> full dataset** and increase the preview sample size."

Per-column menu: sort, filter, generate charts. Per-cell: exclude or include only
that value. Plus report/view issues on individual columns, and a column-name search.

---

## 3. RID

> "Foundry provides two options for specifying your dataset details:
> * **'RID'**, which is the dataset identifier
> * **'Location'**, which specifies the filepath location of the dataset"

Both live on the About panel behind "see more", each with a copy button.

**RID = resource identifier**, and it is not dataset-specific — `compass-file-lister`
"lists rids (resource identifiers) of resources in a given input folder", and
`foundry-s3-api` refers to "`<PROJECT_RID>`: The resource identifier (RID) of a
project". Every resource has one.

**The grammar is inferred, not quoted.** No page in the mirror states it. But 132
occurrences of `ri.foundry.main.dataset.` and ~25 other prefixes give it
unambiguously:

```
ri.<service>.<instance>.<type>.<locator>
```

> **Corrected by `rid-grammar.md`:** the instance segment **can be empty** —
> `ri.multipass..organization.<uuid>`, and three other services do the same. The
> `main` in every example below is a property of those services, not of the
> grammar.

Real examples, each from a page in the mirror:

| RID | from |
|---|---|
| `ri.foundry.main.dataset.<uuid>` | 132 occurrences, most common form |
| `ri.foundry.main.transaction.<uuid>` | `data-integration/` — **transactions have RIDs too** |
| `ri.ontology.main.object-type.<uuid>` | an object type is a resource |
| `ri.compass.main.folder.<uuid>` | the filesystem |
| `ri.object-set.main.temporary-object-set.<uuid>` | `object-backend/overview` |
| `ri.mio.main.media-set.<uuid>` / `.view.` / `.media-item.` | `base-types` media reference |
| `ri.phonograph2-objects.main.object.<uuid>` | OSv1 — the service name is literally in the RID |

The last row is the tell: **the service that owns the resource is encoded in the
identifier**. `phonograph2-objects` for OSv1 objects, `mio` for media, `compass` for
folders, `blobster` for blobs, `bellaso` for Cipher. A RID says *what owns this*
before it says *which one*.

### What the image adds

`location-rid.png` — the About sidebar with **Location** and **RID** boxed in
orange, RID showing a copy-to-clipboard tooltip. The full field list visible:
Updated (with a green verified tick), Created, **Location**, Type (`Dataset`),
**Table size** (`6 columns • 10m rows`), **Updated via** (`clean` — a link to the
producing job), **RID**, **Job type** (`Contour`), **Size** (`241MB • 4 files`),
**Branch** (`master`), then Tags and Health Checks.

Two things the prose does not say:

1. **Size is stated twice, differently.** "Table size: 6 columns • 10m rows" is the
   *logical* shape; "Size: 241MB • 4 files" is the *physical* shape. The dataset
   abstraction shows you both sides of its own wrapper.
2. **"Updated via" is a link to the thing that produced it.** Provenance is a
   first-class field on the resource, not a lineage view you go find. In
   `dataset.png` the same field reads `airlines-ontology logic`, and above it sits
   `[Foundry][OFT_1] Airline` with a gear icon — **the object type backed by this
   dataset is shown on the dataset**. The link is bidirectional in the UI.

Also from `dataset.png`: column headers are two-line — name on top, **field type
underneath** (`String`, `Integer`, `Date`). Row count reads "Showing 300 of 481
rows · 12 columns". The branch selector (`master`) sits in the breadcrumb with a
git-branch icon, exactly like the Ontology's `Main` selector.

---

## 4. The object backend

### Three responsibilities, six services

> "The Ontology backend is responsible for three main functions:
> * **Datasource management** to feed the Ontology and manage schema definitions
>   within the Ontology.
> * **Querying, searching, and aggregating objects** from the Ontology with support
>   for specific filtering and permissioning.
> * **Orchestration of writing to the Ontology**, including indexing of datasources
>   and edits to Ontology objects."

| service | job, quoted |
|---|---|
| **Ontology Metadata Service (OMS)** | "defines the set of ontological entities that exist… the metadata of object types, the link types…, the action types…" |
| **Object databases** | "storing the indexed object data… designed to provide fast data querying… also responsible for indexing, querying, and orchestrating user edits" |
| **Object Set Service (OSS)** | "responsible for serving reads from the Ontology… enabling searching, filtering, aggregating, and loading of objects" |
| **Actions** | "responsible for applying user edits to object databases… enable complex permissions and conditions for user edits" |
| **Object Data Funnel** | "orchestrating data writes into the Ontology. Funnel reads data from Foundry datasources… **and user edits (from Actions)** and indexes these data into object databases" |
| **Functions on Objects** | "logic that can be executed quickly in operational contexts" |

### What the architecture diagram adds — and it is a lot

`osv2-arch.png` splits into **Dataset Layer** (left) and **Object Layer** (right),
with the **Ontology Metadata Service** as a bar spanning *both*, dropping arrows
into three places: the object type, the Object Databases, and the Object Set
Service. OMS is not in either layer; it defines both.

The read path, left to right:

```
Datasets ──"Map entity to data"──> Person Object type
Datasets ──────────────────────> Object Data Funnel ──"Indexing"──> Object Databases
Object Databases <──> Object Set Service <──> "Object searches, loads, aggregations" <──> user
```

Two arrows leave `Datasets`: one is the **definition** (mapping the entity to the
data — this is the object type's schema), the other is the **data itself** flowing
into Funnel. Definition and data are separate paths from the same source. That is
the object-type-versus-object permission split from `object-permissioning`, drawn.

**Object Databases is a box containing three things**: `OSv2`, `OQL`, and `…`. So
"object database" is a *category*, and OSv2 is the canonical member. `funnel-batch-
pipelines` confirms it: "Funnel starts an indexing job **per object database**…
For example, for the canonical OSv2 database."

The write path, and this is the sentence the diagram makes unmissable:

```
user ──"Execute actions"──> Actions ──> [ back around the bottom of the diagram ]
                                    ──"User edits"──> Object Data Funnel
```

**Edits do not go to the object database. They go back to the front of the
pipeline.** The same Funnel that indexes the datasets indexes the edits. There is
one write path, and datasource updates and user edits merge inside it. This is
confirmed in prose by `funnel-batch-pipelines`: "all changelog datasets from the
changelog step **and any recent user edits coming from Actions** are joined by the
object type's primary key to merge all changes."

Also on the diagram: `Actions ←→ Functions on Objects ←→ Object Set Service`. An
action can call a function; a function reads through OSS. Nothing reads the object
database directly except OSS.

### Object sets — two independent axes

> * "**Static object sets:** saved as a list of primary keys, and will stay the same
>   regardless of any changes to the input data.
> * **Dynamic object sets:** saved as a representation of the filters applied to
>   create the object set. When new data matches the filters, the object set will be
>   updated.
> * **Temporary object sets:** … can only be accessed by the user who created them.
>   A sample temporary object set RID will appear like
>   `ri.object-set.main.temporary-object-set.<uuid>` and **expires within 24 hours**.
> * **Permanent object sets:** stored in the object backend for future reference."

Definition (static | dynamic) × state (temporary | permanent). Both axes, and they
are orthogonal. Ours (`object_sets`) are permanent + dynamic only.

### OSv2, and the numbers

OSv1 (Phonograph) is in **planned deprecation and unavailable after June 30, 2026**
— already past, as of this reading. Migration to OSv2 is "**mandatory** for all
object types."

Why the rewrite: "the new architecture **separates dimensions of concern** that had
been consolidated in Object Storage v1 and decouples responsibilities within the
system design; by separating the subsystems responsible for **indexing** and
**querying** data, Object Storage v2 can scale horizontally more easily."

The capability list, with every number it states:

- incremental object indexing, **enabled by default**, for all object types
- indexing throughput "on the order of **tens of billions** of objects for a single
  object type"
- "more granular object permissions with **multi-datasource object types**,
  including column/property level permissions"
- "up to **10,000 objects** to be edited in a single Action"
- reduced edit latency; edits observable faster
- "the ability to **migrate existing user edits after a breaking schema change**"
- streaming datasources, for low-latency indexing
- "supports a maximum of **2000 properties** per object type"
- "By default, the **Search Around limit is 100,000 objects**"

### Breaking changes — read as design rules

The two that are architecture, not migration trivia:

> "**OSv2 only supports user edits via Actions.** All existing direct queries on
> OSv1 edit APIs must be refactored to use Actions before migrating to OSv2."

That is Foundry's own statement of the rule we already hold as "no raw writes." It
is not a convention here; it is the only supported path, and OSv1's alternative was
deleted rather than deprecated.

> "OSv2 renames 'writeback datasets' as '**materializations**'. In OSv1, writeback
> datasets are **required**; in OSv2, materializations are **optional**."

The migration page adds the reason: "With optional materialized datasets in OSv2,
you only need to create materializations if they are required for **downstream
usage**." A materialization is an *export* of edits back into a dataset, for
pipelines that consume it — not a storage requirement.

The rest: changelog "latest timestamp wins" is gone (Funnel computes it, "rendering
the changelog python decorator obsolete"); monitoring moves to monitoring views;
OSS APIs have **no query string support** where OSv1 did; cardinality metrics don't
work on object sets spanning both backends.

### Data restrictions — the enforcement list

`object-indexing/data-restrictions` is the most directly actionable page in this
reading. Enforcement point and failure mode are stated first:

> "These restrictions are validated **during indexing**. For object types backed by
> **batch** datasources, violations will cause **indexing jobs to fail**. For object
> types backed by **streaming** datasources, records that violate these restrictions
> are **dropped**."

**Primary keys:**

> "OSv2 enforces unique object primary keys for datasources. If there are duplicate
> primary keys **within a single transaction, indexing will fail**. If there are
> duplicate primary keys **across transactions, the version in the later transaction
> will be used**."

And a closed list of types that **cannot** be a primary key: **Geopoint, Geoshapes,
Arrays, Time series properties, Real number types (decimal, double, float)**. The
stated reason is "to encourage Ontology modeling best practices."

> **Corrected by `properties-and-keys.md`:** this is what OSv2 *blocks*, and
> eligibility is **three-valued**, not two. `properties-overview` adds a
> **Discouraged** tier — `Date`, `Timestamp`, `Boolean`, `Byte`, `Long` — each
> with its reason. Only **`String`, `Integer`, `Short`** are unreservedly valid.

**Property values:**

- "data type coherence between datasource schema and object type schema **on every
  sync**. Incompatible data types for a property will cause the build to fail."
- changing a base type requires strict compatibility of *existing values*; the error
  is `A property could not be cast to the new type`, and "the migration process
  cannot automatically clean or coerce these values."
- "OSv2 does not allow `NaN` or `±infinity`"
- "**Empty strings are not allowed** in OSv2; in OSv1, empty strings were silently
  converted to nulls."
- "`Lat, Long` should be a comma-separated string **with no parentheses**"
- "does not allow properties with **nested arrays**"
- "does not allow properties with array data types to have **null elements** within
  the array"

**Sizes:** String properties **12 MB**; Array properties **100,000 elements**.
"Properties exceeding these limits will cause indexing jobs to fail." The
recommendations are modelling advice: over 12 MB → use a media reference; over
100,000 elements → "consider using **link types** instead of array properties."

### The datasource cardinality rules, resolved

`create-object-type` says "a single datasource can only be used to back one object
type." `object-permissioning/multi-datasource-objects` gives the other side, and the
two are not in tension — they are different directions of the same edge.

**What can be a datasource for an MDO is a closed list**, and it is narrower than
"anything that holds data":

> "At this time, **only Foundry datasets or restricted views** can be used for MDOs.
> **Streaming sources are not supported.**"

And the FAQ closes the other door: "Are MDOs supported with streaming object types?
**No**… This is a known limitation of Object Storage v2."

So an object type is in exactly one of two worlds. Either it is backed by
**streaming**, in which case it has one datasource and no MDO; or it is backed by
**datasets/restricted views**, in which case it may have up to 70. There is no mixed
state. Since we have no restricted views (the legacy row-level mechanism, superseded
by object security policies), for us the rule reduces to: **datasets only, up to 70,
or one stream and nothing else.**

> "Object types are limited to a maximum of **70 datasources**. Only datasources
> that are synced to object storage count towards this limit, so it does not include
> media sets or time series syncs."

Note this is **per object type**, not per object. MDOs are OSv2-only, and only
**column-wise** ones exist: "distinct subsets of properties for an object type can
be integrated from different datasources." Row-wise MDOs (union-like) are explicitly
not supported — restricted views cover those cases.

Two more rules make the join well-defined:

> "a specific property of an object type must come from **one—and only one—of the
> input datasources** (except for the **primary key property, which must exist in
> every input datasource** to join all datasources)."

And the permission behaviour is a direct consequence: "If a user lacks `Viewer`
permission on some of the input datasources, the properties mapped from those
datasources will appear as `null`… the user will still be able to view the schema."
Same for missing keys: "primary keys that do not exist in a datasource will have the
properties that are mapped from that particular input datasource displayed as
`null`." Absence and denial produce the same result, by design.

So the full cardinality picture:

| direction | rule |
|---|---|
| datasource → object type | **at most one** |
| object type → datasource | **1 to 70** |
| non-PK property → datasource | **exactly one** |
| PK property → datasource | **every one of them** |

### What the MDO screenshots add — the Datasources tab has three sections

`multi-datasource-objects-add-new-datasource.png` and `-backing-datasources.png` are
before/after shots of the same tab, and they carry more than the prose.

The object type's left nav here reads **Overview, Properties (3), Security,
Datasources, Capabilities, Interfaces, Automations** — seven entries, where the
`create-object-type` capture had nine (Materializations and Usage additionally,
greyed). Consistent with materializations being optional in OSv2.

**Section 1 — Backing datasource.** "Configure the backing datasource for this object
type. **The datasource is required, but can be changed.**" With one datasource
(`test_a`, shown with its Compass path `/Users/…/test/datasets`) the control is
**Replace**. After **+ Add new backing datasource**, there are two entries (`test_a`,
`test_b`), **Replace disappears**, and each row gets an **×**. One is replaced; many
are removed individually.

**Section 2 — Edits.** "Allow end users or applications to make edits to objects of
this type." A single toggle, **off** in both shots. This is the `Edits: Disabled`
field from the Overview page, and its home is the Datasources tab — editability is a
property of the *backing*, not of the type's metadata.

**Section 3 — Object Storage V2.** "Object Storage V2 is the backend service that
stores and serves information about objects." One entry — **Object Storage V2**,
subtitled "**Default object data store**" — carrying two status chips: **Data:
`Indexing not started`** and **Schema: `Up to date`**. Below it, **+ Add new data
store**.

That last button is the diagram's `Object Databases { OSv2, OQL, … }` box made
operable. **An object type can be indexed into more than one object database**, each
with its own independent data and schema liveness, and OSv2 is the *default* member
rather than the only one. It also matches `funnel-batch-pipelines`' "an indexing job
**per object database**" and `direct-datasources`' liveness readout (Data / Schema /
Latest edit).

Finally, the error state: adding `test_b` flips the object type badge from a green
tick to a **red error**, and the header from "24 edits" to "**25 edits ❗1**". The
prose says why — the **Map primary key** helper "will appear and prompt you for a
column with values matching the primary key of the object type." A new datasource is
invalid until its primary key column is mapped. The staging model catches it before
Save, not after.

### Indexing — the four-job pipeline

A Funnel batch pipeline is four Foundry build jobs in sequence:

1. **Changelog** — "Funnel automatically computes the data difference for all
   datasources… then creates intermediate changelog datasets… Changelog datasets
   receive `APPEND` transactions that contain the data difference."
2. **Merge changes** — "all changelog datasets… and any recent user edits coming
   from Actions are **joined by the object type's primary key**."
3. **Indexing** — "an indexing job **per object database** to convert all rows…
   into a format compatible with the object databases configured for the object
   type… converted to index files; these files are stored in a separate index
   dataset."
4. **Hydration** — "object databases must prepare the indexed data for querying…
   downloading the index files from the dataset into the disks of the OSv2 database
   search nodes."

All intermediate datasets are "owned and controlled by Funnel, and thus are **not
accessible to users**."

**Two pipelines coexist.** A **live pipeline** "updates object types in production
with new data" and runs when datasources update — plus "if user edits on objects
are detected, live pipelines will run **every six hours** regardless of any explicit
backing dataset update; this ensures that user edits are persisted." A
**replacement pipeline** is provisioned "when the schema of an object type changes",
runs in the background, and swaps in after its first success "without impacting the
live data being served."

**Incremental is the default.** "If 10 of those rows change in a new data update,
rather than reindexing all 100 objects… the Funnel batch pipeline will create a new
`APPEND` transaction in the changelog dataset that contains only the 10 modified
rows." Full reindex happens in three cases: **more than 80% of rows changed in one
transaction** (default threshold), a schema change requiring a replacement pipeline,
or a manual reindex from Ontology Manager.

For changelog datasets: "most recent transaction wins"; "Each transaction must
contain at most one row per primary key"; and a column named `is_deleted` "is **not**
treated as a deletion column by default" — it only counts if declared in legacy
OSv1 changelog metadata.

### Direct datasources [Beta]

The escape hatch from the pipeline: "**Direct datasources provide low-latency writes
into the Ontology**… They allow data applications to write directly to the Ontology.
Currently, only Pipeline Builder is a supported writer application." They "trade
throughput for more robust Ontology writing capabilities, including user edits on
streams and time-based ordering."

Ordering is explicit and optional: a **source timestamp property**, "a user-supplied
timestamp property that should represent the time an object was created or updated.
Its value is used to **drop out-of-order direct writes**. If a write for an object
arrives with a source timestamp value earlier than the object's existing value, the
write is dropped." It can only be configured on a type that already has a timestamp
property.

Liveness is a first-class readout on the Datasources tab: **Data** (last direct
write), **Schema** (whether current), **Latest edit**.

### Migration mechanics worth keeping as concepts

Even though we will never run this migration, three of its concepts are reusable
and one is a warning:

- **Transition windows** — "set preferred time windows for a safe migration; for
  instance… when an object type's use case has minimal activity."
- **Soak period** — dual-index old and new, "in increments of days, up to a maximum
  of **14 days**", during which "the Foundry Ontology backend will automatically
  route all queries to OSv2 and any request to OSv1 will be **rejected**", but an
  abort reverts instantly. Setting it to 0 deletes the old index immediately.
- **Incompatible usage**, in three grades, each with its own banner: **blocking**
  (migration refused), **non-blocking** ("will not block initiating a migration but
  will fail after the object type is migrated"), and **none** (green tick, ready).
- The warning: "Any changes to Ontology definitions… that would result in a Funnel
  replacement pipeline will **abort any ongoing migrations**. Ensure that the object
  type schema remains stable for the entire migration."

---

## 5. Data Lifetime — and why it is *not* transactions

Pages read in full: `mirror/data-lifetime/overview.md`, `core-concepts-data-lifetime.md`,
`deletion-policies-implications.md`, `getting-started.md`, `policy-overrides.md`,
`FAQ.md`. Images read: `createanewpolicy.png`, `deletion-hl-logo.png`.

**Transactions and Data Lifetime are different layers.** A transaction is what a
write *is*. Data Lifetime is a governance service that decides **when a transaction's
data gets destroyed**. It operates *on* transactions; it is not another name for
them.

There are in fact **three** layers, and the pages distinguish two of them explicitly:

| layer | what it does |
|---|---|
| **Transaction** | the atomic change to a dataset's files (`data-integration/datasets`) |
| **Retention policy** | deletes transactions by rule — **not lineage-aware** |
| **Data Lifetime policy** | deletes transactions by rule — **lineage-aware**, propagates downstream |

> "**Retention policies**, defined in the Retention application, are applied to
> dataset transactions based on specific rules and can systematically delete data.
> However, these policies **are not** lineage-aware and thus do not propagate to
> downstream datasets."
>
> "**Data Lifetime policies** are distinct from retention policies. The
> *lineage-aware* deletion mechanism of Data Lifetime policies ensures that when a
> transaction is deleted, **all downstream transactions derived from that transaction
> are also removed**. A key distinction… is that Data Lifetime suggests that policies
> be applied to either **root or otherwise upstream datasets**, while policies managed
> through Retention do not have this requirement."

And the two can disagree, with a stated resolution that is *reporting*, not
behaviour: "if a retention policy is meant to delete a specific transaction on
Tuesday, and Data Lifetime is set to delete that same transaction on Wednesday, Data
Lifetime will **report Wednesday** as the deletion date… **This remains true even if,
realistically, the transaction will be deleted on Tuesday** based off of the
retention policy." Two governance services, no arbitration between them, and the UI
can lie about which wins.

### This closes the `DELETE` loop

`data-integration/datasets` said: "committing a `DELETE` transaction **does not
delete the underlying file** from the backing file system—it simply removes the file
reference from the dataset view," then pointed at retention policies to "remove data
in transactions which are no longer needed."

So the separation is deliberate and complete:

- **`DELETE` transaction** → removes from the *view*. Reversible; the data is still
  there; older views still resolve.
- **Retention / Data Lifetime** → removes from *storage*. Irreversible.

**Nothing in the transaction vocabulary destroys data.** Destruction is exclusively a
policy decision, made by a separate service, by a separately-permissioned role.

### The two policy types

> * "**Fixed deletion date:** By default, all transactions in a root dataset are
>   assigned the same specified deletion time (unless a cutoff date is configured)."
> * "**Latest view only:** All transactions in a root dataset that are *not* in that
>   dataset's current view will be assigned a deletion date equal to the current time.
>   This means that all historical transactions will be marked for immediate deletion,
>   while transactions in the latest view of the dataset will not be assigned a
>   deletion date."

**Fixed deletion date**, with a cutoff: "only the transactions that were committed
before that cutoff will have a deletion date assigned; any later transactions will
*not*." Applies "across all branches."

**Latest view only** has per-transaction rules on arrival, and the third one is the
mechanism:

> * "If the transaction is on a **branch not covered** under the policy, it will be
>   assigned a deletion date that **matches the transaction's creation date**."
> * "If the transaction is on a branch covered by the policy and **does not create a
>   new view** (an updated transaction), it will **not** receive a deletion date."
> * "If the transaction is on a branch covered under the policy and **creates a new
>   view (a SNAPSHOT transaction)**, it will not be assigned a deletion date. Instead,
>   **the dataset will be re-evaluated to place deletion dates on transactions in the
>   previous view(s)**."

**A SNAPSHOT is the event that makes the previous view deletable.** That is the exact
counterpart of "the number of views is equal to the number of `SNAPSHOT`
transactions" — a SNAPSHOT opens a view *and* condemns the one before it.

### Inheritance, and overrides that break it

> "all downstream datasets and transactions will **inherit the deletion date or its
> absence** from their parent transactions."

Inheriting *absence* is as real as inheriting a date — that is what makes the graph
consistent rather than merely propagating deletions.

> "A **policy override** is a policy with the unique attribute of **breaking the
> inheritance of deletion dates from upstream transactions**."

Two forms, with a stated use case: "successful aggregations or minimizations render
datasets exempt from deletion requirements."

- **Override inherited policies** — substitute a different policy, downstream too.
  With a limit: "if a downstream dataset is already subject to a different policy (if
  it acquired a policy through another lineage, for example), the policy change will
  not apply." First policy through a lineage wins.
- **Override without superseding policy** — "effectively **remove any deletion dates**
  for all transactions in the dataset, along with any downstream datasets."

### Roles — deletion is separately permissioned

Three roles, and creating a policy is not something a dataset owner can do:

| role | can |
|---|---|
| **Namespace Viewer** | "View retention policies" |
| **Dataset Editor** | "Set/remove retention policies on/from datasets" |
| **Data Governance Officer** | "Create/update/delete retention policies for namespaces they can view. Set/remove retention policies **and policy overrides** for datasets they can view." |

Only the DGO can create, update or delete a *policy*; a Dataset Editor can only apply
or remove an existing one. Overrides need DGO — "applying override policies requires
an **even higher access level**."

The page frames the whole feature as dangerous, twice: "a valuable yet **highly
sensitive** data governance tool that can lead to **severe consequences if misused**",
and "Changes to deletion policies can cause **significant impacts on data integrity**,
including accidental data loss **or retaining data longer than legally allowed**."
Both directions are failures. Integration with **Checkpoints** is recommended, "an
application that allows organizations to require **user justifications** for actions."

### What the images add

**`createanewpolicy.png`** — the Create new policy dialog, headed "Creating policy
scoped to 📁 **Test**". **Policies are scoped to a folder**, which is what "namespace
level" means in the prose. Fields: Policy name (required), Policy description, then
**Policy type** as two radio *cards* with their own one-line explanations — "Marks
transactions for deletion at a specified date and time" / "Marks all but the most
recent dataset view of a dataset for deletion". Then **Deletion date (required)** with
an explicit **timezone selector (`EDT`)**, and **Cutoff date**, whose helper text
appears nowhere in the prose:

> "If specified, the policy will not delete transactions that were committed after
> this date. **Transactions in downstream datasets will still be deleted if they
> inherit data from an upstream transaction that is scheduled for deletion because of
> the policy.**"

A cutoff protects the dataset it is set on. It does **not** protect downstream — the
inheritance runs through it. That is the sharpest edge in the whole feature and it
exists only in a screenshot.

**`deletion-hl-logo.png`** — the **Deletions** tab, beside **Policies**: "Explore all
transactions which have been marked for deletion… both transactions which are
**scheduled for deletion in the future** and transactions which have **previously
been deleted**." A single table, five columns:

`TIMESTAMP · DATASET (name + Compass path) · TRANSACTION (truncated RID) · DELETION CAUSE · STATUS`

**DELETION CAUSE is a link to the named policy** — every deletion is attributed to
the rule that caused it. **STATUS** has three values, colour-coded: `Deleted` (red),
`Pending deletion` (amber), `Scheduled` (blue). Filters: **Time range** and
**Transaction ID**.

Three states, not two. "Marked" and "gone" are different, and the gap is real — per
the FAQ, "the underlying data stores used by Foundry (such as S3) often take time to
delete. Typically, **the longest duration you can expect for data to be fully deleted
is around 30 days**."

### Three more facts from the FAQ

- **Transactions have RIDs, and here is where you find one**: "navigate to the
  relevant dataset. Select the **History** tab, then choose the specific transaction…
  Scroll to the end of the **Transaction details** section to view the **Transaction
  RID** field." This confirms `ri.foundry.main.transaction.<uuid>` is user-facing.
- **Datasets only**: "Currently, Data Lifetime policies can only be applied to
  datasets" — not media sets, not model assets.
- Policy evaluation and transaction deletion are **rate-limited**, deliberately.

---

## Connects to

- **`ontology/core-concepts`** — "Dataset → Object type, Row → Object, Column →
  Property". This reading is the left-hand side of that analogy in full. The
  analogy is *tighter* than it looked: a column has a field type, and the property's
  base type is that field type minus `Map` and `Binary`.
- **`create-object-type`** — every one of its four open questions is answered here.
  "A single datasource can only be used to back one object type" now has a reason:
  Funnel joins all of a type's changelogs on that type's primary key, so a datasource
  shared between two types would be indexed twice against two different keys.
- **`object-permissioning`** — the two arrows out of `Datasets` in the architecture
  diagram (definition vs data) are the object-type/object permission split, drawn.
  Also: multi-datasource object types are an OSv2 capability, listed under "more
  granular object permissions… including column/property level permissions."
- **`virtual-tables-and-dynamic-security`** — "objects backed by the virtual table
  will reindex" now names a specific thing: a Funnel replacement pipeline.
- **`object-edits/materializations`, `object-edits/how-edits-applied`,
  `object-edits/user-edit-history`** — referenced repeatedly, **all unread and now
  clearly next**. `how-edits-applied` specifically covers "resolve conflicting user
  edits and datasource updates", which is the one behaviour this reading leaves open.
- **`data-integration/branching`, `views`, `media-sets`** — unread; each is a
  sibling concept named here.
- **`retention/overview`, `retention/manage-retention-policies`** — the *other*
  deletion service, not lineage-aware. Referenced by both `datasets` and
  `data-lifetime`; unmirrored. Needed before building any deletion at all, because
  Data Lifetime alone does not explain how a `DELETE` transaction's files leave disk.
- **`data-lineage/overview`** — Data Lifetime's whole premise is a lineage graph, and
  we have none. Unmirrored.
- **`checkpoints/overview`** — "require user justifications for actions in the
  platform." A general governance primitive met here, applicable well beyond deletion.
- **Our `object_types.source_table`** — a table name in a text column. It is the
  datasource pointer, with no RID, no schema, no transactions, no branch, and no
  uniqueness constraint against a second type claiming the same table.
- **Our `object_sets`** — permanent + dynamic. Static and temporary don't exist.
- **Our `objectTypes/index.ts`** — `PropertyType` is `text | number | boolean | date
  | media_reference | vector | geopoint`. Seven values where Foundry has 13 + 9 +
  arrays. `coerceValue` accepts `''` for text, which OSv2 rejects outright.

## Open questions

1. **How are conflicting user edits and datasource updates resolved?**
   `funnel-batch-pipelines` says the merge join is by primary key and explicitly
   defers: "this behavior is not related to how user edits and datasource update
   conflicts are handled", pointing at `object-edits/how-edits-applied`. Unmirrored.
2. **What does a dataset schema look like as a document?** The pages describe the
   fields it holds and show it in the UI, but no page in this set gives the JSON.
   `dataset-preview/csv-parsing` and the `options`/`customMetadata` blocks are the
   nearest, both unread.
3. **Is there a documented API for opening/committing a transaction?** "Git for
   data" implies one; nothing in these pages shows it. `data-integration/foundry-s3-api`
   and the platform API docs are candidates.
4. **How does a plain Retention policy work?** Data Lifetime is defined against it
   ("not lineage-aware"), but `retention/` is unmirrored, so half of the deletion
   story is a reference to a page we have not read.
5. **Where does the lineage edge come from?** Data Lifetime propagates "to all
   downstream transactions derived from that transaction" — so something records
   *derived from*. In Foundry it is presumably the build (inputs → output), since
   Dataset Preview shows "Updated via" as a link to the producing job. Not stated on
   any page in this set.

## Decisions taken from this reading

Recited to the operator and agreed 2026-08-06. Built: migrations 391–395,
`packages/ontology/src/datasets/`, `/datasets`, `scripts/check-datasets.mjs`.

1. **RID is a generated column, not a second identity.**
   `ri.<service>.<instance>.<type>.<row uuid>`, derived — so it cannot drift,
   cannot be forged, and needs no backfill. **Only attested forms are used.** At
   the time of writing that was five; the operator then found four more, so see
   **`rid-grammar.md`** and migration 396 for the current set. Link types and
   shared properties are still deliberately without one.
2. **A dataset is a registry row pointing at a real table**, not a table itself,
   and not a universal jsonb store. The justification is Foundry's own sentence:
   the files "are not stored in Foundry itself. Instead, a mapping is maintained
   between a file's logical path in Foundry and its physical path in a backing
   file system." Ours is a table in a `datasets` schema; theirs is S3. Two
   schemas, mirroring the architecture diagram's two layers.
3. **Files are the unit, not rows.** Every transaction type is defined over
   files, and the upload rule keys off a filename. Model it coarser and APPEND
   and UPDATE become the same operation, which makes "a commit that overwrites an
   existing file will fail" unenforceable.
4. **Nothing in the transaction vocabulary destroys data.** A DELETE writes a
   tombstone. Destruction is Retention and Data Lifetime — a separate service
   under a separately-permissioned role, and we have neither.
5. **The view algorithm and the commit rules live in SQL**, not TypeScript: a
   trigger is the only place a rule cannot be walked around. TypeScript holds the
   grammar a surface needs to render and pre-validate a schema.
6. **A view can be anchored to a transaction, not only to a clock.** The
   timestamp form is the one the page defines, and it is kept; but a JS `Date`
   truncates microseconds and drops the very transaction it names, so
   `dataset_view_from` is what a UI should use. Foundry's own surfaces anchor to
   transactions too (branch-from-transaction, filter-by-Transaction-ID).

### What the build found that the reading did not

- **The SQL schema validator passed a DECIMAL with no precision.**
  `jsonb_typeof` of a missing key is NULL, and `NOT NULL` is neither true nor
  false, so it rode through. Caught by the migration's own negative assertions.
  Same lesson as migration 366: an assertion that checks the wrong thing reads
  exactly like a passing one.
- **`can_write_dataset` had a cross-tenant hole.** It leaned on RLS to have
  already filtered the row, then `dataset_materialize` was made SECURITY DEFINER
  — which bypasses RLS — leaving `auth_role() IN ('owner','admin')` as the only
  test. An admin of any organization passed. Fixed in 395 and pinned by the
  guard. The mandatory control has to be restated wherever a discretionary check
  might end up alone.

## Still open, and deliberately not built

- **Object types are not yet bound to a datasource.** `object_types.source_table`
  is still a bare text column with no constraint. The cardinality rules above
  (one object type per datasource, 1–70 the other way, PK in every datasource,
  streaming XOR datasets) are understood and unimplemented.
- **Nothing writes rows yet.** There is no upload, and no ingest.
- **The OSv2 data restrictions are not enforced.** They belong at index time, and
  there is no index.
- **Retention, Data Lifetime, and lineage.** All three are understood; all three
  govern things that do not exist yet.
