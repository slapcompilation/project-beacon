# Deep Dive 2 — Building Your First Pipeline (capture)

> Captured 2026-07. Source: full course text + ~50 screenshots from the user.
> Verbatim record first; Beacon mapping at the bottom. Unknowns are marked `OPEN:`.

## 0. Course frame

- A data pipeline = "a series of data processing steps that systematically transform raw data into
  valuable insights." Pipelines are "the backbone of the flow and transformation of data from its
  source form (raw) into a state that is operationally valuable."
- **The end-to-end reference diagram** (their own architecture picture): External System → **Data
  Connector** (or Code Repository "External Transforms") → raw Datasets → **Pipeline Definition** box
  containing BOTH paths — **Pipeline Builder** ("No-code to low-code pipeline definition") and **Code
  Repository** ("Pro-Code pipeline definition") — over raw → processed → clean → *ontology* datasets →
  a dashed **"Direct Ontology Output"** arrow → **Ontology** → **Application Building** (multiple
  Operational Applications). The two definition styles feed the *same* dataset chain.
- Pipeline Builder = low-code/no-code, "a suite of pre-built **Spark** modules."
- Target artifact of the course: transactions/products/customers → clean × 3 → `transactions x
  products` join → `transactions x customers` join → `customer lifetime value` → materialized outputs.

## 1. Project & folder setup

- Everything lives in a **Project**; recommendation for production: "a Project for each stage of the
  workflow." Training convention: one `Learning (<username>)` project + one folder per course.
- Files → **+ New project** → name, description, **Namespace** dropdown, Organizations, **Default
  role: Discoverer** ("Everyone from <org> can see the existence of this project and is granted the
  Discoverer role") → Create. Star the project to favorite it.
- **+ New** menu (searchable, categorized: All / Analytics & Operations / Application development /
  Data integration / Models / Ontology / Security & governance): Folder, Web link, Upload files,
  Accelerate ("Interact with LLMs and build Workflows"), **AIP Logic** ("Build composable no-code
  functions that can parse, modify, and expand your Ontology"), Artifacts repository, …

## 2. Create the pipeline

- Course data: `products_raw.snappy.parquet`, `customers_raw.csv`, `transactions_raw.json`
  (Marketplace product "Deep Dive: Building Your First Pipeline" as fallback delivery).
- Folder → New → **Pipeline Builder** ("Create data pipelines using built-in transformations") →
  **Create new pipeline** screen: Name + location; Configuration: **Batch pipeline** ("Builds and
  transforms entire datasets on each deploy. For data that is ingested periodically.") vs **Streaming
  pipeline** ("Transforms data continuously as new data is made available. For high frequency
  ingestion."); **Select batch compute**: **Standard** [Default] ("advanced expressions. Backed by
  Spark") / **Faster** [New] ("Speed up your pipelines and save compute. Backed by DataFusion.") /
  **External** [Beta] ("external compute platforms") → Create pipeline.

### Upload grammar (the three storage kinds)

Welcome panel: Add Foundry data / Add data to Foundry / **Upload from your computer** / Manually
enter data. The Upload dialog offers **three destinations**:
1. **Individual structured datasets (recommended)** — "the most basic representation of tabular
   data"; schema inferred (used for parquet + CSV; renamed inline to `products`, `customers`).
2. **Media set** — "media-specific capabilities for media files (e.g. audio, imagery, video, and
   documents)". *(The doc-processing walkthrough used this for PDFs; here it's shown but not used.)*
3. **Unstructured dataset** — "can store arbitrary files for processing and analysis. Structured data
   can be extracted … using Pipeline Builder or Transforms." (used for the JSON → node shows
   **"No schema"**; renamed via right-click → Rename).
- Node right-click menu: Open, Actions ▸, Rename, Copy RID / Copy, Paste, Duplicate / Read mode ▸,
  Color nodes ▸ / Hide nodes ▸ / **Packaging settings**, **Sampling strategies** / Remove node.
- Node hover radial menu (schema'd node): **Transform, Split, Join, Union, Use LLM, Generate,
  Explain, Add output**. No-schema node: Transform, Split, Generate, Explain, New dataset, New
  virtual table.
- Canvas toolbar: Tools (pan/select), Select, Remove, Layout (2 modes), Text, **Add data ▾** (from
  Foundry / Import to Foundry / Enter manually / "Browse & upload from your computer *or just drag
  and drop onto Builder*"), **fx Reusables ▾**, Transform icon group, **AIP group** (Use LLM /
  Generate / Explain), Edit.

## 3. Basic transform — clean products

- Select node → **Transform** → rename top-left to `clean products` (header: File/Settings/Help ▾ |
  org | **Batch** badge ✓).
- **Transform search panel**: left categories All / Popular / **Custom functions** / **UDFs** /
  Aggregate / Array / Binary / Boolean / Cast / Data preparation / Datetime / File …; middle result
  list; right detail pane with **version badge (v1)**, description, Parameters, **Examples** button.
  Above the search bar: **AIP suggestion chips** ("✨ Filter products with price greater than 100",
  "✨ Check valid product IDs", "✨ Convert price to float") — NL-generated transform suggestions per
  dataset.
- **Trim whitespace** (v1 — "Trims whitespace at beginning and end of string"; param: Expression):
  Expression = `product_name` → output `product_name` **[Replace]** badge → Apply. Applied boards
  collapse to a compact row (`Trim whitespace → product_name`) with Edit/Preview/duplicate/delete.
- **Cast to Double**: `price` → `price` [Replace]. Course note: "currency is often stored as integers
  in the smallest unit (e.g., cents) to avoid rounding errors. In this course, we use double for
  simplicity."
- **Apply all changes** → Close.

## 4. Advanced transform — clean customers (profile first, then fix)

**Preview/profiling grammar:**
- Click node → bottom panel tabs **Selection preview | Preview | Suggestions**; left rail
  About/Columns/Schedules with metadata (Updated, Created, Location, Type "Raw dataset", RID, Size
  "6 columns · 1 file · 10.2KB", **Calculate row count**, "Updated via File imports · Import · Edit
  Schema", Tags). Table header: "Showing 59 rows · 6 columns"; **"No input sampling"** badge.
- Column header menu: Pin column, **Mark as policy column**, **Encrypt column**, Filter ▸, Sort
  asc/desc, **View stats**, View cell content, Copy column name, Expand.
- **View stats** on `customer_id`: left counters — Normal 59, Null 0, Empty 0, Whitespace 0, Needs
  trim 0, Numeric 0, Non-alpha 0, Uppercase 0, Lowercase 59, Mixed case 0, **Distinct 50**; LENGTH
  histogram (all 36 chars); VALUE list sorted by desc count — ten ids appear **2×**. 59 rows / 50
  distinct = duplicates.
- Select the duplicated values → **Keep Values / Remove Values** buttons → filter chip
  (`customer_id: d638134a…`) → filtered view shows 18 rows: the 9 duplicate rows carry **null
  email/name/address** → dedup strategy: remove rows where those three are all null.

**Fix:**
- New Transform `clean customers` → **Filter rows** ("Filter rows based on comparisons for selected
  columns"; AIP chip "✨ Filter Gmail users"): **Remove rows ▾** that match **all conditions ▾** —
  `email` **is null** [✓ Treat empty string as null] And `name` is null And `address` is null;
  (+ Add condition / + Add condition group) → Apply.
- `address` is a JSON string (`{"city": …, "street": …, "state": …}`). **Flatten struct** (v1 — "Take
  all fields in a struct and turn them into columns"; params Expression / Max depth / Column prefix)
  requires a struct input → nest **Parse JSON string** as the Expression:
  - **Example data: "Paste a JSON sample and autogenerate a schema"** → paste
    `{"city": "South Isom", "street": "46124 Jonathan Centers", "state": "Arizona"}` → Prettify /
    **Generate schema**. (Alternative: "Paste a JSON schema to use".)
  - JSON input = `address` column; Schema = Struct{city, street, state: String} (+ Add field);
    Output mode **Simple**; Max depth **1**; Column prefix **Empty string**; Separator **1 space**
    (course: change the underscore to a space) → Apply → columns `city`, `street`, `state`.
- **Concatenate strings**: Separator `,` ; Expressions street, city, state (+ Add item; "Null output
  if any input is null" toggle off) → output **`address` [Replace]** → Apply.
- **Drop columns**: city, state, street → Apply all changes → Close.

## 5. File-type handling — clean transactions (JSON, no schema)

- Transform on the unstructured node → panel shows **"No predictions available"** (no schema yet).
- **Extract rows from a JSON file** (v1 — "Reads a dataset of files and parses each JSON file into
  rows"; params: **Schema**; **Allow JSON values to span multiple lines** — "If off, a single JSON
  record must be entirely on one line"). Sibling File transforms: Extract file metadata from dataset
  as rows; Extract rows from a dataset of email files / text files / GeoJSON / XML / shapefile; Get
  media references (datasets).
- Paste one sample record (transaction_id, transaction_date `Thu Jan 25 2024 07:21:01 GMT+0000
  (Greenwich Mean Time)`, units "610.00", customer_id, variation_id, product_id) → **Generate
  schema** → Struct, all String. Multi-line toggle **off** (one JSON per row). Apply.
- **Cast to Timestamp** — info box verbatim substance: casting strings requires explicit formats
  (e.g. `yyyy-MM-dd'T'HH:mm:ss`); multiple formats allowed, **first match wins**; **no match → null**;
  epoch strings → cast to double first. Expression `transaction_date`, Type **Timestamp**, Time zone
  **London (GMT) +00:00** ("Used to parse formats that do not include a timezone. If the format also
  includes a zone, this parameter will override it."). Formats default to ISO8601. **✨ Generate**
  popover: "Add data examples to automatically generate the correct parsing formats" → paste the
  example value → Generate → **`EEE MMM dd yyyy HH:mm:ss 'GMT'Z '('zzzz')'`** → remove the two
  default formats (✕) → Apply.
- **Cast units to double via the AI assistant**: free-text ✨ Generate box — *"How can I cast 'units'
  to double?"* (+ "What can the AI assistant access?" link) → generates a CAST TO DOUBLE board
  ("There may be missing pieces … you might need to adjust it").
- **Drop columns** `_error`, `_file` — JSON-conversion bookkeeping columns; "When processing many
  files, these could be valuable to catch any formatting errors in the raw files."

## 6. Joins, outputs, deploy

**Join grammar:**
- `clean transactions` → **Join** → banner: "Select another table on the graph to start configuring
  the join. Left: clean transactions · Right: clean products" → **Start**.
- Join screen: name (`transactions x products`); **Join type: Left join ▾** ("keeping all rows from
  the left table and only rows which satisfy the provided condition from the right table"); Input
  tables + **⇄ Swap**; **Match condition**: rows that match **all conditions ▾** — `product_id` **is
  equal to** `product_id` (+ Add match condition; **Basic | Advanced** toggle); **Select columns**:
  per-side panels, "Auto-select all left columns" ✓, right-side **prefix field** = `products_`
  ("resulting single dataset may have repeated column names"), 4 of 5 right columns selected
  (`products_product_id` deselected), Select all / Deselect all / Selected / Not selected filters →
  **Applied** → Back to graph. Join node shows **10 columns** + Left dataset/Right dataset ports.
- **Chained join**: `transactions x products` → Join → `clean customers` → `transactions x
  customers`; `customer_id is equal to customer_id`; right prefix left empty ("Prefix right
  columns"); 5 of 6 right selected (`customer_id` deselected) → **15 columns**.

**Outputs & deploy:**
- Node → **Add output** → **New dataset | New object type | New time series sync | New virtual
  table**. Output rail: name (`joined_transactions_products`), "**Output will be created after first
  build**", "10/10 columns mapped", **Configure expectations / Configure write mode / Configure write
  format** dropdowns, column list (type icon + green check + ✕ + drag), "Use updated schema", "Add
  column".
- **Save → Deploy** panel: "Deploy this pipeline — Update pipeline logic and build target outputs";
  Last deployment **Succeeded** + timestamp; **Deploy settings | Errors** tabs; "Select outputs to
  build — Deploying … will update logic for **all** outputs, but only the **selected** outputs will
  be built" (All ✓); **View changes** | **Deploy pipeline**. Node status badges: "Not yet deployed" →
  "Deployment up-to-date" / "Deployed and built".

## 7. The bad-join lesson (Contour drill-down)

- Preview on `transactions x products`: **"Previewing 172 rows"** — but clean transactions has **50
  rows**. "The expectation would be that each transaction is *enriched* after the join, but not
  *multiplied*."
- **Analyze in Contour** button on the materialized node. Positioning: Preview for basic analyses;
  "Contour allows you to look through the **entire** data and discover bugs that would otherwise be
  impossible to find in Preview." Save as… → analysis file in the course folder.
- Contour: dataset card (Table size 172 rows · 10 columns, File path, Branch master, **Show data**);
  hover → **Edit path | Insert board | Paste board**. Insert board → **Histogram** ("Histogram your
  data and filter to specific groups") → Configure Board: Y-Axis Column `transaction_id`, X-Axis
  **Count** of → Compute. Controls: Order by aggregate (x-axis) / Sort descending / Selection mode
  Bars / Show as value. Result: several transaction_ids appear **9×/8×** — join-introduced dupes.
- Click the top bar → auto-filter chip "**Keep rows** where transaction_id is fea955de…" → **Show
  data** → all columns identical *except* the `products_`-prefixed ones; `product_id` repeats while
  **`products_variation_id` is unique** → the products table's real grain is the *variation*, not the
  product → joining on `product_id` multiplied rows.
- Fix in Pipeline Builder: match condition → **`variation_id` is equal to `variation_id`** → Apply.

## 8. The operationally valuable dataset (CLV)

- `transactions x customers` → Transform `customer lifetime value` →
  **Multiply numbers**: `units` × `products_price` → new column **`revenue` [New]** → Apply →
  **Aggregate** (v1 — "Performs the specified aggregations on the input dataset grouped by a set of
  columns"; params: Group by columns — "If empty, no group by is applied"; Aggregations): Group by
  `customer_id`, `address`, `name` (drag to reorder / Sort alphabetically); Aggregations: **Sum** of
  `revenue` → `revenue` [Replace] → Apply → 4 columns → Add output → New dataset
  `customer_lifetime_value` (4/4 mapped) → Save + deploy.

## 9. Best practices module (verbatim substance)

- **Streaming**: processed "on average in under 15 seconds." Stream creation screen: Define /
  Connect / Push tabs; **Throughput**: Normal (≤5MB/s, "Row order guaranteed on arrival", lowest
  compute, Recommended) vs Very high (order NOT guaranteed, higher compute, >5MB/s, partition
  slider); **Schema** (columns + Nullable? + "Generate from JSON sample"); **Keys (Optional)** — key
  columns to "guarantee ordering between unique IDs"; footer chips ✓Partitions: 1 ✓2 columns ✓0 keys
  → Create stream.
- **Outputting to ontology**: Pipeline Builder "can also direct the output straight into an
  ontology" (the Add output → New object type path; the intro diagram's "Direct Ontology Output").
- **UDFs**: custom code in a supported language, published into Builder boards; "Once published, a
  UDF cannot be unpublished." Best practices: *identify the need first* ("UDFs should be a **last
  resort**"), *minimize usage* ("built-in functions … are typically optimized"), *keep it simple*
  ("perform a single task").
- **Segmentation & materialization**: >100 nodes → navigation/loading trouble. Two strategies:
  - *Optimize for latency*: defer materialization to the end; each output builds in one chained step
    (raw → clean → joined → ontology); "split by use case" — one end-to-end pipeline per workflow.
  - *Optimize for extensibility/readability*: segment into separate Pipeline Builder instances
    ("cleaning", "joining", "ontology"), materialize at each boundary, reuse outputs as inputs —
    "maximize reusability and clarity, **at the cost of build latency**."
- **Scheduling**: schedule panel — name/description; Select scheduled outputs; **When to build:
  "When specific datasets update"** (pick dataset nodes + Add) **vs "At a specific time"**.
- **Branching**: branch dropdown (Main ▾) → "Filter or create branch…" / **Create new branch**
  ("test changes without losing your current pipeline state") / Manage branches. Header row: Undo/
  redo | branch ▾ | **Saved** | **Propose** | **Deploy** | ✓12 (checks) | Share. *(Note the
  **Propose** button — the proposals/review workflow surfaces here too.)*
- **Data expectations**: "Expectations on output datasets can be used as **checks to enforce
  pipeline stability. If checks fail during a dataset build, the build will fail** to save time and
  resources and prevent downstream data issues." Types (verbatim): **Primary key** ("columns …
  unique together and all non null"), **Row count** ("within a certain range"), **Value is not
  null**, **Value is one of**, **Row-level** ("a column expression returning a boolean … run against
  every row").
- **Incremental transforms**: "process only the data that has changed since the last pipeline run" —
  detailed docs deferred.

## OPEN items

- OPEN: **the P5 material is NOT here** — this generic course never touches Use LLM / embeddings /
  media sets in anger; the embed-the-summary choice remains sourced only from the original
  walkthrough.
- OPEN: Faster (DataFusion) vs Standard compute trade-offs; External compute (Beta) — names only.
- OPEN: **virtual tables** and **time series sync** output types — shown in menus, never explained.
- OPEN: `fx Reusables` menu, Split and Union transforms, Packaging settings, Sampling strategies —
  visible, unexercised.
- OPEN: incremental transforms mechanics (explicitly deferred to other docs/trainings).

---

## Beacon mapping (analysis — separate from the record)

**The one big steal — fail-closed stage gates (Data Expectations):** their builds *fail* when an
output violates a declared expectation (PK unique+non-null, row count range, not-null, one-of,
row-level predicate). Our document-ingest advances its stage marker on partial success and warns on
console. Track 1 of the doc-ingestion spec should adopt this posture: each stage transition asserts
its contract (chunks > 0, `text_full` non-null, `chunkId` unique, embedding present/dimensioned,
`cited_in` written) and **refuses to advance** otherwise. This also matches our self-apply CI
contracts — same idea, runtime edition.

**The bad-join lesson = our verify-before-build reflex, as a course.** Their debugging grammar
(row-count sanity → PK-count histogram → drill into one key → discover the true grain
product-vs-variation) is exactly the Q1–Q4 lesson arc (reorder join hitting all suppliers; flat data
hiding bugs). Worth encoding in D-phase proofs: after ingest, assert the *grain* (n_chunks ≥ n_pages;
chunkId PK) not just presence.

**Confirms:**
- Both authoring paths (no-code Builder / pro-code Repos) compile to the *same* dataset chain —
  matches our code-as-canonical stance; the Builder is a projection, not a different engine.
- Branch + **Propose** + checks + Deploy inside Pipeline Builder = git+PR+CI-in-a-GUI again (third
  module where this shows up). We use real git.
- "When specific datasets update" schedules = event-driven builds; our on-event agent cadence and
  pg_cron daily are the two poles they also offer ("at a specific time").
- UDF discipline ("last resort; built-ins are optimized; single task") = our write-less-code /
  compose-existing-primitives rule, stated by Palantir.
- AI woven through authoring (suggestion chips per dataset, NL → transform board, format inference
  from an example value) — more validation for NL-native authoring as the leapfrog.

**Steal-worthy (beyond doc-ingestion):**
1. **Three-way upload triage** (structured dataset / media set / unstructured dataset) — clean mental
   model; our documents storage bucket = media-set analog; keep PDFs on the media path (as the
   walkthrough did), not as ad-hoc rows.
2. **Column stats profiling panel** (Normal/Null/Empty/Whitespace/Needs-trim/Distinct + value counts
   + Keep/Remove Values pivot into a filter) — a compact data-QA grammar; a lightweight variant on
   our import surfaces would catch demo-seed defects early. Not build-now.
3. **Timestamp-cast discipline** (explicit format list, first-match, null-on-miss, tz override,
   generate-from-example) — directly relevant to CSV ingest for hotels; we should treat date parsing
   as declared formats, not `new Date()` luck.
4. **Materialization strategy vocabulary** (latency vs extensibility segmentation) — names the choice
   we already made in document-ingest (one chained fn, stage markers persisted at boundaries = the
   hybrid). Useful language for docs.

**Does NOT settle:** P5 embed-target fork (summary vs full chunk) — expected here, not covered; the
walkthrough remains the only Foundry source (it embeds the summary). Decide at D-phase with retrieval
quality on real data as the tiebreaker. P6 entity categories — still open (session 1's territory,
also not settled).
