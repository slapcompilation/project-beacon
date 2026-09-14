# The surface build map

What every routed screen shows today, what Foundry's captures and pages show
for the same screen, and the difference — in the order a user meets them on
the end-to-end chain. **Everything here is either quoted, read off a named
capture, or read off our own source with a file named.** Where a family has
not yet been walked against its captures, the entry says so; it does not
guess.

The question this answers is the one the operator asked on 2026-09-12: the
Datasets destination on the home screen was "stripped empty with only one
action, New dataset", and every screen needs to follow Foundry's build. The
ontology's equivalent is `ONTOLOGY-BUILD-MAP.md`; this map is for the
*surfaces*, and it starts where the chain starts.

## How an entry is made, and what counts as done

1. **Read the section whole** — prose and every capture — and write the
   reading (`foundry-reference/readings/<topic>.md`, gated by
   `pnpm check:readings`, which counts the images the header claims).
2. **Build to the annotated capture**, region by region, and render nothing
   that has no engine: "a tab that renders an empty shell reads as a built
   feature" is the standing rule from `DatasetsPage.tsx`, kept.
3. **Reconcile after building**, element by element against the captures, by
   a reader that did not build it and a refuter that tries to overturn the
   reader. What survives is fixed or recorded here as a named gap.
4. **Merge on green**; `Deploy verify` on the merge commit is done.

A gap that is *recorded with its reason* is not a defect of this map; an
element rendered that no capture or sentence shows is. The survey of
2026-09-11/12 (`survey-engines-without-surfaces`, four areas, refuted) found
that about half of every "we do not have X" claim was false on a grep, so a
not-built verdict below is only written after `apps/web/src` was searched.

## The chain, and where each surface enters

From `scripts/probes/chain-e2e.mjs`, which walks it in 22 steps and passes:

| step | what happens | surface |
|---|---|---|
| 1 | a dataset is created in a project | `/datasets` → `/datasets/:id` |
| 2 | a file is dropped on it and lands as a transaction | Preview tab (drop target) |
| 3 | an object type is backed by it | `/ontology/object-types` |
| 4 | the type is indexed | Discover / type config |
| 5 | a transform declares inputs and a build runs | Details › Job spec, `/builds` |
| 6 | a schedule keeps it fresh | About › Schedules, `/builds` |
| 7 | an action type edits objects | `/ontology/action-types` |
| 8 | an automation watches a condition and runs effects | `/automate` |
| 9 | a notification reaches its recipients | `/notifications` |
| — | objects are explored and opened | `/explorer`, `/objects/:type/:pk` |
| — | an app is built on them | `/workshop`, `/slate` |
| — | a change is proposed and approved | `/ontology/proposals`, `/approvals` |

---

## 1. Datasets — the dataset view — **BUILT** (804–806 + `DatasetPage.tsx`), reconciled 2026-09-13

**Reading:** `readings/dataset-preview.md` — 5 pages, 15 of 15 captures.
**Engine added:** 804 — `dataset_preview` (the sample, sorted and filtered
before the LIMIT, gated by `can_read_dataset_data`), `dataset_preview_count`,
`dataset_column_stats`; 805/806 — the dataset's creator is the caller when the
platform knows them. **Surface:** `pages/DatasetPage.tsx` at `/datasets/:id`;
`pages/DatasetsPage.tsx` is the way in.

**Before:** one card list, one "New dataset" button, and a stack of panels
under a selected card (About, Upload, Transform, Access, Check access, Health,
Columns, History, Files). No rows were ever shown — nothing read
`datasets.<table>` but the indexer.

### What the annotated capture shows, and what is built

Read off `dataset-preview/images/dataset.png`, the capture
`dataset-preview/overview.md` numbers 1–5.

| region | element | status |
|---|---|---|
| 1 header | app icon, breadcrumb ending in the dataset, star | breadcrumb **built** (`dsv-crumbs`, space › project › folder › dataset; crumbs link to `/projects`, there being no folder route); star **not built** — no favourites engine |
| 1 header | `File ▾  Help ▾` | **not built** — "sharing, moving, renaming" have no engine reached here |
| 1 header | `🏢 1` organisation pill | **not built** — meaning unattested |
| 1 header | `⑂ master ▾` branch chip | **built** — on the header's second line at left as the capture has it; the root branch opens by default |
| 1 header | `⟳ 0 ✓ 0 ✗ 1` pill, `Share`, list icon | **not built** — the pill's meaning is question 1 of the reading; Share has no engine |
| 3 tabs | `Preview` `History` `Details` `Health (Beta)` | **built** |
| 3 tabs | `Compare` | **not built** — no engine; the newer captures also add `Time Travel`, `Snapshots`, `Maintenance` — not built |
| 5 actions | `SQL preview` | **not built** — needs a SQL dialect over the view (`sql-console.md`) |
| 5 actions | `Analyze data ▾` | **built, partial** — opens `/contour` without preselecting the dataset (Contour's page has no dataset parameter yet) |
| 5 actions | `Explore pipeline ▾` | **built** — `/lineage/dataset/:id` |
| 5 actions | `All actions ▾` | **built** to `object-link-types/images/automap-struct-pipelinebuilder.png` (found by the refuter): a `Search for apps…` box, the rail `All / Analyze data / Explore pipeline`, one row per action with somewhere to go — Analyze in Code Workbook, Analyze in Contour, Create new pipeline, Create object type, Create restricted view, Explore data lineage — plus three of ours that say so (Upload file, Check access, Copy RID); Jupyter, justification prompt, Fusion copy and download **not built** |
| 5 actions | `Build ▾` | **built** — `run_build` on this dataset; the split-button's second half is not |
| 2 panel | name; `About / Columns / Schedules` | **built** (`dsv-segment`) |
| 2 About | description; backing object-type chip with gear | description and chip **built**; the gear **not built** |
| 2 About | `Updated … by …`, `Created … by …` | **built** — Updated is the latest committed transaction's time and its creator (638 stamps it; the first draft read `datasets.updated_at`, which nothing moves); Created's creator is the caller since 805/806 |
| 2 About | `Location`, `Type`, `RID 📋` | **built** |
| 2 About | `Size — 12 columns / 481 rows / 2 files` + `584KB` | columns/rows/files **built**; bytes **not built** — not stored |
| 2 About | `Updated via` | **built** by inference (decision 7): `transform vN` from the job's recorded spec version, else "Upload" |
| 2 About | `Tags / Add tags` | **not built** — no tags engine |
| 2 Columns | column list with type; "description, and data stats" | list + type **built**; a click opens the stats dock; per-column description **not built** |
| 2 Schedules | schedules that update the dataset | **built** — filtered on `target_dataset_ids` |
| 4 grid | `Showing 300 of 481 rows` / `12 columns` / `Search columns…` | **built** (`dataset_preview_count` is the denominator, eager as the annotated capture's; the whole-table form is `Showing N rows`; counts print as `16,719` and `91.1k`) |
| 4 grid | row numbers; name-over-type headers with a menu glyph; italic `null` | **built** |
| 4 grid | column menu (`dataset-preview.png`): Pin, Encrypt, Filter ▸, Sort asc/desc, View stats, View cell content, Copy column name, Expand | Sort asc/desc, View stats, Copy column name **built**; Pin, Encrypt, Filter ▸, View cell content, Expand **not built** |
| 4 grid | cell menu: Include only, Exclude, View stats, View cell content, Copy | Include only, Exclude, View stats, Copy **built**; View cell content **not built** |
| 4 grid | filter chip `end_borough: "Manhattan" ✕` | **built** |
| 4 grid | stats dock: Normal/Null/Empty/Whitespace/Needs trim, Numeric/Non-alpha/Uppercase, LENGTH histogram, `VALUE 194 by desc. count ▾` with `Filter…` | Normal/Null/Empty/Whitespace and `VALUE <distinct>` by count **built**; Needs trim, Numeric, Non-alpha, Uppercase, the LENGTH histogram, the sort picker and the `Filter…` box **not built** (decision 3) |
| 4 grid | drag-and-drop upload onto the preview window | **built** — the grid wrap is the drop target; the empty state carries the picker |
| History | rail: `5 minutes ago` / `Today at 10:28 AM` / `Apr 22, 8:55 PM`, status icon, `Snapshot • Jane Doe`, `Part of ✓ build • 1 job`, duration; `Filter` | **built** — rows are jobs with their transaction, then jobless transactions; the person is the transaction's creator; the third line is the build's status and job count; `Filter` **not built** |
| History | Summary: `Date range`, five cards, `Job duration` scatter | five cards **built**; date range and the scatter **not built** |
| History | job detail (`create-branch.png`): `Job progress` segments, `Inputs and outputs`, `Compare with…`, `… › Create branch`; `Transaction details … Transaction RID` (`data-lifetime/FAQ`) | detail **built** with the job's state, times, error and the transaction's type and RID; progress segments, inputs/outputs, compare **not built**; **Create branch not built** — nothing creates a child dataset branch (ingestion.md question 4). Commit/abort controls the first draft had here are **removed**: no page offers them, and the only open transaction the tab meets is a running build's lock |
| Details | Schema (editable), Files (downloadable), Job spec, Syncs, Custom metadata, Resource usage, Last run | Schema, Files, Job spec **built** read-only; Edit schema, download, and the other four **not built** |
| Details | (ours) Access requirements, Check access | **built-but-unattested here** — `security/checking-permissions.md` places Check access in the workspace sidebar or the Data Lineage tool; kept under Details as inference, said so in the code |
| Health | `Show failures only`, `Search monitors…`, `+ Add checks`; Checks table `NAME / STATUS / REPORTED AT / MONITORING VIEW / HISTORY REPORTS` with `Checks 3 ● 2 ● 1`; Monitoring per view with `Rules`; Related schedules | the Checks half **built** by `HealthPanel` (659/660) — **divergent**: a two-line list with a minimal `Add check` toggle, no failures switch, no search, no table columns; its per-check `Watch`/RID controls are attested by `data-health/images/health-checks-overview.png`, a second capture of this same tab. The Monitoring and Related schedules sections **not built** here — `MonitoringPanel` exists at `/data-health` but is not composed. Both are the Data Health family's (§3.3) |

### What building it turned up

- **`created_by_user_id` was never written.** `useCreateDataset` inserted
  without it, so "Created … by" had nothing to say. 805 defaulted it to
  `auth.uid()` and the suite refused that within the hour — a caller whose
  `sub` the platform has not registered broke the FK — so 806 made the default
  `known_caller()`: the caller when a users row carries them, else NULL.
- **The physical table's own policy is the weaker predicate.** 393's
  `rows follow the dataset` checks `can_read_dataset`; the data predicate
  (401) also requires the propagated data markings. 804's readers gate on the
  stronger one, so the screen is right; the table's policy is not, and a
  direct `SELECT` by a caller who lacks a data marking would still see rows.
  Recorded for a forward fix — it predates 804 and is outside its title.
- **Two runs sharing one `.env.local` race.** The platform suite and the
  web suite run "as CI" (env moved aside) cannot overlap; one silently skips
  66 files. The full suite is run alone before this ships.

### What the reconcile pass changed (2026-09-13)

A reader walked seven captures against the page (136 elements); a refuter
overturned nine of its claims, upheld eighteen and added nine it missed.
Changed as a result: the All actions launcher (above); History rows are jobs;
`Updated` is the last commit and its creator; the About `Branch` row and the
commit/abort buttons are gone; the branch chip moved to the header's second
line and opens on the root branch; `bp5-input` — dead under Blueprint 6 — became
`Classes.INPUT` here and in `EffectEditor.tsx`; an upload now invalidates
every query the view reads; a caller refused by the data gate sees the
refusal instead of an empty grid; a schema-less dataset with files says so;
counts print as the captures print them; the `Distinct` row became the
`VALUE` heading's count; the folder joins the breadcrumb and the Location.
Overturned and kept: the eager count (it is the annotated capture's), the
transaction RID in the detail (`data-lifetime/FAQ`), `Create restricted view`
in All actions (the struct-automapping capture), and 804's `ORDER BY _row` —
`_row` is the table's unique identity, so the order is deterministic and is
file order, the refuter's ties-across-files objection notwithstanding.

### Not built, with the reason

| gap | why |
|---|---|
| SQL preview / console | needs a query language over the view; `sql-console.md` names Spark SQL |
| Compare, Time Travel, Projections | a diff engine over two views; Time Travel is beta and needs a key-column diff; Projections has no page read here |
| Create branch from History | no function creates a child dataset branch; ingestion.md question 4 |
| Tags, star, Share, File/Help | no engine for any of the four |
| header pill, `🏢 1` | unattested meaning |
| `Analyze data ▾` / `Explore pipeline ▾` carets, `Build ▾` split half | their dropdown contents are unattested; a caret that opens nothing is worse than none |
| `Enter description…` in place, `Table details`, `Copy` beside Location | 2026-era About panel; recorded in the reading §7 |
| Edit schema | 789 stores the options; the editor is a form over them, not yet drawn |
| per-column description | no column on `dataset_schemas.fields` for it |
| Monitoring + Related schedules on the Health tab | compose `MonitoringPanel`; a small chunk, queued |

---

## 2. The shell every screen shares — **observed, not yet reconciled per product**

Three captures of the same shell (`dataset.png`, `dataset-data-health.png`,
`stream.png`) agree on a resource header: app icon, breadcrumb ending in the
resource with a star, `File ▾ Help ▾`, an organisation pill, the branch chip,
a three-count pill, `Share`, a list icon; then a tab row with the action bar
on its right. Our pages each own their header (`feedback_no_top_bar`), and
none renders the star, Share, File/Help or the pill. Whether every Foundry
product shares this header is a claim to verify against each product's
captures — the critic pass of the map workflow — not one this map makes yet.

---

## 3. The other families

**Batches A and B are walked** — eight families, against the captures, each
gap refuted. **Batch C is not**, and its section says so rather than guessing.

Each family gives the routes, our page and its size, the captures opened
against the total its pages reference, and the surviving gaps with the engine
behind each one named. A gap recorded with its reason is not a defect of this
map; an element we render that no capture or sentence shows is, and those are
listed as *unattested* per family.

**What the walked half is actually made of.** Across the eight families the
readers proposed 176 gaps and the refuters overturned 19 of them, added 23 the
readers had missed, and reversed 23 not-gap and unattested claims. The
recurring finding is not a missing screen — it is **an engine the screen cannot
reach**, and second to it, **a stale reason in our own source** explaining an
absence that stopped being true when some later migration shipped. Four of
those stale reasons are named in §3.4, §3.5 and §3.8; one of them is written in
a reading as well as in the code.

### Batch A — walked against the captures 2026-09-13

Four readers (one per family) opened the product's main captures, read our
pages' source, and listed gaps, not-gaps and *unattested* elements (things we
render that no capture or sentence shows); four refuters then tried to
overturn every claim. Counts per family: **Home/Projects** 51 verdicts, 5
overturned; **Pipelines** 20 verdicts, 9 overturned; **Data Health** 41, 5;
**Explorer/Object Views** 44, 0 — plus 12 not-gaps and 11 unattested claims
overturned the other way. Everything below survived that pass; where the
refuter narrowed a claim, the narrower form is what is written.

**One finding is not a surface gap and is fixed in the same PR as this
section:** every Build the web could start was refused by the engine.
`features/builds/api.ts` sent `p_build_type` as `single`/`full`, and
`SchedulesPanel` inserted the same tokens, where `run_build` (507) admits only
`manual`/`upstream` and `schedules.build_type`'s CHECK (506) agrees —
`buildQueue.test.ts` even asserts the refusal. The generated union
`SchedulesBuildType` had carried the right tokens all along; the web now uses
it, so the next drift is a compile error. The Build button on the dataset
view was dead on arrival for the same reason.

#### 3.1 Home and Projects (Compass) — the family to build next

**Routes / ours:** `/` (`HomePage.tsx`, 108), `/projects` (`ProjectsPage.tsx`,
429, with `features/compass/FilesCard.tsx`), the shell
(`features/platformShell/`). **Sections:** `compass` (10 / 39), `projects`
(9 / 20, duplicates of compass), `getting-started` (home, sidebar, quicksearch
captures). **Readings:** `home-and-navigation.md`, `compass-folders.md`,
`compass-activity-log.md`, `project-documentation.md`,
`request-access-to-a-project.md`. Captures opened this pass: 14 of 53.

**Home (`getting-started/images/homepage.png`).** Built: the NAVIGATION
column, the welcome banner, three audience sections of 3-column cards with the
capture's titles and taglines verbatim. The operator's "Data Ops stripped
empty" is not the home page — five Data Ops cards render — it is what the
Dataset card opened onto, which §1 fixed. Gaps: card **order** diverges from
the capture in all three sections (Data Ops reads Dataset, Code repositories,
Data Lineage, Projects, Catalog — ours puts Code repositories last; small).
Unattested and ours: the "is sunset" paragraph under each section, the
welcome sub-line's wording, the hexagonal artwork, the scroll-tracking TOC.

**Sidebar and shell (`compass-files-landing-page.png`, `recent.png`,
`favorite-area.png`).** Surviving gaps: Recent lists **resources** ("the last
20 resources you have opened or interacted with"), ours lists up to 8 app
routes client-side; favourited resources (a starred folder, a starred object
on the collapsed rail — the two starred *apps* beside them are built); the
empty favourites state (`APPS · View all` / "Your favorited apps will appear
here." — ours hides the group); an `Ontology` sidebar row between Files and
Applications; `What's New`; the bottom cluster (AIP Assist, Support panel,
Other Workspaces — no engine); the Applications Portal's promoted apps, search
and tags. Unattested: `Settings` and `Sign out` as sidebar rows (kept by
`feedback_no_top_bar`; Foundry reaches both through the Account panel);
`Vertex` filed under Analyze data where `vertex/explore-object-relationships`
attests **Operational Applications** — wrong, not inferred.

**Files landing page (`compass-files-landing-page.png`) — LARGE.** Foundry's is
a table, not a grid: tabs `Portfolios / Projects / Your files / Shared with
you`; a dismissible Quick filters band (Portfolios / Projects / Promoted items,
each with a sentence and `Apply`); one search box `Search all portfolios,
projects, folders and files…`; a `Filters` rail (Types with counts, Status,
Portfolios, Projects, Tags, Organizations); a table `FILE NAME (+ grey path) /
LAST MODIFIED / TAGS / PORTFOLIO` with an org-count chip and inline `Request
access` on rows the viewer cannot open; a namespace chip and gear; green
`+ New project` with `Manage spaces ⚙` beside it. Ours: a card grid of
projects with name, api name and description, and a separate `Discoverable`
strip. Engines: portfolios (555) and promoted status (499/556) exist; tags
(`resource_tags`) exist; the personal project exists (499); last-modified
exists on every kind's table. Unattested and ours: the page subtitle, the
mono `apiName` under each project (Foundry projects have RIDs, no API name),
the card grid itself, the `Discoverable` strip's form.

**Create new project (`new-project.png`, `create-new-project.png`).** Gaps: the
space picker ("select a location"); `Organizations · Any of` (which
organisations may see the project — no engine); project templates
(`create-project-from-template` in the api; the lesson's "Select the Default
Template"); the pane is a modal with a green `Create`, ours an inline card.
Unattested: the slug preview; the placeholder `Bar inventory` (hospitality
residue).

**Project dashboard (`project-dashboard.png`, `project-navigation.png`,
`project-details.png`, `promote-resource-project-view.png`,
`your-files-data.png`) — LARGE.** Foundry's: a header with the name, star,
gear, description, `Actions ▾` and green `+ New ▾`; a **navigation rail** —
`Preview › Cover page`, `Project workspace › Files / Autosaved / Project
Catalog / References (File, External) / Trash`, then `Project usage ↗` and
`Access graph ↗`; a `📌 Pinned` strip; a Files **table** `NAME / LAST UPDATED /
TAGS` with a type icon per kind; a row toolbar and context menu (Rename,
Move…, Copy link, Copy RID, Request additional access, Edit requirements…,
View markings, Add tags…, Add to Data Catalog…, Pin in project, Change
status ▸ Promoted, Move to trash…); a `Move` window with a location picker;
a Share panel; Trash as its own area; the personal project's reduced nav.
Ours: a stack of cards under the selected grid card — a `Contents` list of
raw resource ids, a folder tree with an in-row move select and inline trash,
an inline `New folder…` form, Activity, Policy, Access. Engines: folders and
trash (497/498), promoted status, tags, cover pages (676) exist; Autosaved,
References, Project usage, Access graph, Pinned, Share and link sharing do
not. Unattested and ours: the `Contents` card, the in-row move select, the
inline new-folder form, the inline trash block, the folder header sentence
(which also contradicts `compass-folders.md`'s correction that folders carry
role grants).

**Project details panel (`project-details.png`, `access.png`).** Foundry's is a
right rail of icon tabs — Overview (Description, Documentation Add/Edit/View,
Point of contact, Metadata: RID, Location, Space, Iceberg storage, Tags,
Portfolio, Status, Collections, Created, Last modified … by, Views), Access
(`Requirements | Check access`; `Roles ⓘ Manage ›` AND `Organizations · Any
of` AND `Markings ⓘ Add ›`), Activity, and two more. Ours: always-open cards
with roles only. Gaps: the Overview tab's fields for an accessible project;
Access as the three-way composition with Organizations and Markings
(`resource_markings` exists for projects); `Check access` on the project
(engine 486 exists; the panel is composed on the dataset view only);
`Resource queues` (no engine); project-level Documentation distinct from the
cover page. The `Approval policy` card is attested by
`foundry-branching/protecting-resources` as a **Branch protection tab** —
ours is the right content in an unattested form. `Request access` by role is
mislabelled: a Discoverer sees "Request additional access" where
`security/projects-and-roles` distinguishes "Request project access".

**`+ New` palette (`new-project-resource.png`, `create-dataset.png`).** Ours has
no `+ New` anywhere: a folder is an inline input, a dataset is created from
`/datasets` unscoped to any project or folder, and nothing creates a
repository, workbook, analysis, module or web link from a project. Foundry's
is one searchable palette — Folder, Web link, then every resource kind,
grouped by the six category names the Applications Portal already carries,
with `⇧N`; and `+ New › Upload files…` from a folder.

**Quicksearch.** Built: `⌘J`, the JUMP TO dialog, kind pills, HOTKEYS footer,
object-instance search (443). Gaps: full results mode (the `All search results
for '…' ⏎` row, the `Apps / Objects / Datasets / Files` tabs, filters,
ranking); personalisation by favourites; the `Files` kind over folders,
restricted views, modules and repositories.

**Build order for this family:** the Files landing table with its tabs and
filters; the project dashboard's navigation rail and Files table; the `+ New`
palette (which is also how a dataset gets created *in a folder*, closing the
Compass end of §1's chain step 1); then the details rail. Portfolios wait on
space roles (§3.9); Share, Autosaved, References and Pinned have no engine
and are not built until they do.

#### 3.2 Pipelines — builds, schedules, lineage, branching

**Routes / ours:** `/builds` (`BuildsPage.tsx`, 83), `/lineage` and
`/lineage/:kind/:id` (`LineagePage.tsx`, 311), `/branches` (`BranchesPage.tsx`,
156), the branch taskbar in `OmaLayout.tsx`. **Sections:** `building-pipelines`
(45 / 181), `data-lineage` (20 / 71), `foundry-branching` (14 / 53),
`data-integration` builds/schedules pages. **Readings:**
`builds-and-schedules.md`, `data-lineage.md`, `branch-overlay.md`. Captures
opened: 14 of 69 — the refuter found four unread live-logs captures on disk.

**The build report (`data-integration/images/builds.png`,
`live-logs-build-page.png`; two eras, 2022 and 2024).** Foundry's is a page:
`Build info` (Status in title-case with a spinner, Duration, Estimated,
Started, Ended, Started by, Progress `0 of 4 jobs succeeded`, Build ID with
copy); a `Build schedule` card (the schedule that started it, WHEN TO BUILD
as dataset chips, RECENT RUNS dots, Metrics/Schedule); `Build progress` as a
Gantt with the legend Queued/Waiting/Running/Succeeded/Failed/Canceled, a
Job status filter and a Dataset path search; a per-job Datasets table (name +
path, start, duration over `Typically …`, a stage progress bar, Logs,
Actions, `Job type:`, the four-step timeline); `Cancel build`, `Explore
lineage` and the three-count pill in the header; a log viewer (Wrap lines,
Filter, View live, Download, colour-coded levels). Ours: a card per build
with the API token (`SUCCEEDED` where the capture prints `Succeeded`), a
truncated id, `12.3s`, and an inline job list. Engines: most of Build info and
the Gantt's facts exist (493/506/507, `builds.schedule_id`); `cancel_build`
and job logs do not. Unattested and ours: the header paragraph, the empty
state's SQL-JobSpec sentence, the 8-character id, the accordion. The builds
*list* itself has no capture — it is "all builds occurring across Foundry" in
prose only.

**Schedules (`data-lineage/images/manage-schedules.png`,
`manage-schedule-details.png`, `building-pipelines/images/advanced-settings.png`,
`add-more-schedules.png`).** Foundry's sidebar sits on the lineage canvas,
scoped to the selected datasets ("You will see the schedules related to
selected datasets in your graph"); a card is `name / Last updated N days ago
by / Full build X and N other datasets / When X has new data and N other
triggers`; the detail has `Latest run was ignored`, the target list with
paths, `Plus N upstream datasets`, `When to build` as a sentence, `Build
scope` as a project chip, Learn more / Metrics / Share. The **Build schedules
application** (`add-more-schedules.png` — the refuter found the capture) has
search-parameter chips, sort, bulk select and a name filter. Ours: a panel on
the `/lineage` root picker only, listing every schedule; one target dataset
where the column is an array; a raw cron field (attested by
`triggers-reference` — "A time trigger is defined using a cron expression and
a time zone" — but the editor also offers "an easy-to-use interface", which
we lack) and a free-text timezone; `Allow overlapping runs` only of the six
Advanced options; create/pause/delete but no edit and no versions. Gaps in
order of size: the Build schedules app (no route); edit + versions; multiple
targets, excluded datasets, the connecting build type; the five missing
Advanced options; scope (§3.2 survey bullet, still standing); schedule health;
and a dead pointer — the dataset view's Schedules panel says "Create one from
the builds page" and `/builds` has no schedule control (fixed in this PR to
point at `/lineage`).

**Data Lineage (`data-lineage-ui-reference.png`, `data-lineage-build-helper.png`,
`build-timeline.png`).** Foundry's canvas: flat coloured node cards with `‹ ›`
chevrons that expand parents/children in place, badge glyphs, straight
arrows; a branch selector with fallback branches; a toolbar (Tools, Layout,
Undo/redo, Clean, Select, Expand, Color with 24 colourings, Find, Remove,
Align, Legend); a right rail (Search & Browse, Properties/Histogram, Manage
builds, Manage schedules, Related artifacts); bottom node tabs `Preview ·
History · Code · Data health · Build timeline`; Save/Open, share links, SVG
export. Ours: a root-picker landing page (unattested — Foundry opens onto an
empty graph from a resource's Actions or Search & Browse), a global
`Ancestors: N / Descendants: N` depth counter instead of per-node chevrons,
bezier edges without heads, a static legend, a six-fact drawer, `Focus
lineage here` (ours), a 300-node cap Callout (no cap is documented). Built and
attested: marking simulation with the four states, out-of-date colouring,
defines-object-type badges, object types as nodes and link types as edges.
Engines: `lineage_graph` (facts for the colourings), `run_build` for two of
the three Manage builds strategies, `dataset_preview` (804) for the Preview
tab, `build_jobs` for the Build timeline; branches on the graph, saved graphs
and artifact nodes have none.

**Global Branching (`foundry-branching/images/branches-tab.png`,
`create-new-branch-dialog-from-global-branching.png`, `branch-overview.png`).**
Foundry's app: `Branches · Proposals` tabs; a homepage with `Your open
proposals`, `Your open branches`, and three shortcut cards; a Branches table
`BRANCH NAME (+ description) / STATUS / CREATED BY / CREATED AT / PROPOSALS`
with Status/Created-by filters and search; a branch page (`Branches › name`,
Overview with the resources on the branch, comments, a `Branch details` rail,
a Security tab of role assignments); `Branch security [Advanced]` in the
create dialog. Ours: a flat list scoped by an ontology select, with the slug
beside the title, `Restore` on rows, `terminal` on merged rows; no branch
route. Engines exist for the table (419's creator/date/description) and the
branch page's resources; branch roles (419) have no surface. Unattested and
ours: the ontology select, the slug beside the title (a Foundry branch name
may itself be a slug — only the *second* identifier is ours), `terminal`, row
`Restore`, the `Branching` title (the app is `Global Branching`).

**The branch taskbar (`branch-taskbar.png`).** Built to the capture: the blue
bottom bar, branch name, resource count, Create/View proposal. Gaps: the
selector should open a dropdown to switch or create (ours resets to Main);
the folder badge should open the modified-resource panel; `View branch ↗`;
`Merge proposal` enabling on the bar. Unattested: a `Beta` tag; the silent
auto-named proposal (the page shows a Create proposal dialog).

**Build order:** fix the tokens (this PR); the build report as a page; the
schedule editor's interface over the cron and the canvas-scoped sidebar;
lineage's per-node chevrons and node tabs (Preview via 804); the Branches
table and branch page.

#### 3.3 Data Health and monitoring

**Routes / ours:** `/data-health` (`DataHealthPage.tsx`, 134;
`features/dataHealth/HealthPanel.tsx`; `features/monitoring/MonitoringPanel.tsx`).
**Sections:** `data-health` (11 / 15), `health-checks` (a duplicate section the
reading had marked absent — `watch-alerts.png` is there), `monitoring-views`
(7 / 15). **Readings:** `data-health.md` (its line 34 wrongly records
`watch-alerts.png` as missing — to correct), `monitoring-views.md`. Captures
opened: 26 of 31.

**The Data Health application (prose only — no capture of the `All checks`
listing exists; `create-group.png` is the sunset Check groups tab).** Gaps:
`Add health check` in the app's top-right with the multi-dataset resource
dialog; a user-chosen sort by status or name (ours is fixed worst-first);
`Pause all`; the failed-check notification to watchers (the notifications
engine 793 exists, this producer does not); pipeline health in Data Lineage
(nodes coloured by check status, a Data health tab, right-click `Add health
check`). Unattested and ours: the header blurb, the tab label `Health checks`
(the old capture says `All checks`), one Card per dataset, the empty-state
copy, the eye icon as a watching marker.

**Monitoring view — Troubleshoot alerts (`troubleshoot-alerts.png`,
`run-history-redirect.png`, `snooze-*.png`).** Built to the capture: the back
link, three tabs, `Alert summary` dots, the ALERT/RESOURCE/FAILURE
REASON/REPORTED table, `Since … / Last checked`, `Hide snoozed alerts`, the
snooze dialog's grammar, the snoozed-bell hover. Gaps: `View options ▾`,
`Group by project ▾`, `Filter by type ▾`; the `Filters` and `Context Panel`
rails and the bottom selection toolbar (snooze lives there); **`View
details` → the alert debug page, which is not rendered at all** (the engine
writes `monitoring_alert_transitions`; nothing reads it); `Data Lineage ↗` /
`Run history ↗` from a row; the resource's path under its name; snooze until a
picked time rather than a preset list. Unattested and ours: the view list as
a card grid with RIDs, the bell as the snooze trigger, the four preset
durations, the `Alert summary` counting only failing alerts.

**Manage monitors (`data-health-add-monitoring-rule.png`).** Gaps: the
four-step `Create monitoring rules` wizard (Select scope → Configure →
Select view → Summary) with `Dynamic` scopes; suggested thresholds; editing a
rule from a side panel; the dynamic scopes Workflow Lineage / Workshop /
Developer Console (no engine — recorded); project scope for schedule rules;
an SOP on a rule; adding checks through the app's dialog. Unattested: our
rule-list row grammar, the `Health checks` card inside the tab, `s` units.

**Manage subscriptions (prose only).** Gaps: PagerDuty, Slack and Webhooks
sections (no engine); alerting at a specific severity rather than "and
above"; and subscribers receiving anything at all — no producer sends the
in-platform notification the page promises.

**The alert debug page — WITHDRAWN as a gap (2026-09-14), with the page's own
sentence.** This section listed it as a large unbuilt screen whose data was
already written, and `readings/monitoring-views.md` had already recorded the
reason it is absent; the Batch A reader did not carry that reason across, and
this entry repeated the overstatement. The page scopes itself:

> "The alert debug page only provides detailed diagnostics for function and action type resources with single-condition monitoring rules. If you open the page for a composite monitoring rule or a rule on another resource type, you are redirected to the **Troubleshoot alerts** tab."
— monitoring-views/alert-debug-page.md

**Every monitoring rule this platform can create is on another resource type**
— function and action-type rules are the second-tranche families §3.3 records as
unbuilt — so Foundry itself would redirect away from this page for all of them,
to the tab we already render. Building it would be building a screen the
product hides from our own data. It waits on the resource families, not on a
surface, and `monitoring_alert_transitions` having no reader is that same wait
rather than a defect. Workflow Lineage's monitoring-status colouring has no
engine either.

**This is the second map claim withdrawn against the source** (the first was the
cron renderer in §3.8). Both were written as "the engine is there, build it",
and in both the engine was there and the page said not to.

**The dataset Health tab (`health-checks-overview.png` new era; the 2018
captures for the editor).** Beyond §1's row: **the `Time since last updated`
defect is FIXED (2026-09-14)** — the form offered the type and never wrote
`ignore_empty_transactions`, which 659's CHECK requires beside the threshold,
so every such insert was refused. The capture draws the flag under the rule and
`checks-reference` gives its default as **Y**; both are now what the form does.
Still open: the median-deviation clause; `Weekly…` with
day toggles and `On a custom schedule…`; `Notes`; Issues (no engine —
recorded); **`Edit` an existing check** (policy exists, no mutation); `Watch ▾`
as a menu (`watch-alerts.png`) and `Watch all ▾`; the per-check rail with
`Monitoring views` and `Details`; Pause/Delete under `More ▾`. Unattested and
ours: the empty-state copy, the `Escalates` tag, the interval as a clock tag,
the inline watch select, `n passed / n failed / n error` header tags (the
capture prints `Checks 15 ●7 ●8`).

**Build order:** `Edit` on a check (the `ignore_empty_transactions` defect is
fixed); `Add health check` on the app and the four-step wizard; then the tab's
table shape from §1. **Not** the alert debug page, per the withdrawal above.

#### 3.4 Object Explorer and Object Views

**Routes / ours:** `/explorer` (`ExplorerHome.tsx`, 174), `/explorer/:typeId`
(`ExplorationPage.tsx`, 664, with ActionsMenu/ExportMenu/SaveDialog),
`/explorer/saved/:setId` (70), `/objects/:typeId/:pk` (`ObjectViewPage.tsx`,
298). **Sections:** `object-explorer` (17 / 90, one era), `object-views`
(23 / 75, three eras). **Readings:** `object-explorer.md`, `object-views.md`.
Captures opened: 16 of 108. The refuter overturned none of the reader's 44
gaps — this family's reading is exact — and corrected two era notes (undo/
redo and `Compare ▾` are in the object-explorer section itself).

**Explorer home (`home_general.png`).** Built: the headline, saved explorations
and lists at the top, groups with counts, the preview drawer, hidden types
excluded, `Other` for the ungrouped. Gaps: the scope selector `All ▾` inside
the search bar (the lesson's first step); the `Overview | Objects | Object
types | Artifacts` tabs and the **search results page** with facets (large);
the left side navigation (All / My explorations & lists / groups / Favorites);
favourites (no engine); `List | Graph` per group (the group graph over
`link_types`); the card's description line; linked types in the preview; the
window tab strip (several explorations at once); the `Explorations ▾ / Lists
▾` pickers with `All | Favorites | Created by Me | Shared with Me`; `All object
types` always present at the bottom. Unattested and ours: object hits in the
type-ahead that navigate to the *type* rather than the object.

**Exploration (`exploration_flights.png`, `explore_search.png`,
`pivot_flights.png`, `results_view.png`, `results_results_preview.png`).**
Built: the results chip, Explore/Results, one chart per prominent property,
listograms and histograms, the two-pane search menu with linked types,
far-property predicates (776/777), all four temporal filters (785), title
cells to the Object View, hint-gated sorting, Actions over the selection with
the 1000 cap, Export, Save as Exploration/List, derived properties excluded.
Gaps, large first: **the search bar as the filter hub** (pills inside the bar,
typing offers `where <Property> is <value>`, `Has keywords`, term modifiers,
And/Or nesting); layouts (`Flight Layout ▾`, Set as default — no engine);
undo/redo and `Compare ▾` (no comparison store); the **Selection Preview**
(selecting rows opens the Object View on the right); pivot to a linked type
with carried filters as link-path pills; `Open in ▾` (no route); `Share` and
`Monitor` in the header; the statistics table (`aggregate_object_set`
exists); histogram range inputs; listogram multi-select with Keep/Exclude
(Exclude's meaning is `object-explorer.md` §14's open question); the other
chart kinds and drag reorder; charts on linked objects; the preview rail's
`Sort by` and clickable cards; results-table paging, column tools and
`Freeze X columns`; time-series columns with sparklines; inline edits;
`Filter by <LinkedType>?`; `Private` saves to a home folder; pills naming
properties by id rather than display name (small, in hand). Not-gaps the
refuter corrected: multi-sort's precedence is inverted ("the last one selected
… takes precedence"), Export should be Excel, `Actions ▾` belongs in the
perspective bar. Unattested and ours: the back arrow, `Add filter` as a
separate button, two `Has X? / Has no X?` buttons, the Actions placement, the
20-row `Show more` cap.

**Saved exploration / list.** No capture shows a saved set as its own screen —
the picker opens the exploration itself with filters and layout restored.
Ours is an intermediate table page (unattested whole). Gaps: opening into the
exploration; the pickers; manually updating a list (`Add to list ▸`);
formatted cells; saved sets in the home search's Artifacts.

**Object View (`object-explorer-object-view-edit.png`,
`standard-full-and-panel-object-view.png`, `linked-objects-component.png`,
`results_results_preview.png`).** Built: configured view by default with the
standard view a toggle away (once an `object_views` row exists — for other
types ours lands on the standard view with no toggle), tabs as Workshop
modules, prominent above normal, linked objects by link type with paging, the
OMA authoring tab. Gaps: the header shows the **primary key** where the
capture shows the title property's value (small, in hand); header controls
(star, refresh, `View comments`, `More ▾ › Add to list / Export as Excel /
Copy for Notepad / Advanced ▸`); `Actions ▾` in the header rather than inside
the Properties card; the standard view's `★ Prominent` and `☰ Properties` as
two sections with `Media | Map | Time series` and per-base-type displays (the
series formatter 782 has its consumer here); the **linked objects component**
as a table with search, `Open N in ▾`, inline preview and the multi-hop
breadcrumb; the panel form factor (no form-factor column on `object_views`);
tab conditions, profiles and the `Link` badge; the Edit History widget's shape
(actor, "changed N properties using <action>", the changed values — all
stored in `object_edits`, unread). Unattested and ours: the type-status tag in
the header, Edit history as a *standard*-view section, the `Sensors` card, the
label-above-value prominent cards.

**Build order:** the search bar as the filter hub and the Selection Preview
(both engine-complete); the Object View header and Prominent/Properties split;
the search results page; then layouts once a store exists.

### Batch B — walked against the captures 2026-09-14

Same method as Batch A. Counts: **OMA core** 34 verdicts, 1 overturned;
**Actions and Functions** 44, 5; **OMA governance** 35, **13** — the most of
any family, and all of one kind: the reader imported the *Global Branching
application's* Proposals-tab controls into the Ontology Manager's Proposals
page, which is a different application and not a route here; **Automate and the
inbox** 47, 5. Eleven not-gaps and fifteen unattested claims were overturned
the other way — a striking share of them in our favour: seven strings the
Actions reader called our invention are the page's own words
(`Auto upgrade`, the non-breaking-version warning, the function-permissions
callout, `OntologyEdit[]` as a return, the section-description sentence).

**The through-line of this batch is not missing screens; it is engines the
screen cannot reach.** Nine of the surviving gaps name a column, function or
generated value that exists, is correct, and has no caller — and three name a
stale *reason* written in our own source for why something is absent.

#### 3.5 Ontology Manager core — chrome, Discover, object types, shared properties, link types, interfaces

**Routes / ours:** `/ontology` (`DiscoverPage.tsx`, 83), `object-types` (877),
`shared-properties` (101), `link-types` (73), `interfaces` (41), all inside
`features/ontologyManager/OmaLayout.tsx` (381). **Captures opened:** 13 of 42.
`ONTOLOGY-BUILD-MAP.md` and `ONTOLOGY-CREATION-REVIEW.md` already map this
family's *content*; what follows is its *shape*, which they do not.

**The chrome.** The top bar is an app tile, a centred search with `⌘K`, a
`⑂ Main ▾` chip and an outlined **`New ▾`** — the single documented entry point
into every creation helper, with nine entries. **Our header has no create
control at all**; every page keeps a permanently-open creation form instead,
which is also why four of this family's "unattested" findings are those forms.
The sidebar's `Resources` block lists seven rows with counts; ours omits
`Properties` (a flat index across every object type — `object_type_properties`
has existed since 408 and nothing queries it across types), `Groups` (416, and
it now has a writer), and files `Value types` outside OMA entirely. Searching
from the header **re-facets the sidebar** — a `Search results N` row appears and
every count becomes a match count — where ours opens a modal list.

*Overturned:* our `⌘K` not-gap fails in two halves — `resources.ts` folds `rid`
into the search terms for object types and interfaces only, and `aliases` for
one kind. *Unattested but attested after all:* the sidebar's project control —
both current-era Discover captures show a location control in that slot.

**Discover.** **The type-group chips are BUILT (2026-09-14)** — the card's own comment gave
"nothing counts either" as the reason and 416's groups have had a reader and a
writer since the F6.6 chunk; one query answers every card. **`N dependents`
stays absent, with a corrected reason**: 580 does count them, but
`object_type_dependent_counts` answers for ONE type, so a card grid would issue
a request per card. It wants a batch reader, which is a migration rather than a
wiring — the old reason was wrong in a way that hid a real one. Other gaps: Favourites
(no engine), favourite type-group cards drawn as miniature link graphs (large),
`Configure` per section with the `Customize homepage` dialog (no store for a
per-user arrangement), and the new-user fallback pair, which *replaces* the
three default sections rather than joining them. Unattested and ours: an
`OntologySummary` block no capture shows, a plain `Object types` section that is
none of the three the page names, and a `Not indexed` tag where every card in
every capture carries an object count.

**Object types — the largest structural divergence in the family.** The list is
a **table** (`NAME / STATUS / VISIBILITY / ISSUES`) with a funnel over
visibility, development status and indexing issues, a column gear, row
checkboxes and a bulk `Edit status`; ours is a card grid. And **opening a type
replaces the sidebar** with that type's own rail plus a back link — ours nests
vertical tabs inside the list page, so list and detail are one screen. The
object type view also carries a bottom **datasource-preview panel** over the
backing rows, which is the one gap here already engine-complete: `804`'s
`dataset_preview` renders exactly that grid on `DatasetPage.tsx` today.
Unattested: the permanently-expanded `New object type` card, a per-row `↻` full
reindex, a `v{version}` tag, and an `Edit properties` mode Foundry does not have.

**Shared properties — the edit defect is FIXED (2026-09-14).** A shared property
could not be edited after creation, which is the entire reason the type exists:
`useUpdateSharedProperty` was written, typed and wired to nothing. The row now
edits in place over the three fields `save_shared_property` accepts, and the
`VISIBILITY` column — stored since 329 and printed nowhere — is the capture's
third column. **What remains** is Foundry's four-tab editor (General / Display /
Interaction / Details) with its Usage and Permissions tabs; the inline row is a
subset of it. *Overturned:* our "deletion
refused while a type still inherits" not-gap is a **divergence running the
wrong way** — the page documents bulk deletion.

**Link types.** No `New link type` and no five-step helper (one of three
documented entry points exists); no list table; the view should replace the
sidebar with `← Link types` and a four-page rail. A `Properties` card on a link
type has **no store** — `link_type_properties` is in no migration.

**Interfaces.** No capture of the list page exists in the mirror. Gaps: both
`New interface` entry points and the helper behind them; marking a property
required or optional at authoring (`interface_properties.required` exists and
every property lands `true`); dashed-border icons, which the refuter promoted
from prose to capture-attested; and the project choice inside the helper.
Unattested: a checkbox matrix of every object type on every interface row, and
the inline `key:type · key:type` property list.

#### 3.6 Action types and Functions

**Routes / ours:** `/ontology/action-types` (`ActionTypesPage.tsx`, 567),
`/ontology/functions` (400). **Captures opened:** 14 of 37.

**There is no per-action-type resource page — the family's largest gap.** An
action type cannot be opened, linked to or navigated back from; `App.tsx` routes
only the list, and the OMA search deep-links *to the list*. `action_types` has
carried a RID since 488. Six of the nine rail pages Foundry gives an action type
have no counterpart at all: Overview, User Interface, Capabilities, Automations,
History, Observability.

**No wizard.** Foundry's creation is a modal with a five-step rail (Action type /
Mapping / Metadata / Submission criteria / Save location) and a six-tab kind
taxonomy; ours is one always-open form with a flat `<select>` of snake_case
engine tokens. Step 4's submission criteria and step 5's save location cannot be
set at creation — and `action_types.project_id` has existed since **454**, which
the refuter established against the reader's "unknown".

**Rules.** The whole `OTHER` half of the Add-new-rule menu — webhook and
notification side-effects — does not exist, and has no engine. Three of the
engine's seven value sources cannot be authored: `VALUE_SOURCES` is hand-written
with four members while `action_rule_value_sources()` returns seven. `Add link`
inside a Create-object rule is not offerable. The function-rule exclusivity rule
**is** enforced (418 raises `Ontology:FunctionRuleIsExclusive`); what is missing
is the builder greying the menu, so the author meets the refusal at save time.

**Two defects the refuter surfaced; one is FIXED (2026-09-14) and it was worse
than reported.** `FormEditor.tsx` offered `Type class` as a fourth *default
source*, and `default_source`'s CHECK admits `static` and `object_property`
only — so the option wrote a value the column refuses and could never save **in
any state**, not merely when its second field was empty. Type classes are a
separate column (`type_classes`, a prefill hint), so they are now their own
control, offered whatever the default source is and asked of
`action_parameter_type_classes()` rather than restated. Still open:
`action_type_parameters.value_type_id` — the binding that constrains a
parameter with a value type — has existed since **452** and nothing in
`apps/web/src` reads or writes it.

**Seven of our strings are Foundry's.** The refuter overturned them all with
citations: `Auto upgrade`, the amber non-breaking-version warning, the functions
permissions callout, `OntologyEdit[]` as a selectable return, the section
description sentence, the criteria `None`-over-groups warning, and the `Apply`
control on an OMA action list (`view-usage.md` presupposes it).

#### 3.7 Ontology Manager governance — proposals, rebase, health, cleanup, advanced, history, value types

**Routes / ours:** ten `/ontology/*` pages plus `/value-types` (287).
**Captures opened:** 14 of 98. **Thirteen of 35 gaps were overturned** — every
one of them a Global Branching control imported into the OMA Proposals page.
What the OMA capture actually lacks is a search box and a sort control; the
checkbox-close, the bulk selection and the Status/Creator filter belong to an
application this repo does not route, and our archive-closes-proposal behaviour
is what the page documents.

**Main branch updates — the page's primary content is absent.** Incoming changes
from main are not rendered at all; only conflicts are. No `Cancel rebase` and no
in-progress state, because `rebase_branch` (470) takes every resolution at once.

**The proposal view** lacks the Preview-status and Changelog tabs, the
three-step stage rail, per-task comments (no store), `Tasks requiring
attention`, suggested reviewers, and the per-field diff of what the branch
changed — and that last one is engine-complete:
`branch_resource_changes.fields`/`.base` hold exactly it.

**Health issues is entirely uncaptured**, and its own header cites
`ontology-manager/health-issues`, **a page that does not exist in the mirror** —
a false citation in our source, of the kind CLAUDE.md rule 1 exists to prevent.
Index failures, the only content the docs attribute to this screen, do not
appear on it. *Overturned:* the layout is not uncalibrated — `save-review-edits-error.png`
shows the same four levels; what is unattested is only its placement here.

**Advanced** is missing the `Ontology metadata` card entirely, and the
`Ontology settings → Roles` card — **ontology-level role grants have no surface
anywhere**, though `ontology_role_grants` exists with RLS and CRUD grants since
454. **Ontology configuration** is missing the whole project-permission
migration assistant (no engine).

**Cleanup** lacks the GROUPS and ACTION columns and the `Propose your changes`
toggle that turns a cleanup into a proposal — all three engine-backed.
*Overturned:* the `not computed here` tag belongs on one flag, not two; 579 made
`no_registered_usage` computable.

**Value types**: **metadata editing is BUILT (2026-09-14)** — display name,
description and failure message, editable at any time and minting no version,
which is what the docs say and what `useUpdateValueTypeMetadata` had always
been able to do while nothing called it; it was the same written-and-unwired
shape as shared properties. Still open: the constraint picker is a fixed five,
unfiltered by base type (`value_type_constraint_base_types` is generated and
unused), and `uniqueness`, `nested` and `element` cannot be authored.

#### 3.8 Automate, Approvals, Checkpoints, Notifications

**Routes / ours:** `/automate` and `/automate/:id` (`AutomatePage.tsx`, 504),
`/approvals` (277), `/checkpoints` (512), `/notifications` (104).
**Captures opened:** 15 of 41.

**Automate.** **Pause and mute are BUILT (2026-09-14)** — a `⋯` on every row of
the Automations table and the same pair on the detail, writing the column that
622's `AFTER UPDATE` trigger turns into the metadata event. The five-status
filter pane had counted `Muted` and `Paused` since 609 with nothing able to
produce either. Also built: the **`For you`** card, whose omission was reasoned
when the notification effect was `executable = false` and stayed written in two
places — `AutomatePage.tsx` and `readings/automate.md` Decision 5 — after 793–803
built the engine and 794 flipped the effect; and the **Creator** column, which
printed the word `Owner` where the capture holds a person. `Owned by you` now
counts the ones you own rather than the ones you can see.

**One map claim is withdrawn.** This section said the condition chip could print
`At 09:00 AM` because `automationScheduleCron` "already parses the expression".
It does not: its body extracts a cron from an object-set payload and returns
NULL for a time condition. `features/automate/api.ts` refuses to half-parse a
cron on the stated ground that "a half-done parser would mislabel the ones it
cannot read", and that refusal stands. Rendering a cron into English is a real
gap with no engine behind it.

What remains:
- **There is no edit path.** An automation is create-once: no condition, effect,
  scope, auto-mute or expiration can be changed after creation.
- The Overview should draw an `Automation flow` graph (condition → effects)
  beside an `Automation details` card; ours is three text sections.
- The Event log has no per-event drawer — and `automation_runs.event_id` **does
  exist** (622, indexed, written and asserted), against the reader's claim.
- The condition chip prints the stored cron; rendering it as `At 09:00 AM`
  needs a cron renderer nothing here has.

**Approvals.** The whole `Additional filters` card is absent though every
attribute is already in the listing payload. **The `action_required` hole is
closed (2026-09-14):** the sixth request state, re-added by 665, was missing from
the web's hand-written union, so such a request rendered an undefined label; the
union is now the generated `ApprovalRequestsStatus`, the state counts as open,
and a request parked there carries the page's own explanation and a
`Complete and re-invoke` button running `retry_approval_request` through the
checkpoint gate — which is what "eligible reviewers can complete checkpoints on
behalf of the requesting user" describes.
**None of the five Approvals notifications is sent**, though `sendNotification`
has been live since 793. Comments cannot be scoped to a task although
`comment_on_approval_request` takes `p_task`. No `+ Invite reviewers` — and that
one has no engine. *Overturned:* the Reject dropdown's captions do **not** match
the capture, and `Tasks ineligible for your approval` is attested verbatim in a
capture the reader skipped.

**Checkpoints.** Four of six documented filters are missing. Two not-gaps fell,
both the same way — a generated value existed and the page hardcoded instead —
and **both are fixed (2026-09-14)**: `spaceScopable` asks
`space_scopable_checkpoint_types()`, and the condition-kind picker asks
`checkpoint_condition_kinds()` with `KIND_LABEL` as display names and a
humanised fallback, so a fifth kind appears rather than vanishing.

**Notifications.** `getting-started/images/notifications.png` is the
notifications **panel** — an anchored popover with a `See all` footer — a second
surface of this product that no reading had opened. Our page's claim to be built
from the only capture of the *page* survives, narrowed.

### Batch C — governance and the application cards

**3.9 Control Panel, Settings, Account** — `/control-panel` (242),
`/settings` (732), `/account` (30). Survey findings, every one an engine with
no surface:
- markings administration (categories, members, permissions; `manage-markings.md`, 22 images) — **large**; two of the eleven checkpoint types can never fire until it exists
- applying a marking to a resource (`resource_markings` write path; `security/markings.md` captures for project, folder, dataset)
- space roles (`space_roles`, `space_role_grants`; `manage-orgs-and-spaces.md`, `manage-roles.md`)
- portfolios (`portfolios`, `portfolio_curators`; `security/portfolios.md`, six captures) — blocked on space roles: nobody can create one today
- organisation role grants and custom roles (`organization_role_grants`, `organization_roles`; `manage-roles.md`, `organization-permissions.png`)
- audit exports (`audit_exports`, `create_audit_export`; `security/audit-logs-overview.md`, `audit3-export-control-panel.png`)
- CBAC configuration — **no mirrored page shows a UI**; only `cbac_marking_restrictions` is safe to expose

**3.10 Workshop and Slate** — `/workshop` (417), `/slate` (636). Sections:
`workshop` (122 / 504), `slate` (47 / 158). Survey: `workshop_events` and
`workshop_overlays` (685/687) have no configuration panel — "Events in
Workshop execute sequentially in their configured order" (`concepts-events`),
and `concepts-layouts` enumerates "the header, pages, sections, and overlays";
`workshop_modules`' settings (686) have no panel.

**3.11 Code Repositories, Code Workbook, Fusion** — `/code` (556),
`/workbook` (441), `/fusion` (329). Survey: workbook templates (709 — the
"Creating a Template" step of `templates-getting-started`), branch dataset
pins (708 — the branch header showing the pinned transaction, and the
fallback read rule the table's COMMENT quotes).

**3.12 Quiver, Contour, Vertex, Modeling, Catalog** — `/quiver` (575),
`/contour` (471), `/vertex` (411), `/modeling` (721), `/catalog` (131).
Sections: `quiver` (292 / 442), `contour` (33 / 163), `vertex` (28 / 150),
`model-studio` (10 / 11), `manage-models`. Survey:
- Quiver dashboards (696/697) — the Dashboards side panel (`dashboards-create`, `dashboards-in-analysis`); card input slots (`quiver_card_inputs.slot`) — editor shape undocumented
- Contour dashboards (704 — "Add to dashboard", `dashboards-getting-started`); the histogram aggregate and column pickers and the pivot toggle (706, `boards-descriptions`) — cheapest finding, engine already right
- Vertex Search Around (711/712 — `explore-object-relationships`), Save as Template (712 — `graphs-template`), layers and versions (711 — `graphs-display-options`, `save-share`)
- Modeling: objective checks and approvers (700 — `manage-models/set-up-checks`), metric sets and experiments (699 — `model-integration/objectives`, `experiments`)

---

## 4. Thirteen hooks nothing calls

The map's recurring finding — an engine no screen reaches — has a web-side
twin, and `scripts/probes/unwired-hooks.mjs` counts it: **a `use*` hook
exported from a feature module that no other file names and whose own file
never calls it.** On 2026-09-14 the answer was fifteen. Two were the
shared-property editor and the value-type metadata editor, and both turned out
to be user-visible defects — the mutation existed, was correct, and could not
be reached (#974, #977). Two more were leftovers from this map's own dataset
rewrite and are deleted. Thirteen remain:

| module | hook | most likely |
|---|---|---|
| `checkpoints/api.ts` | `useCheckpointConditions` | a reader for a record's conditions, which the Review tab's detail does not show |
| `codeRepositories/api.ts` | `useMergeModes` | a vocabulary picker (`merge_modes()`) with no control |
| `fusion/api.ts` | `useCellTypes` | the same shape |
| `modeling/api.ts` | `useTrainers`, `useCreateCheck` | `useCreateCheck` is the objective-checks surface §3 of the survey named |
| `objectTypes/hooks.ts` | `useDeleteObjectType`, `useObjectTypeProblems` | deletion has a control elsewhere; the problems reader is what `ISSUES` on the list table wants (§3.5) |
| `quiver/api.ts` | `useDataTypes`, `useConnectCards` | `useConnectCards` is the multi-slot card editor the survey recorded as undocumented |
| `slate/api.ts` | `useIdentifierPrefixes` | a vocabulary picker |
| `vertex/api.ts` | `useEventTypes` | a vocabulary picker |
| `workshop/api.ts` | `useEventKinds`, `useUpdateModule` | both named by the survey: the widget event list and the module settings panel |

**Six of the thirteen are vocabulary hooks** — a set the database publishes,
fetched by a hook, offered by no picker. That is the same defect as the two
Checkpoints hardcodes in #974 seen from the other end: there, the picker
existed and ignored the vocabulary; here the vocabulary is fetched and no
picker exists.

**The probe is not a gate, deliberately.** `check:shape` and
`check:vocabulary` were deleted with `shape_registry` because they needed an
allowlist to tell "deliberately ahead of its runtime" from "dead", and
CLAUDE.md's lesson is that **wanting an allowlist is the signal to index
instead**. A hook written before its screen is legitimate here; a red build
would only teach people to add exemptions. So it reports, and each entry is
resolved one of three ways in the file itself: wire it, delete it, or say in a
comment what it waits on.

## Order, and why

**Reading, then building, one family at a time.** A family is walked (a
reader and a refuter against its captures), then read (`readings/<topic>.md`,
its Decisions block read by a human), then built, then reconciled. Datasets
went through all four; **Home and Projects is at step two** —
`readings/compass-files-and-projects.md` is written and its Decisions block is
waiting.

1. **Datasets** — done: built 804–806, reconciled, merged.
2. **Home and Projects** (§3.1) — read; building next. It is where a user
   lands, it is what the dataset view's breadcrumb points at, and its `+ New`
   palette is how a dataset gets created *in a folder*, which closes the
   Compass end of the chain's first step.
3. **The engine-cannot-be-reached list**, which is cheap and crosses families:
   the stale reasons (§3.4 `For you`, §3.5 Discover's dependents, §3.8's two),
   the written-and-unwired mutations (shared-property edit, value-type
   metadata, `retry_approval_request`), the hardcoded arrays where a generated
   value exists (§3.8 Checkpoints, §3.6 `VALUE_SOURCES`), and the two saveable-
   looking controls that cannot save (`type_class` defaults, the
   `Time since last updated` check).
4. **Pipelines** (§3.2) and **Data Health** (§3.3) — the build report and the
   alert debug page are the two largest screens whose data is already written.
5. **Explorer and Object Views** (§3.4), then the rest of the Ontology
   Manager's shape (§3.5–3.7).
6. **Batch C** (§3.9–3.12) last, and unwalked until then: the governance
   surfaces are gated on one another (portfolios on space roles; the schedule
   rule on schedule scope) and the application cards carry hundreds of
   captures each.

Each build rewrites its section here the way §1 was rewritten — from a gap
list into an element table with a verdict per row.
