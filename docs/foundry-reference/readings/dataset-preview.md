---
verify: strict
---

# Dataset Preview — the dataset view, and what a dataset's screen shows

**Pages read in full: 5** — `dataset-preview/overview`, `dataset-preview/sql-console`,
`dataset-preview/time-travel`, `dataset-preview/dataset-preview-faq`,
`dataset-preview/csv-parsing` (the last two were read for `ingestion.md`, which
built the upload path; they are re-read here only for what they say about the
screen). `_index.md` is a table of contents.

**Images, counted: the five pages reference 15 distinct images and I opened all
15** — `dataset.png`, `dataset-preview.png`, `dataset-app-history-page.png`,
`create-branch.png`, `dataset-data-health.png`, `create-dataset.png`, `stream.png`,
`metrics.png`, `metrics-dropdown-chart.png`, `metrics-trouble-shoot-alerts.png`,
`sql-console-dataset-preview.png`, `object-mode-data-mode-sql.png`,
`time-travel-overview.png`, `time-travel-range.png`, `time-travel-bisect.png`.
Four of them (`stream`, the three `metrics-*`) show streaming datasets, which we
do not build; they are parsed for the shared header and tab row only.

**Why this reading exists.** `ingestion.md` read `dataset-preview/overview` for
one section — *Upload files manually* — and built 789–791 from it. The rest of
the page, which is the whole screen a dataset has, reached nothing: our
`DatasetsPage.tsx` was a card list with one "New dataset" button and a stack of
panels underneath. This reading is of the screen.

---

## 1. The screen has five regions, and the page numbers them

The overview page is built around one annotated capture and explains it region
by region:

> "The screenshot below displays the interface of the Dataset Preview application. The numbered sections are explained in more details in the following sections."
— dataset-preview/overview.md

The five, in the page's own order: **1. Dataset header**, **2. Information
panel**, **3. Tab views**, **4. Preview table**, **5. Actions**.

What the capture shows that the prose does not, region by region:

> Region 1, the header: an app icon at far left (a blue table glyph); a breadcrumb `Learning ‹…› › data › airlines › ontology › airlines` ending in the dataset's name with a star beside it; a second line `File ▾  Help ▾ | 🏢 1 | ⑂ master ▾`. At far right a three-count pill `⟳ 0  ✓ 0  ✗ 1`, then `Share` with a people icon, then a list icon.
> — dataset-preview/images/dataset.png

> Region 3, the tab row: `Preview | History | Details | Health (Beta) | Compare`, Preview underlined. Right-aligned on the same row: `SQL preview` (database icon), `Analyze data ▾` (chart icon), `Explore pipeline ▾` (pipeline icon), `All actions ▾`, and `Build ▾` as a split button.
> — dataset-preview/images/dataset.png

> Region 2, the information panel: the dataset's name with a table icon; a segmented control `About | Columns | Schedules` with About selected; a description paragraph; a chip `[Foundry][OFT_1] Airline` with an object-type icon and a gear beside it; then rows `Updated — Jun 28, 2025, 11:49 PM by Foundry ✓`, `Created — Jun 28, 2025, 11:45 PM by Foundry`, `Location — /Palantir/Learning ‹…›/data/airlines…`, `Type — Dataset`, `RID — 881ec-8707-4a7d-857b-5cdc3288a013 📋`, `Size — 12 columns | 481 rows | 2 files` on one line and `584KB ⓘ` beneath, `Updated via — airlines-ontology logic` as a link; then a `Tags` heading with `Add tags`.
> — dataset-preview/images/dataset.png

> Region 4, the preview table: a strip `airlines | Showing 300 of 481 rows | 12 columns | 🔍 Search columns…`; a row-number column; each column header is the name on the first line and the type on the second (`iata / String`, `start_date_sourc… / Date`, `wac / Integer`) with a small filter glyph at the right of the header; null cells render as italic `null`; numbers right-aligned, text left.
> — dataset-preview/images/dataset.png

The prose for region 1:

> "The header of the page identifies the selected dataset and provides basic information such as its name, display name (if existing), location, and the selected branch. The header also allows some file related operations such as sharing, moving, renaming, and more."
— dataset-preview/overview.md

## 2. The information panel is three sections, and About lists its fields

> "The information panel provides metadata about the dataset and some basic administrative operations. The panel is divided into three sections:"
— dataset-preview/overview.md

> "* **About:** Information including the time the dataset was created and updated, the users who created and last updated the dataset, the size of the table, any tools and input datasets used to create the data, tags, and more."
— dataset-preview/overview.md

> "* **Columns:** Information on the different columns in the dataset, including the type of data, description, and data stats (percentage of null values, distributions and samples)."
— dataset-preview/overview.md

> "* **Schedules:** Information about any configured build [schedules](/docs/foundry/building-pipelines/scheduling-overview/) that will run to update the dataset."
— dataset-preview/overview.md

**What "Updated via" is.** The capture shows `airlines-ontology logic`; the
prose says "any tools and input datasets used to create the data". Inference:
the row names the thing that last wrote the dataset — a transform's logic, an
upload, a SQL query. The newer capture confirms the reading with a different
writer:

> The About panel's last row is `Updated via — SQL query` with a document icon, and `Updated — Apr 3, 2026, 1:25 PM by build2` links the writer.
> — dataset-preview/images/sql-console-dataset-preview.png

**The size row states the table's shape twice**, logical then physical — columns
and rows, then files and bytes:

> `Size — 6 columns | 4 rows | 4 files | 6.9KB ⓘ`
> — dataset-preview/images/sql-console-dataset-preview.png

## 3. The tabs, and what each one is

**Preview** is the table (§5). **History** is *builds*, not transactions:

> "The **History** tab view provides historical job (build) information. A **Summary** view on the right side of the page shows aggregated information on job statuses over time."
— dataset-preview/overview.md

> "On the left panel, a list of jobs appears with their statuses and durations. Upon selection, a detailed **Job** view appears on the right showing detailed job information, including progress, specification, build logs, files and the resulting schema."
— dataset-preview/overview.md

> Left rail headed `History` with a `Filter` control; each row is a relative time (`5 minutes ago`, `Today at 10:28 AM`) with a status icon, a second line `Snapshot • Jane Doe`, a third `Part of ✓ 🏗 build • 1 job`, and a duration at right (`9m 32s`). Right: `Summary` with a `Date range` pair, five cards `163 Total jobs | 161 Succeeded | 1 Failed | 0 Canceled | 10m 21s Median duration`, then a `Job duration` scatter over time with a `Show running average` toggle and a legend `Running / Succeeded / Failed / Canceled`.
> — dataset-preview/images/dataset-app-history-page.png

So a History row is a **transaction** (its type is the second line's first
word — `Snapshot`, `Open`) *and* the **job** that produced it (`Part of build •
4 jobs`). The two are one row because a build opens the transaction:

> A selected row opens `Details: Apr 22, 8:55 PM` with a `Job progress` bar segmented `Starting / Waiting in project's resource queue / Initializing spark application / Fast loading environment / Running / Finishing`, and beneath it `Inputs and outputs`. The row's `…` menu holds `Create branch`.
> — dataset-preview/images/create-branch.png

> "You can use the **History** tab to create branches on historical transactions of your data that have not been deleted by a [retention policy](/docs/foundry/administration/enrollments-and-organizations-retention/). Choose a previous transaction from the left panel and select the ellipsis (**...**) icon to **Create branch**."
— dataset-preview/overview.md

**Details** is seven sub-sections:

> "* **Schema:** Provides full information on the table schema (column specifications) and allows you to edit the schema (if applicable)."
— dataset-preview/overview.md

> "* **Files:** Displays the list of files that make up the dataset and allows you to download them."
— dataset-preview/overview.md

> "* **Job spec:** Displays the job specification containing essential information for the dataset to build. Furnace SQL outputs can retain multiple [SQL definitions](/docs/foundry/sql-warehousing/sql-definitions/) in this section."
— dataset-preview/overview.md

The other four — Syncs, Custom metadata, Resource usage metrics, Last run details
— name engines we do not have (database syncs, custom metadata fields, Spark
usage, streams).

**Schema edits reach the same options the upload stores.** The FAQ's remedy for
a jagged upload is the sidebar's editor, not a re-upload:

> "One option is to ignore jagged rows (such as rows that are missing certain columns). To do this, select **Edit schema**, expand the **Parsing options** section, and check **Ignore jagged rows**."
— dataset-preview/dataset-preview-faq.md

and the parsing page bounds where those options apply:

> "Note that the schema options listed above are only applicable to datasets constructed from CSV files."
— dataset-preview/csv-parsing.md

Not built in this pass: an **Edit schema** editor. 789 stores the twelve options
on the schema, so the editor would write what the upload already writes.

**Health** is the data-health engine's tab, and its capture is the fullest
statement of that screen anywhere in the mirror:

> "The **Health** tab provides tools to monitor [data health](/docs/foundry/health-checks/overview/). The page displays health checks on the specific resource, monitoring rules on the resource grouped by specific monitoring view, and related schedule builds that affect the resource. Selecting any row reveals historical reports for the health checks and monitoring rules."
— dataset-preview/overview.md

> A `Show failures only` switch, `Search monitors…` and a green `+ Add checks` button. Three headed sections: `Checks` — a table `NAME | STATUS | REPORTED AT | MONITORING VIEW | HISTORY REPORTS` whose header row carries the count and pass/fail dots (`Checks 3 ● 2 ● 1`), each history cell a row of ten coloured dots; `Monitoring` — one card per monitoring view (`Foundry Test  Passing (28)  Failing (2)  🔔`) with its path beneath and a `Rules 9` table of the same columns plus `+ Add rules`; `Related schedules` with `Expand all`.
> — dataset-preview/images/dataset-data-health.png

**Compare** compares two datasets, or a dataset with its past or its branch:

> "Use the **Compare** tab to compare two different datasets. Select the tab and choose a dataset to compare with. The **Compare** tab can be used in several ways:"
— dataset-preview/overview.md

**Time Travel** is a sixth tab in the 2026 captures, beta, over committed
versions:

> "To use Time Travel, open a dataset or Iceberg table in Dataset Preview, then select the **Time Travel** tab. Time Travel provides two views: **Single version** and **Range**."
— dataset-preview/time-travel.md

> Tab row `Preview | History | Details | Health | Compare | Time Travel (Beta)`; beneath it `26 versions`, a `Single version | Range` toggle and `Bisect` at right; a timeline slider with a dot per version (blue for Update, orange for Snapshot) and dated ticks; a chip `Update  Jul 12, 2026, 4:01 AM`; a `Refine query` disclosure; a `Limited to 1,000 rows` warning; then the grid with the same name-over-type headers.
> — dataset-preview/images/time-travel-overview.png

> Range view adds `Key column — row_id ▾`, three totals `3,000,000 added | 19,922 removed | 19,828 modified`, and a leading `_diff_status` column whose rows read `− Removed` in red italics and `~ Modified` with `1 → 24` cell diffs in orange.
> — dataset-preview/images/time-travel-range.png

> The Bisect panel: `Find` with three radios `When a row was added / When a row was removed / When a cell value changed`, `Key column`, `Key value`, and a green result `Row first appears in ri.foundry.main.transaction.00000309-…` with `Jump to version`.
> — dataset-preview/images/time-travel-bisect.png

**Stream and Metrics** appear only on streaming datasets, which we do not have;
the four captures add nothing to the non-streaming screen beyond confirming the
header and tab row are the same shell (`stream.png` shows `Live ▾ | Preview |
Stream (New) | History | Details | Health (Beta) | Metrics`).

## 4. The header's "All actions"

> "The **All actions** dropdown menu provides quick access to Foundry tools and operations, allowing you to analyze, explore, transform, and manage the data. Some actions, such as **Analyze** (in Contour) and **Build**, are surfaced outside the actions menu for quick access."
— dataset-preview/overview.md

No capture opens the menu, so its contents are unattested here. What *is*
attested is which actions sit outside it: Analyze, Build, Explore pipeline, and
the SQL entry point.

## 5. The preview table

> "By default, the preview table will show a limited sample of the data; the exact number of rows is displayed in the preview table header. However, any action taken on the data, such as filtering or sorting, will apply to the full dataset and increase the preview sample size. Depending on the number of rows, you may not see the entire dataset in the preview."
— dataset-preview/overview.md

The sample size in the capture is 300 (`Showing 300 of 481 rows`); the smaller
2026 capture shows `Showing 4 rows` with no denominator when the sample is the
whole table, and a `Calculate row count` button at bottom right — so the total
is computed on demand there. Inference: 300 is the default sample.

> "* Select a column’s menu to sort, filter, and generate charts over the column data."
— dataset-preview/overview.md

> "* Select an individual cell to exclude or include only the selected value from the preview."
— dataset-preview/overview.md

> "* Search for specific column names."
— dataset-preview/overview.md

The capture shows both menus and the stats panel the column menu opens:

> Column menu: `Pin column`, `Encrypt column`, divider, `Filter ▸`, `Sort ascending`, `Sort descending`, `View stats`, `View cell content`, divider, `Copy column name`, `Expand`. Cell menu: `Include only "Kips Bay"`, `Exclude "Kips Bay"`, `View stats`, `View cell content`, divider, `Copy`. An active filter renders as a chip above the grid: `end_borough: "Manhattan" ✕`.
> — dataset-preview/images/dataset-preview.png

> The stats panel docks beneath the grid: `end_neighborhood  String  91,077 rows`; a left column of counts `Normal 91.1k / Null 0 / Empty 0 / Whitespace 0 / Needs trim 0` then `Numeric 0 / Non-alpha 0 / Uppercase 69`; a `LENGTH 20` histogram (`by inc. value`); a `VALUE 194` list `by desc. count` with a bar per value (`Midtown 16,719`, `Upper East Side 13,273`…) and a `Filter…` box.
> — dataset-preview/images/dataset-preview.png

## 6. The SQL console is a bottom panel, not a tab

> "The SQL console is the embedded SQL interface available within Foundry applications, providing contextual SQL access to the resource you are currently viewing."
— dataset-preview/sql-console.md

> "The starter query is prepopulated based on the resource you are currently viewing."
— dataset-preview/sql-console.md

> The console docks under the grid with its own header `SQL console ⌄`, a `Scratchpad ▾` picker, a save icon, and a green `▶ Run` split button; the starter query reads `SELECT * FROM \`master\`.\`active_customers…\``; the results pane says `Run a SQL query in the editor to see a preview of the results.` with `Open in SQL Studio` beneath.
> — dataset-preview/images/sql-console-dataset-preview.png

Not built: it needs a Spark SQL dialect over the dataset. Recorded, with the
`SQL preview` action bar button it belongs to.

## 7. The two eras

`dataset.png`, `dataset-preview.png`, `create-branch.png`, `dataset-data-health.png`
and the four streaming captures are one generation (dates in 2025; tabs end at
`Compare`; header has `File ▾ Help ▾`; type row reads `String`). `sql-console-
dataset-preview.png` and the three `time-travel-*` captures are newer (dates in
2026; the type row reads `❞ string` with a glyph and lowercase; `Snapshots`,
`Maintenance` and `Time Travel` tabs; `Analyze in Contour` in place of `Analyze
data`; `Storage` and `Format` rows in About for an Iceberg table). The annotated
capture is the one the overview page explains, so the build is to it; the
differences are listed so the next reader knows they are eras, not errors.

## What the images add that the prose does not

- The About panel's field order and the two-line Size row (§2).
- History rows are transaction + job, with `Part of build • N jobs` (§3).
- The five Summary cards and their exact labels (§3).
- The Health tab's three sections and their table columns (§3).
- The column and cell menus' exact items, the filter chip, and the stats
  panel's count vocabulary (§5).
- The default sample of 300 and the `Search columns…` strip (§5).
- That the SQL console is a bottom dock (§6), and that the whole shell is shared
  by streaming datasets (§3).

## Connects to

- `readings/ingestion.md` — the upload path this screen hosts; "Drag and drop
  the file into the dataset preview window" makes the grid the drop target.
- `readings/data-health.md` and engine 659/660 — the Health tab.
- `readings/compass-branching-and-views.md` — the branch chip; question 4 of
  `ingestion.md` (nothing creates a child dataset branch) is what `Create
  branch` in History would close.
- `features/builds/` — History's job half is `build_jobs`, which 493 links to
  the transaction it opened (`build_jobs.transaction_id`).
- `LineagePage` at `/lineage/dataset/:id` — the `Explore pipeline` action.
- `ContourPage` — the `Analyze data` action.

## Decisions (2026-09-12 — NOT YET READ BY A HUMAN)

1. **A dataset gets its own route and screen**, `/datasets/:id`, shaped to the
   annotated capture: header with breadcrumb and branch chip, the tab row with
   the action bar on its right, the three-section information panel on the
   left, and the tab's content on the right. The card list at `/datasets` stays
   as the way in; Foundry reaches a dataset through Compass, which is a
   different family.
2. **The preview table reads rows through one function, `dataset_preview`**,
   gated by `can_read_dataset_data` exactly as the indexer is, over the branch's
   current view (`_file IN dataset_view(branch)`), with a default sample of
   300, and with sort and include/exclude filters applied *before* the sample —
   because "any action taken on the data, such as filtering or sorting, will
   apply to the full dataset".
3. **Column stats are one function, `dataset_column_stats`**, returning the
   counts the stats panel names (rows, null, empty, whitespace, distinct) and
   the value list by descending count. The length histogram and the
   `Numeric / Non-alpha / Uppercase / Needs trim` counts are not built in this
   pass; they are recorded here, not silently dropped.
4. **History rows are transactions joined to the job that opened them**, and the
   Summary cards count jobs by state. Median duration is computed client-side
   from `started_at`/`finished_at`. The `Job duration` chart is not built.
5. **Tabs with no engine are not rendered** — Compare, Time Travel, Snapshots,
   Maintenance, Stream, Metrics — because "a tab that renders an empty shell
   reads as a built feature" (the page's own standing rule). The same for `SQL
   preview`, `Pin column`, `Encrypt column`, charts, `Report issue` and the
   `Tags` row. Each is a named gap in `docs/SURFACE-BUILD-MAP.md`.
6. **The three-count header pill is not built**: no page says what the three
   counts are, and the Health capture's counts (`✓ 0 ✗ 1` beside three checks
   of which two pass) rule out "checks". Question 1.
7. **The information panel's `Updated via` names the last committed transaction's
   writer**: the job spec's transform when a build job opened it, otherwise
   "Upload". Inference from the two captures (§2), marked as such in the code.

## Questions

1. **What does the header pill `⟳ 0 ✓ 0 ✗ 1` count?** Present on every capture
   of the shell (`dataset.png`, `dataset-data-health.png`, `stream.png`), never
   explained, and inconsistent with the Health tab's check counts on the same
   screen.
2. **What is in `All actions`?** The prose lists categories (analyze, explore,
   transform, manage) and names two members surfaced outside it; no capture
   opens it.
3. **Does the preview's `Filter ▸` submenu differ from the cell menu's
   include/exclude?** The column menu shows `Filter ▸` with a submenu that the
   capture leaves closed.
4. **Is the History rail's relative time the transaction's commit or the job's
   start?** The capture's `Running` row says `Open • Jane Doe`, i.e. an open
   transaction — which suggests the row is the transaction and the time is its
   start.
