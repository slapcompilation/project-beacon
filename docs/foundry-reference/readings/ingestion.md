---
verify: strict
---

# Getting data in — manual upload, and the Data Connection perimeter

**Pages read in full: 65.** The manual-upload path (`compass/manually-upload-data`,
`dataset-preview/overview`, `dataset-preview/csv-parsing`,
`dataset-preview/dataset-preview-faq`, `data-integration/datasets`); the whole
conceptual half of `data-connection/` (overview, `_index`, core-concepts,
initial-setup-overview, architecture, connection-security, permissions, faq,
foundry-worker-vs-agent-worker, set-up-source, set-up-direct-connection,
source-exploration, sources-in-python, oidc, set-up-sync, file-based-syncs,
syncs-troubleshooting, optimize-jdbc-syncs, media-set-sync, set-up-streaming-sync,
set-up-agent, agent-worker, agent-proxy, listeners-overview, webhooks-overview,
export-overview, external-functions, push-based-ingestion);
`data-integration/source-type-overview` and `connecting-to-data`; and 30 `api/`
pages — the whole `connectivity-v2` Connection / FileImport / TableImport family,
the `datasets-resources` files and transactions family, two `datasets-v2` pages
read to check the generation, and `general-overview-limits`.

**Images, counted rather than asserted: those 65 pages reference 89 distinct
images and all 89 were parsed.** The count was produced by extracting every
`./images/…` reference from the 65 files and diffing that set against the set of
images actually opened; the two sets matched exactly, with nothing referenced and
unparsed and nothing parsed that these pages do not reference. The `api/` pages
contribute zero to that denominator — they carry no figures and there is no
`api/images/` directory, which is a measurement rather than an omission.

**Not read, and named so the debt is not silent:** `agent-configuration-reference`,
`webhooks-reference`, `external-transforms`, `external-transforms-legacy`,
`export-tasks`, the eleven `listeners-*` provider pages, `agent-proxy-runtime`,
`agent-worker-runtime`, `agents-troubleshooting`, `troubleshooting`, the two
`marketplace-*` stubs, and the whole of `available-connectors/` (193 pages). All of
them sit behind decisions §6 and §8 take, which is not to build the thing they
document.

---

## 1. There are two manual-upload surfaces, and only one of them is ours

They are not two views of one flow. The Compass page uploads into a **folder** and
opens three branches; the Dataset Preview page uploads into an **existing dataset**
by drag and drop and opens none.

> In Dataset Preview, you can upload files of the following types directly into a dataset

— dataset-preview/overview.md

Five types follow: `.csv`, `.tsv`, `.xls`, `.xlsm`, `.xlsx`.

The Compass branches are *Upload as media set (recommended)*, *Upload to a dataset
without a schema*, and *Upload as a raw file without modifying the extension*. Its
Write mode control — Transactionless or Transactional — reads as though it governs
all three, and the image says otherwise: in
`compass/images/configure-upload.png` the Write mode radio pair sits underneath a
**Schema** section the prose never mentions at all, offering *Primary media format*
and *Additional media input formats (optional)*. Both fields are media-set fields,
Transactionless wears a blue Recommended tag, and the bullets the prose flattens
into two comma-runs render as three items and four. So Write mode belongs to the
media-set branch. **We build neither branch**: we have no media sets, and a dataset
without a schema has nothing our indexer can read.

The Compass page also carries the only governance sentence in the whole corpus
read here, and it is worth keeping where a future reader will meet it:

> All data should be approved for the purpose of your use case (no personal data, for example) or notional data.

— compass/manually-upload-data.md

## 2. The upload endpoint publishes three modes, and it runs the transaction itself

`api/datasets-resources-files-upload-file.md` is the authority. `POST
/api/v1/datasets/{datasetRid}/files:upload`, with `filePath` required and
`branchId`, `transactionType` and `transactionRid` optional.

> By default the file is uploaded to a new transaction on the default branch

— api/datasets-resources-files-upload-file.md

> By default the TransactionType will be `UPDATE`, to override this

— api/datasets-resources-files-upload-file.md

> This is useful for uploading multiple files in a single transaction.

— api/datasets-resources-files-upload-file.md

Three modes, then: no branch and no transaction opens and commits one on `master`;
a branch opens and commits one on that branch, `UPDATE` unless told otherwise; a
transaction rid puts the file on an already-open transaction and leaves committing
to the caller.

**The endpoint owns the whole lifecycle, and its error list proves it.** A pure
write-the-bytes endpoint would have no business declaring
`CreateTransactionPermissionDenied`, `CommitTransactionPermissionDenied`,
`AbortTransactionPermissionDenied` and `OpenTransactionAlreadyExists`, and this one
declares all four. An upload can therefore fail because it could not open a
transaction, because one was already open, because it could not commit, or because
it could not abort after failing.

One caution I am recording rather than smoothing over, because it weakens the
argument above: `create-dataset`'s error list names transactions and branches its
own request and response never mention, so an api error list is partly a
family-wide union. On `upload-file` the prose corroborates the lifecycle, so the
conclusion stands; on a page without corroborating prose it would not.

And the view behaviour the endpoint promises is the one our reader already
computes:

> If the file already exists only the most recent version will be visible in the updated view.

— api/datasets-resources-files-upload-file.md

## 3. What picks the transaction type, and the case nobody documents

The rule is stated once, on the Dataset Preview page, and it is keyed on two things
at once:

> If the filename and schema of the new file are identical to a previous upload, you can

— dataset-preview/overview.md

> in the existing dataset. If the filename is different from previous uploads, you can

— dataset-preview/overview.md

The sentence breaks across those two fragments because link markup sits in the
middle of it; the words inside the links are *update data* and *append data*, and
their hrefs are the `#update` and `#append` anchors of the datasets page. **The
transaction type is carried by the link targets, not by the prose.**

Same name and same schema selects `UPDATE`. A different name selects `APPEND`.
This is not arbitrary — an `APPEND` that overwrites a path already in the view
fails at commit, which is a rule 393 already holds and 638 gave an error name to.
So re-uploading a filename *must* be `UPDATE`.

**Same filename, different schema is undefined by every page read here.** I looked
for it and it is not answered. Decision 4 below picks an answer and says it is ours.

The datasets page attaches a warning to `UPDATE` that a build path has to respect:

> An `UPDATE` transaction that overwrites the contents of existing files will break the append-only requirement for

— data-integration/datasets.md

The sentence continues past the mirror's line break with the consequence, which is
that downstream pipelines fall back to snapshot processing.

## 4. Parse parameters are stored in the schema, and we store none of them

> These parameters are stored in the schema of a dataset.

— dataset-preview/csv-parsing.md

That is a structural fact, not a UI detail, and our `dataset_schemas` row carries
only a field list. The page then enumerates twelve options in a table:
`parser`, `nullValues`, `fieldDelimiter`, `recordDelimiter`, `quoteCharacter`,
`dateFormat`, `skipLines`, `jaggedRowBehavior`, `parseErrorBehavior`,
`addFilePath`, `addImportedAt`, `initialReadTimeout`. Exactly two are marked
required: `parser` and `nullValues`.

Three enumerated value sets come with it — `parser` is one of `CSV_PARSER`,
`MULTILINE_CSV_PARSER`, `SIMPLE_PARSER`, `SINGLE_COLUMN_PARSER`;
`jaggedRowBehavior` is `THROW_EXCEPTION` or `DROP_ROW`; `parseErrorBehavior` is
`THROW_EXCEPTION` or `REPLACE_WITH_NULL`. **Both behaviour options default to
throwing.** Foundry's documented default on a malformed row is to fail loudly, not
to null-fill, and that is the single most important sentence in this section for
anyone writing the parser.

**The table and the example JSON on the same page disagree, in both directions.**
The JSON carries `charsetName` and `addFilePathInsteadOfUri`, which the table never
lists; the table marks `nullValues` required, and the JSON omits it; the table's
default for `skipLines` is 0 and the JSON sets 1. The table is the enumeration and
therefore wins on the set, by this repository's own tie-break. The JSON reads as a
realistic single-header-row example rather than a rendering of the defaults.

A fifth column of that table, which I nearly missed, scopes each option to
particular parsers: `fieldDelimiter` applies to three of the four parsers,
`recordDelimiter` and `quoteCharacter` to two, and several apply to all.

Inference is explicitly not a guarantee:

> Foundry will use inference to suggest a sensible set of parameters for a given dataset, but results should be validated and changes made if necessary.

— dataset-preview/csv-parsing.md

No page in this corpus documents a type-inference *algorithm*. What is documented
is coercion behaviour afterwards, which is the part above.

The FAQ names two concrete ways inference fails, and both are worth a test case:

> the schema inference will fail, and you cannot use the Schema Editor to create a valid schema.

— dataset-preview/dataset-preview-faq.md

That one is nested double quotes with embedded newlines inside a quoted field. The
other is a dataset assembled from several files where some carry more columns than
others. Its documented remedy — ignore jagged rows, or hand-write a schema and
switch to the raw Spark reader — comes with a limit that stops anyone expecting
Parquet behaviour from a text file:

> The troubleshooting steps do not replicate the functionality of the `mergeSchema` option available for raw Parquet datasets

— dataset-preview/dataset-preview-faq.md

## 5. Three rules Foundry publishes that our dataset layer does not hold

Found by reading the api against the live catalog, before building anything.

**A file path may not begin with a slash.**

> Paths are relative and must not start with a leading slash.

— api/datasets-resources-files-upload-file.md

Refused as `InvalidFilePath`. Our check on `dataset_files.logical_path` tests only
that the trimmed path is non-empty. A fact about one row, so a CHECK.

**A branch name may not look like a RID or a UUID.**

> Branch names cannot be empty and must not look like RIDs or UUIDs.

— api/datasets-resources-files-upload-file.md

Refused as `InvalidBranchId`. We hold the non-empty half and not the second. Also a
CHECK.

**One rule is held by two indexes, and that one is mine.** 392 created a unique
partial index over the open transaction of a branch, citing the sentence that every
branch has at most one. 638 created a byte-identical second index under a different
name, 246 migrations later, for the same rule — it was giving the api's error names
to a lifecycle and did not check whether the constraint already existed. Nothing
misbehaves; a violator simply gets whichever index name Postgres reports first,
which makes the error message a coin flip. Corrected forward by dropping the later
one, because the earlier carries the citation.

The published invariant behind both:

> A branch of a dataset can only have one open transaction at a time.

— api/datasets-resources-files-upload-file.md

Two rules we already hold and should not re-derive: `FileAlreadyExists` is our
unique on transaction and logical path, and the append-overwrite refusal is 393's
commit trigger.

**No page bounds an upload.** I checked `api/general-overview-limits` in full: it
publishes a 10,000-request-per-minute rate limit and an 800-request concurrency
limit, both global per user, and nothing about file size, row count or column
count. The only byte figure anywhere nearby is a 200 MB cap on *attachments*, a
different resource. Borrowing it would be inventing a constraint.

## 6. A Source is a connection to a system we do not have

> A **Source** represents a single connection to an external system

— data-connection/core-concepts.md

The api calls the same thing a Connection, and it is the api that enumerates the
set, so the api wins on the vocabulary: `ConnectionConfiguration` has exactly six
members — `s3`, `rest`, `snowflake`, `databricks`, `smb`, `jdbc`. A Connection
carries a parent folder rid, a display name, export settings, a worker
(`unknownWorker` or `foundryWorker`) and one of those six configurations, and every
secret field is an either-or of a stored secret name and a plaintext value.

A **FileImport**, which the prose calls a batch sync, names an output dataset and
branch, an `importMode` of `SNAPSHOT`, `APPEND` or `UPDATE`, a subfolder, and an
ordered list of filters. A **TableImport** takes `SNAPSHOT` or `APPEND` only — no
`UPDATE` — plus `allowSchemaChanges` and one of seven connector-specific configs.

The filter union has nine members: `pathMatchesFilter`, `pathNotMatchesFilter`,
`anyPathMatchesFilter`, `filesCountLimitFilter`, `changedSinceLastUploadFilter`,
`lastModifiedAfterFilter`, `atLeastCountFilter`, `fileSizeFilter`, and
`customFilter` — the last of which can be read and not written. The prose page
lists eight, in UI wording. The api enumerates nine, in wire wording, and is
therefore the set.

And the execution has a shape that connects straight to machinery we already run:

> Executes the FileImport, which runs asynchronously as a

— api/connectivity-v2-resources-file-imports-execute-file-import.md

It returns a build rid. **An import execution is a build**, which means if this is
ever built it hangs off `builds` and `job_specs` rather than growing a fifth
execution mechanism.

Those six are the api's union, not the product's catalogue. The connector page is
the wider list:

> application is intended to provide connectivity between Foundry and your systems. This page provides an overview of the available connectors.

— data-integration/source-type-overview.md

It groups them into filesystems and blob stores, JDBC sources, and further families,
naming Amazon S3, SFTP, SharePoint Online, HDFS and a long tail of databases, each
with its own page under `available-connectors/`. So the six api members are wire
shapes for configuration, and the catalogue of things one can actually connect to is
an order of magnitude larger.

**None of the six configurations is buildable here**, and that is the reason not to
build any of it: each names an external system reached through credentials, an
egress policy and a worker, and we have no external system, no credential store
shaped like theirs, and no worker. Building the tables without a connector would be
storage nothing reaches, which is the defect this repository has already counted
thirteen times.

## 7. The four sync modes are a documentation device, not a stored value

This is the finding most likely to have been got wrong, because the prose page
presents four named modes in bold headings and it would be natural to make them a
four-valued column.

> The following table documents known modes and the low-level settings required to achieve the desired behavior

— data-connection/file-based-syncs.md

Each mode is a pair of an import mode and a filter. Batch mirror is `SNAPSHOT` with
no filters; incremental mirror is `APPEND` or `UPDATE` with the
already-synced filter; trailing window is `SNAPSHOT` with that same filter. The api
confirms it structurally by storing `importMode` and `fileImportFilters` as two
separate fields and never naming a mode at all. **A `sync_mode` column would have
been invented structure**, and the page's own bold headings are what would have
justified it.

Two more facts from the same page, both real constraints rather than advice. Syncs
are transactional:

> If a sync fails at any point, the transaction is aborted and none of the files from that run are committed to the dataset.

— data-connection/file-based-syncs.md

And completion strategies — the mechanism that deletes source files after a
successful sync — are legacy, read-only, and cannot be configured on new syncs, so
they would be a deprecated design to copy.

## 8. The perimeter, and why each piece stays out

- **Agents** are a JVM program the customer installs inside their own network, with
  provisioning requirements measured in cores and gigabytes. That is infrastructure
  our substrate replaces. One exception is worth keeping: an agent *registration* is
  a Compass resource saved into a Project, so if agents ever existed they would be
  a filesystem resource with role grants, not platform config.
- **Listeners** mint an inbound URL, implement a provider's signing scheme, and land
  events in a stream, a compute module or a media set. We have none of those three
  landing places. The New listener wizard image carries a twelve-member set of
  provider presets, every one marked experimental, that the prose never lists.
- **Webhooks** are outbound request definitions bound to one source, consumed by
  Actions, Workshop, the OSDK and Functions. Real product, genuinely unbuilt, and
  ontology-shaped rather than infrastructure — the closest thing in this section to
  something we would build if a source existed.
- **Exports** pair a dataset or stream with a source and run as a build job. Same
  blocker as everything else here: no source.
- **Push-based ingestion** writes into a stream. Streams are not built.
- **Media set syncs** need media sets.

## 9. Two mechanical notes for whoever cites these pages next

**The mirror hard-wraps mid-sentence, and a reflowed quote fails the gate.** The
commit and abort endpoint descriptions both break in the middle of a clause, so a
quotation that reads correctly to a human cannot be found by `grep -F` against the
file. Every quotation in this reading was checked against its own page as a single
line for that reason, and two intended quotes had to be shortened. This is not the
mirror being wrong; it is a property of the source markdown that a citation has to
respect.

**One table in `dataset-preview/csv-parsing.md` is malformed.** The
`recordDelimiter` row is missing the pipe between its default and its
parsers column, so it renders as four cells where every other row has five. Anyone
parsing that table programmatically — the way `vocabulary.test.ts` parses the base
types table — hits it.

## 10. What building it turned up, which no green check could have

Recorded here because it is the most valuable thing this arc produced and it is
entirely mine.

A dataset view is a walk. It starts at the branch head, follows each
transaction's parent link backwards to the latest snapshot, and takes the newest
version of every path in between. The api states the boundary outright:

> an intermediate snapshot transaction will remove all files from the view

— api/datasets-resources-files-list-files.md

**Only one writer ever set that parent link.** 638's transaction entry point did;
five other functions insert a transaction row directly and leave it null, so each
of their transactions is a root and the walk from it reaches nothing earlier.
Those five are the Fusion sheet sync, the build job runner, the batch-run
recorder, the audit export and the materialisation builder.

**Every one of the five writes a snapshot**, and a snapshot is exactly where the
walk stops, so the missing link has never changed a view. The upload built here
is the first `APPEND` this repository has ever produced, and an append is
additive, so it is the first write that could tell the difference. Reading the
view back after two uploads showed the second file replacing the first instead of
joining it.

**The suite was green throughout, and the reason is worth keeping.** The dataset
answer-key test walks Foundry's own five-transaction example and gets the right
view at every step — because the test threads each transaction's parent to the
previous one by hand. It proves the algorithm. It cannot prove that anything in
production supplies what the algorithm needs, and nothing did. A test that
constructs its own input correctly will not notice that no caller does.

There is a second cost beyond uploads. An as-of-time view asks for the state at a
past moment, and from a root transaction the walk has nowhere to go, so it
returns an empty view rather than the state that was there. That was broken for
every dataset those five wrote.

791 puts the rule on the table as a trigger rather than in six call sites, and
repairs the history already written by chaining each branch's transactions in
commit order.

## Connects to

- `readings/datasets-rid-and-object-storage.md` — the layer this builds on. Its
  still-open list opens with a line that is about to stop being true, that nothing
  writes rows and there is no upload and no ingest.
- `readings/builds-and-schedules.md` — where a FileImport execution would land, and
  the reason §6 says an import is a build rather than a new mechanism.
- The indexer already reads a dataset through its current view rather than reading
  every row ever written, so multi-transaction datasets flow into the ontology
  correctly the moment uploads can produce them. That was verified against the live
  function, not assumed.

## Decisions (2026-09-10 — NOT YET READ BY A HUMAN)

1. **Build manual upload into an existing dataset; build no part of Data
   Connection.** The upload path is documented end to end, reaches a real user, and
   unblocks every stage downstream. Every Connection configuration names an external
   system we do not have. If that ever changes, the first buildable connector is
   `jdbc` or the Postgres table-import config, because the substrate already speaks
   it — recorded so the next reader does not re-derive it.
2. **Parse parameters become a validated jsonb column on `dataset_schemas`**,
   holding the table's twelve options with the table's defaults, because the page
   says they are stored in the schema. The JSON example's two extra keys are refused,
   the enumeration having won.
3. **The parser runs in SQL, not in the browser.** Delimiter, quote character,
   skipped lines and null values are presentation; jagged rows, parse failures, type
   coercion and the choice of transaction type are rules, and this repository's
   standing decision is that dataset rules live where they cannot be walked around.
   Splitting them across a boundary would put half the rule in a client.
4. **Same filename with a different schema is refused**, by a namespaced error, and
   the refusal declares itself as ours. No page answers it; `UPDATE` would silently
   leave the physical table's columns disagreeing with the file, and guessing
   `SNAPSHOT` would destroy data the user did not ask to replace.
5. **Only `APPEND` and `UPDATE` are reachable from the surface**, matching what the
   two documented cases produce. The stored transaction type keeps all four members,
   because `SNAPSHOT` and `DELETE` are written by other paths.
6. **The three unheld rules are corrected forward** — the leading-slash refusal and
   the branch-name shape as CHECKs, the duplicate index dropped.
7. **`nullValues` and `parser` are required**, as the table marks them, with
   `CSV_PARSER` and an empty null-value list as the defaults a fresh upload writes.

## Questions

1. **What does Foundry do with `.xls`, `.xlsm` and `.xlsx` after upload?** The five
   accepted types are enumerated once and the inference sentence covers only two of
   them. The other three are accepted and then unmentioned by every page here.
2. **Is there a documented type-inference algorithm anywhere?** Not in these 65
   pages. Ours will be ours, and the migration should say so.
3. **`arraySubType` or `arraySubtype`?** `data-integration/datasets.md` writes the
   first and the Dataset Preview FAQ's worked schema writes the second. We already
   use the first, which is the page 392 cited, so nothing changes — but a reader
   meeting the FAQ alone would pick the other.
4. **Does the default upload mode commit?** The branch-scoped sentence says created
   and committed; the default sentence says only that the file goes to a new
   transaction. The view promise only makes sense if it commits, and the page does
   not say so.
