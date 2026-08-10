# Reading — virtual tables, and where dynamic security is not

Chasing two open questions from `ontology-core-concepts.md`. One is answered
decisively; the other is not, and the operator's lead turned out to be a
different thing entirely.

Pages read in full:
- `mirror/architecture-center/rubix.md` — "The Rubix substrate"
- `mirror/data-integration/virtual-tables.md` — "Virtual tables"

Images: `rubix.md` references `rubix-k8s.png` and `rubix-security.png` (mirrored,
illustrative only — a Kubernetes diagram and a feature list). `virtual-tables.md`
references eight screenshots of the registration UI; they show the flow the prose
already describes.

---

## Rubix does NOT answer "what is dynamic security"

Worth stating plainly because the name suggests otherwise. Rubix is the
**infrastructure substrate**, not an ontology concept:

> "AIP, Foundry, and Apollo all operate within a hardened, autoscaling, highly
> available implementation of Kubernetes known as Palantir Rubix."

What the page actually covers: ephemeral compute nodes — "nodes in Rubix
environments cannot live longer than 48 hours"; workload isolation and enforced
encryption; accreditation targets — "FedRAMP High, DOD DISA IL-5/IL-6, and CMMC";
blue/green rollout driven by Apollo; and "build once, run anywhere" across AWS,
Azure, GCP, Oracle and on-premises.

None of it concerns objects, properties, links, or who may read which row. It is
the layer our Postgres and RLS sit *below* conceptually — a deployment substrate,
which we do not have and do not need at this stage.

**So the question stays open.** "Dynamic security" appears exactly **once** in
the entire mirror — the sentence in `ontology/_index.md` listing kinetic elements
— and is never defined.

Candidates, none read yet:
- `security/markings.md`, `security/property-security-markings.md` — mirrored
- `platform-security-management/manage-granular-policies` — mirrored
- **`object-permissioning/` — 8 URLs, NOT MIRRORED.** `core-concepts` links it for
  Roles ("the central permissioning model in the Ontology"), so this is the most
  likely home and the clearest gap in the mirror.

---

## Virtual tables — answered, and one line changes our model

> "**Virtual tables** allow you to query tables in supported data platforms
> without first storing the data in a Foundry dataset."
>
> "A virtual table acts as a pointer to a table in a source system outside of
> Foundry."

**A virtual table is defined by exactly two things:**

1. "A *connection* to the source storage system (for example, a source URL or
   credentials). This connection is established by setting up a source in
   Foundry's data connection application."
2. "A *locator* which identifies the table in the source system (for example, the
   database, schema, and table name)."

And: "As with any resource in Foundry, virtual tables are governed by Foundry's
security and permissions model."

### The decisive line for the ontology

> "## Configure objects backed by virtual tables
>
> You can configure objects backed directly by virtual tables in **Ontology Manager**."

So the answer to "what does mapping a virtual table look like versus a dataset"
is: **at the Ontology Manager it looks the same.** An object type's backing
datasource is either a Foundry dataset or a virtual table; the difference is where
the bytes live, not how the object type is defined.

### Indexing, stated outright

> "Any objects backed by the virtual table will **reindex** automatically when
> source updates are detected."

Foundry **indexes objects** off their backing datasource. This is the same
mechanism implied when we removed `shape_registry` — Foundry can answer "what uses
this" because it indexes. Here the index is over object *data* rather than
resources, and it is what makes an object type over an external table possible at
all.

### Supported sources and formats

Amazon S3, OneLake/ADLS Gen2, BigQuery, Databricks, Google Cloud Storage,
Snowflake (all generally available); Foundry managed Iceberg is beta. Formats are
Avro, Delta, Iceberg, Parquet for the blob stores; Table, View, Materialized View
for the warehouses. Iceberg needs a catalog (AWS Glue, Horizon, Object Storage,
Polaris, Unity).

Registration is **manual**, **bulk** (tabular sources), or **automatic** — the
last creating a Foundry project whose "folder hierarchy will mirror the structure
of the source system", periodically updated.

### Update detection

Polls the source on a schedule. Where the format supports versioning (Delta,
Iceberg) Foundry detects real changes; "If versioning is not supported, every poll
is treated as a potential update, which may result in unnecessary downstream
builds." It controls *when* a build triggers, not whether it is snapshot or
incremental.

### The trade, in their words

Benefits: no duplicate storage, pushdown to the source, "data is queried directly
upon use, without the need to synchronize data or consider potential for data
staleness".

Drawbacks: "Interactive performance may be slower"; compute may rise with
interactive querying; and "Virtual tables do not benefit from Foundry dataset
capabilities such as dataset versioning or branching."

---

## Connects to

- **`ontology/core-concepts`** — the dataset analogy. A virtual table is the same
  analogy with the table living elsewhere.
- **`ontology-manager/overview`** — where both backings are configured; next in
  the queue.
- **`data-connection/set-up-source`** — a virtual table's connection half.
- **Our `object_types.source_table`** — a bare table name. It carries the locator
  and nothing else: no connection, no source, no notion of external.
- **Our deleted `shape_registry`** — "reindex" is the same capability that makes
  an allowlist unnecessary.

## What this means for the build — proposals

1. **The backing is a pair, not a name.** `source_table` holds half of a locator.
   Foundry's model is *connection + locator*. Even with one local Postgres today,
   the shape should admit a source — otherwise adding one later is a migration
   through every object type.
2. **Do not build virtual tables now.** There is no Data Connection application,
   no source, and no external system. The reading records the shape so
   `source_table` is designed knowing what it will have to become.
3. **Indexing is a real dependency, not a nicety.** An object type over a
   datasource needs something that keeps objects in step with the table. Postgres
   can do that with a view for a local table; an external one would need polling.
   Worth naming before the first object type rather than after.

## Open questions

- **Still unanswered: what is dynamic security.** Mirror `object-permissioning/`
  (8 pages) next — `core-concepts` links it for Roles.
- Does an object type backed by a virtual table differ in Ontology Manager at all,
  or only in the datasource picker?
- What is "reindex" concretely — a materialization, a cache, a search index?
  `object-storage-v2` is likely, and unread.
