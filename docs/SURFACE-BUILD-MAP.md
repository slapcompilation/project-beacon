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

## 1. Datasets — the dataset view — **BUILT** (804 + `DatasetPage.tsx`), reconciled 2026-09-12

**Reading:** `readings/dataset-preview.md` — 5 pages, 15 of 15 captures.
**Engine added:** 804 — `dataset_preview` (the sample, sorted and filtered
before the LIMIT, gated by `can_read_dataset_data`), `dataset_preview_count`,
`dataset_column_stats`. **Surface:** `pages/DatasetPage.tsx` at
`/datasets/:id`; `pages/DatasetsPage.tsx` is the way in.

**Before:** one card list, one "New dataset" button, and a stack of panels
under a selected card (About, Upload, Transform, Access, Check access, Health,
Columns, History, Files). No rows were ever shown — nothing read
`datasets.<table>` but the indexer.

### What the annotated capture shows, and what is built

Read off `dataset-preview/images/dataset.png`, the capture
`dataset-preview/overview.md` numbers 1–5.

| region | element | status |
|---|---|---|
| 1 header | app icon, breadcrumb ending in the dataset, star | breadcrumb **built** (`dsv-crumbs`); star **not built** — no favourites engine |
| 1 header | `File ▾  Help ▾` | **not built** — "sharing, moving, renaming" have no engine reached here |
| 1 header | `🏢 1` organisation pill | **not built** — meaning unattested |
| 1 header | `⑂ master ▾` branch chip | **built** — native select over `dataset_branches` |
| 1 header | `⟳ 0 ✓ 0 ✗ 1` pill, `Share`, list icon | **not built** — the pill's meaning is question 1 of the reading; Share has no engine |
| 3 tabs | `Preview` `History` `Details` `Health (Beta)` | **built** |
| 3 tabs | `Compare` | **not built** — no engine; the newer captures also add `Time Travel`, `Snapshots`, `Maintenance` — not built |
| 5 actions | `SQL preview` | **not built** — needs a SQL dialect over the view (`sql-console.md`) |
| 5 actions | `Analyze data ▾` | **built, partial** — opens `/contour` without preselecting the dataset (Contour's page has no dataset parameter yet) |
| 5 actions | `Explore pipeline ▾` | **built** — `/lineage/dataset/:id` |
| 5 actions | `All actions ▾` | **built** with our four members (Upload file, Create restricted view, Check access, Copy RID); Foundry's members are unattested (question 2) |
| 5 actions | `Build ▾` | **built** — `run_build` on this dataset; the split-button's second half is not |
| 2 panel | name; `About / Columns / Schedules` | **built** (`dsv-segment`) |
| 2 About | description; backing object-type chip with gear | description and chip **built**; the gear **not built** |
| 2 About | `Updated … by …`, `Created … by …` | Updated time **built**, no "by" — nothing records who last wrote; Created **built** with the creator when `created_by_user_id` is set (the create path does not set it yet — a gap) |
| 2 About | `Location`, `Type`, `RID 📋` | **built** |
| 2 About | `Size — 12 columns / 481 rows / 2 files` + `584KB` | columns/rows/files **built**; bytes **not built** — not stored |
| 2 About | `Updated via` | **built** by inference (decision 7): the job's transform, else "Upload" |
| 2 About | `Tags / Add tags` | **not built** — no tags engine |
| 2 Columns | column list with type; "description, and data stats" | list + type **built**; a click opens the stats dock; per-column description **not built** |
| 2 Schedules | schedules that update the dataset | **built** — filtered on `target_dataset_ids` |
| 4 grid | `Showing 300 of 481 rows` / `12 columns` / `Search columns…` | **built** (`dataset_preview_count` is the denominator; the whole-table form is `Showing N rows`) |
| 4 grid | row numbers; name-over-type headers with a menu glyph; italic `null` | **built** |
| 4 grid | column menu (`dataset-preview.png`): Pin, Encrypt, Filter ▸, Sort asc/desc, View stats, View cell content, Copy column name, Expand | Sort asc/desc, View stats, Copy column name **built**; Pin, Encrypt, Filter ▸, View cell content, Expand **not built** |
| 4 grid | cell menu: Include only, Exclude, View stats, View cell content, Copy | Include only, Exclude, View stats, Copy **built**; View cell content **not built** |
| 4 grid | filter chip `end_borough: "Manhattan" ✕` | **built** |
| 4 grid | stats dock: Normal/Null/Empty/Whitespace/Needs trim, Numeric/Non-alpha/Uppercase, LENGTH histogram, VALUE by count | Normal/Null/Empty/Whitespace/Distinct and VALUE by count **built**; Needs trim, Numeric, Non-alpha, Uppercase, the LENGTH histogram **not built** (decision 3) |
| 4 grid | drag-and-drop upload onto the preview window | **built** — the grid wrap is the drop target; the empty state carries the picker |
| History | rail: relative time, status icon, `Snapshot • Jane Doe`, `Part of build • 1 job`, duration; `Filter` | time, icon, type, build/upload line, duration **built**; the person **not built** — transactions record no user; `Filter` **not built** |
| History | Summary: `Date range`, five cards, `Job duration` scatter | five cards **built**; date range and the scatter **not built** |
| History | job detail (`create-branch.png`): `Job progress` segments, `Inputs and outputs`, `Compare with…`, `… › Create branch` | detail **built** with state, error, times, commit/abort for an open transaction; progress segments, inputs/outputs, compare, **Create branch not built** — nothing creates a child dataset branch (ingestion.md question 4) |
| Details | Schema (editable), Files (downloadable), Job spec, Syncs, Custom metadata, Resource usage, Last run | Schema, Files, Job spec **built** read-only; Edit schema, download, and the other four **not built** |
| Details | (ours) Access requirements, Check access | **built-but-unattested here** — Foundry reaches Check access from the resource's Access menu; placed under Details as inference, said so in the code |
| Health | `Show failures only`, `Search monitors…`, `+ Add checks`; Checks table; Monitoring per view with `Rules`; Related schedules | the Checks half **built** by `HealthPanel` (659/660); the Monitoring and Related schedules sections on *this* tab **not built** — `MonitoringPanel` exists at `/data-health` but is not composed here |

### What building it turned up

- **`created_by_user_id` is never written.** `useCreateDataset` inserts
  without it, so "Created … by" has nothing to say. Fix: a default of
  `auth.uid()` on the column, forward.
- **The physical table's own policy is the weaker predicate.** 393's
  `rows follow the dataset` checks `can_read_dataset`; the data predicate
  (401) also requires the propagated data markings. 804's readers gate on the
  stronger one, so the screen is right; the table's policy is not, and a
  direct `SELECT` by a caller who lacks a data marking would still see rows.
  Recorded for a forward fix — it predates 804 and is outside its title.
- **Two runs sharing one `.env.local` race.** The platform suite and the
  web suite run "as CI" (env moved aside) cannot overlap; one silently skips
  66 files. The full suite is run alone before this ships.

### Not built, with the reason

| gap | why |
|---|---|
| SQL preview / console | needs a query language over the view; `sql-console.md` names Spark SQL |
| Compare, Time Travel | a diff engine over two views; Time Travel is beta and needs a key-column diff |
| Create branch from History | no function creates a child dataset branch; ingestion.md question 4 |
| Tags, star, Share, File/Help | no engine for any of the four |
| header pill | unattested meaning |
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

## 3. The families still to walk — surveyed for engines, captures queued

Each family below lists the routes, our page and its size, the mirror
sections with their page and image counts, and what the 2026-09-11 survey
found *reached by no surface* (each finding refuted once against the source;
the refuters for two areas did not run). **The capture reconciliation for
these families is queued in three batches**; the batch column says which.
Nothing below asserts what a capture shows, because for these families I
have not opened them this pass.

### Batch A — the chain's core

**3.1 Home and Projects (Compass)** — `/` (`HomePage.tsx`, 108 lines: a
navigation page from `readings/home-and-navigation.md`), `/projects`
(`ProjectsPage.tsx`, 429). Sections: `compass` (10 pages / 39 images),
`projects` (9 / 20). The operator's report is that the Data Ops group on Home
is empty; Foundry reaches a dataset through a Compass folder, and
`create-dataset.png` shows the `+ New` menu searching "dataset" across
`All / Analyze Data / Build & monitor pipelines / Data Governance / Manage &
deploy models / Operational applications`. Survey findings: none in scope.

**3.2 Pipelines** — `/builds` (`BuildsPage.tsx`, 83), `/lineage`
(`LineagePage.tsx`, 311), `/branches` (`BranchesPage.tsx`, 156). Sections:
`building-pipelines` (45 / 181), `data-lineage` (20 / 71), `foundry-branching`
(14 / 53), the builds and schedules pages of `data-integration`. Survey
findings, all with an engine and no surface:
- schedule scope (`schedules.scope`, `scope_project_ids`, `guard_schedule_scope`) — a user/project toggle and project picker on the schedule dialog; "All schedules should be Project-scoped when possible" (`building-pipelines/scheduling-best-practices`)
- schedule health (`health_checks.schedule_id`, the `schedule_status` check) — a Health panel beside the runs list; "it is recommended that all schedules have schedule status checks" (`data-health/checks-reference`)
- the build report's job detail (`job_blocked_by`, `job_spec_input_state`, `job_spec_version`) — a "waiting on build X" line, an object/link-type name where the output is not a dataset
- dataset branching (`parent_branch_id`, `head_transaction_id`, the `_from` readers) — a Create branch control; "A child branch can be created from another branch, or from any transaction" (`data-integration/branching`)
- branch roles (`branch_roles`, `guard_last_branch_owner`) — a Roles list on the branch detail
- the link index pipeline (`run_link_index_build`, `link_type_index_state`) — the same index tag and Reindex control object types have, on `LinkTypesPage`
- per-input marking stops (`dataset_input_marking_stops`) — two pages disagree on where it lives (`data-integration/views` vs `building-pipelines/remove-inherited-markings`); settle first

**3.3 Data health and monitoring** — `/data-health` (`DataHealthPage.tsx`,
134; `HealthPanel`, `MonitoringPanel`). Sections: `data-health` (11 / 15),
`monitoring-views` (7 / 15). Survey: `monitoring_alert_transitions` has no
reader — the "Alert history" section of the alert debug page, "a timeline of
monitor status transitions for this rule over the past 30 days"
(`monitoring-views/alert-debug-page`).

**3.4 Object Explorer and Object Views** — `/explorer` (`ExplorerHome.tsx`,
174), `/explorer/:typeId` (`ExplorationPage.tsx`, 664), `/explorer/saved/:setId`
(70), `/objects/:typeId/:pk` (`ObjectViewPage.tsx`, 298). Sections:
`object-explorer` (17 / 90), `object-views` (23 / 75). Survey: the time-series
formatter (782) has no display surface, and no capture of one was found —
read `time-series`'s object-view pages before drawing it.

### Batch B — the Ontology Manager and what acts on it

**3.5 OMA core** — `/ontology` (Discover, 83), `object-types` (877),
`shared-properties` (101), `link-types` (73), `interfaces` (41).
`ONTOLOGY-BUILD-MAP.md` and `ONTOLOGY-CREATION-REVIEW.md` map this family;
two UI eras exist in its captures (CLAUDE.md). Survey residue:
- the Require-values gear (`allow_empty_arrays`, 670) — "Require values" with a gear opening `No null values / No empty arrays` (`object-link-types/required-properties`, two captures parsed in `readings/required-properties.md`, decision 5)
- the value-type constraint picker (`value_type_constraint_base_types`, 575) — the picker filters by base type; `uniqueness`, `nested`, `element` cannot be authored (`object-link-types/create-value-type`, `value-type-create-constraint.png`)
- type classes (`ontology_type_classes`, 710) vs the Capabilities tab's own table — a two-store split to settle before any surface
- materializations: two engines answer one tab (453's `object_type_materializations`, reached; 515's `object_datasets`, not) — a choose-one

**3.6 Action types and Functions** — `/ontology/action-types`
(`ActionTypesPage.tsx`, 567), `/ontology/functions` (400). Survey residue:
- override blocks (666: `action_type_parameter_overrides`, `guard_override_condition`) — an Overrides tab per parameter, "Every parameter can contain multiple override blocks" (`action-types/parameters-override`; three captures parsed in `readings/action-form.md` §2). **Large.**
- the schedule rule (`action_type_rules.schedule_id`, 668) — a Schedule rule card; blocked on schedule scope (3.2): "The schedule must be in project-scoped mode" (`action-types/trigger-schedule-build`)

**3.7 OMA governance** — proposals (315), main-branch-updates (122), health
(121), cleanup (266) and flags (145), advanced (98), configuration (108),
history (165), unsaved (49), `/value-types` (287). Survey: nothing beyond 3.5.

**3.8 Automate, Approvals, Checkpoints, Notifications** — `/automate`
(`AutomatePage.tsx`, 504), `/approvals` (277), `/checkpoints` (512),
`/notifications` (104). Sections: `automate` (37 / 113), `approvals` (3 / 14),
`checkpoints` (7 / 14). Survey: `retry_approval_request` and the
`action_required` state have no surface — an "Action required" tag, the
gate's comment as the reason, a Retry button (`approvals/overview`,
`task_checkpoints.png`).

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

## Order, and why

1. **Datasets** — done above; it is the chain's first screen and the one the
   operator named.
2. **Batch A** next, because a user who has just landed data goes to Home,
   to Compass, to the build and to the explorer in that order, and each of
   those screens is what the dataset view's action bar links to.
3. **Batch B**, because the Ontology Manager already has its own map and the
   residue is small and precise.
4. **Batch C** last: the governance surfaces are large and gated on one
   another (portfolios on space roles; the schedule rule on schedule scope),
   and the application cards each carry hundreds of captures.

Each batch lands as its own reconcile pass and rewrites its section here from
"queued" to a table like §1's.
