# What is left to build

The only planning document. It says what is NOT built; the moment something
ships, its entry is deleted rather than annotated. A file that accumulates
"✅ SHIPPED" lines becomes a history, and history is what git is for.

**When there is a queue again, it is derived, not judged.** The last one was
first ordered "by the size of the structural absence", which meant by my
estimate of it, and then re-derived from Foundry's own architecture:
`object-backend/overview` names six services and draws how they connect, and
`readings/ontology-backend-architecture.md` maps each one onto ours. An entry
earns its place by being a connection the diagram draws and we do not — not by
looking important.

Every service has a counterpart — Ontology Metadata, object databases, Object
Set Service, Actions, the Object Data Funnel, Functions on Objects. What is
missing is not a service. It is wiring.

---

**The build order is finished, so it is gone.** Sections 1-6 were deleted on
2026-08-22 under the rule above, having stayed here after they shipped. That is
not tidying: entry 1 still read "not yet built" for work 513 did and told the
reader to hang it off `mark_index_stale_on_commit`, a trigger **534 deliberately
deleted** — so the one document whose job is "what to build next" opened by
sending you to rebuild a shipped thing with a removed part. Entry 3 called
Automate "mirrored (42 pages) and unread" while 37 of 37 pages were read and ten
migrations had been built from them.

**A finished entry is worse than no entry.** Delete it the day it ships; a
reader cannot tell a stale queue item from a live one, and this file is read as
instructions. Every residual those six entries named is preserved below in
**Known gaps** — replacement pipelines, and Automate's queue and run ceilings.

---

## The deprecation audit (2026-08-15)

Every page carrying a **planned deprecation** callout was checked against what
we build. The result: **one** deprecated design had reached the schema.

| deprecated in Foundry | what we have |
|---|---|
| Object Storage v1 (Phonograph), "unavailable after June 30, 2026" | `object_type_indexes.status` was its scalar. 520 replaced it and 534/535 dropped it. |
| Writeback datasets (OSv1's edit persistence) | never built — we built object datasets, the OSv2 replacement |
| "Ignore inherited permissions" | never built; C1 recorded the deprecation as the reason folders organize and never gate |
| "Propagate view requirements", superseded by Projects and Markings | never built; we have both replacements |
| Metric changed [Sunset] (Automate condition) | excluded by name in the Automate reading |
| Gaia Milsym Creatable interface | not our domain |

### Re-run 2026-08-18 — 14 pages carry the callout, and nothing new reached us

The mirror has grown from 2,284 pages to 2,807 since the audit above, so the
scan was re-run. Fourteen pages now carry a **planned deprecation** callout, and
they resolve to the same six findings plus three that are new and none of ours:

| new callout | what we have |
|---|---|
| **Pipeline rollback** (`data-lineage/pipeline-rollback`), "unavailable for use after November 30th" | never built. The only `rollback` in our tree is the SQL transaction kind, in a migration and a test — checked, not assumed. |
| **Map's Series panel** (`map/series-panel`), "unavailable after January 31, 2026" | not our domain; we build no Map. |
| **Language-model deprecation and brown-out** (`model-catalog/model-deprecation`) | a model-catalog concern; we have no model catalogue. |

Eight of the fourteen are **Object Storage v1** restating itself across
`object-backend`, `object-databases`, `object-edits`, `ontologies/oss-limitations`
and inline in `action-types/getting-started` — all already the first two rows
above. `platform-overview/development-life-cycle` is not a deprecation at all;
it is the page that **defines** the phases the callouts link to.

**Re-run this when the mirror grows.** `grep -rl "planned deprecation"
docs/foundry-reference/mirror/` is the whole scan, and it is cheap. A page can
acquire the callout between one reading and the next, which is how a build
copies a design Foundry has already left.

## The eleven Home applications (opened 2026-08-26)

Foundry's Home draws seventeen application cards; we had six. The operator
asked for the other eleven, which reverses CLAUDE.md's standing note that
Contour, Vertex and Code Workbook are "products this repo does not build" —
recorded here rather than quietly overwritten. **Their Spark execution model
is still a non-goal**: those three get their shape and semantics on Postgres,
with the divergence stated in whatever migration builds them.

Measured before starting, because seven of the eleven have no pages on disk:

| card | section | mirrored | known URLs |
|---|---|---|---|
| **Workshop** | `workshop` | 122 | 123 |
| Quiver | `quiver` | 291 | 295 |
| Slate | `slate` | 47 | 47 |
| Code repositories | `code-repositories` | 36 | 36 |
| Code workbook | `code-workbook` | 43 | 43 |
| Contour | `contour` | 33 | 33 |
| Vertex | `vertex` | 28 | 28 |
| ~~Reports~~ **[Sunset]** | `reports` | 22 | 22 |
| Fusion | `fusion` | 22 | 22 |
| ~~Forms~~ **[Sunset]** | `forms` | 19 | 19 |
| Machine Learning | `model-studio` + `model-integration` | 31 | 32 |
| ~~Data prep~~ **[Sunset]** | `preparation` | 8 | 8 |

**THREE OF THE ELEVEN ARE SUNSET IN FOUNDRY AND ARE NOT BUILT** (measured
2026-08-27, before building the first of them). Each carries a `[Sunset]`
callout on its own overview naming its replacement:

- **Forms** — "will be deprecated at a future date... We recommend building
  user input workflows with the Ontology to represent relevant data
  structures as object types and configure writeback interactions with
  **Actions** and **Functions**" (`forms/overview`). We already have that
  replacement: action types with parameters, the form engine of 666/667,
  submission criteria, `apply_action`, and reverts (682). Building Forms
  would add a SECOND, deprecated way to do what we already do the current
  way.
- **Reports** — "We recommend migrating your workflows to other
  applications and tools" (`reports/overview`).
- **Data prep** (`preparation`) — "We recommend migrating your workflows to
  **Pipeline Builder**" (`preparation/overview`), a product we do not have.

This follows the rule the deprecation audit above exists for: **do not
build a design Foundry has already left.** That audit's whole finding was
that exactly one deprecated design ever reached our schema; building these
would knowingly make it four. The Home cards say so rather than standing
silently absent. Verified at product level: Fusion, Quiver, Contour, Code
workbook, Vertex and the model family carry no product-level sunset —
Quiver and Vertex mention deprecation only on individual feature pages.

**So the programme is eight buildable, not eleven.** Three complete
(Workshop, Slate, Code Repositories); five to go — Fusion, Quiver, Machine
Learning, and the three Spark products last.

**All eleven now have their pages on disk** (#847): the eight absent
sections were mirrored on 2026-08-26 — 206 pages and 753 images, no
failures — after refreshing the URL index, which turned up one new page.
MAP.md went from 4,131 pages across 108 sections to 4,329 across 116.
Two slugs had to be found rather than guessed: Data prep is `preparation`,
and Machine Learning is the model-studio/model-integration family beside
the 17 pages of `manage-models` we already hold. Three sections read one
short of their URL count and all three are counting artifacts, verified
rather than assumed: `questions-answers/contour`,
`questions-answers/vertex` and `model-integration/model-studio` live in
other sections and were already mirrored.

**So no arc is blocked on fetching any more** — each remaining card needs
only the loop: read the section whole, reading PR, recite, build,
reconcile.

- **Workshop** — FOUNDATION SHIPPED (685/686,
  readings/workshop-foundation.md). A module is a Compass resource in a
  project (Viewer opens, Editor edits — the roles the page names, not a
  stricter invention), holding pages, nesting sections with the captured
  six layouts, overlays of exactly two kinds, widgets, variables and
  ordered events. **The layout tree is rows, not jsonb** — a blob would be
  unqueryable and its six layouts unconstrainable — while widget config IS
  jsonb, which is Foundry's own shape ("Raw Widget Configuration displays
  how the current widget's setup is stored in JSON"), not a shortcut.
  `workshop_widget_kinds()` INDEXES the catalogue rather than allowlisting
  it: six built, the rest recorded with the page that would build them, and
  the database refuses an unbuilt kind by name. Surface: module list,
  view/edit modes to the captures, the builder rail with Header as a peer
  of the pages and one marked DEFAULT, the widget picker with the picker's
  own categories, and the six renderers. **Residuals, each its own arc**:
  running events (they are stored and validated, not yet executed), widget
  variable propagation (a filter list computes counts but does not yet
  drive the table), the ~56 catalogued widgets, style formatting, mobile
  and vertical headers, loop layouts, embedded modules, scenarios, state
  saving, routing, translations, kiosk/redact modes, module interface, and
  the five layout templates the capture names (Details, Grid, Inbox,
  Overview, Settings) with no page describing what each produces. 115 of
  the section's 122 pages remain unread.

  **Post-build reconciliation** (the seven pages re-walked option by option
  against the shipped schema) found four gaps, two structural enough to fix
  rather than record — 687: **variable-backed visibility**, which the page
  gives to overlays ("a Boolean variable... will determine if the overlay
  should be visible") AND to sections ("conditional visibility to show or
  hide based on variable values"), plus the overlay's **On close** event
  and the **Enable scrolling** option Rows alone is offered. Whether a
  thing renders is a property of the thing, so those are columns, added
  before anything depended on their absence; a trigger holds what a CHECK
  cannot reach — the variable must be Boolean and of the same module.
  Recorded rather than built, from the same walk: section **drop zones**
  (cross-app interactivity, its own page), and **cut/copy/paste** of
  sections and widgets with its two variable modes ("Paste with same input
  variable" / "Paste with duplicate input variables").

- **Slate** — FOUNDATION SHIPPED (688/689,
  readings/slate-foundation.md). An application in a project, with pages
  as scope boundaries, a widget tree with the dropdown's five container
  types (split carrying its axis), variables in the six published types,
  event/action pairs, and one local stylesheet. **Slate is NOT Workshop**,
  and the migration says why: Workshop's data is the object layer by
  principle, Slate's is queries against anything; Workshop lays out
  nesting sections, Slate positions widgets on a canvas. Sharing 685's
  tables would force one shape onto both.

  **`slate_identifiers` is the load-bearing table**: every widget, query,
  variable and function shares ONE namespace, because "Shared variable
  names must be unique across all pages, widgets, events, queries, and
  functions" — one unique index rather than four each saying half of it,
  with page-local variables the documented exception. The probe found the
  sharper version: once the prefix guard holds, a query cannot take a
  widget's name at all, so the convention IS the separation and the index
  catches what remains.

  NOT built, with reasons: **public applications** (their whole definition
  is an isolation boundary — no objects, datasets, actions or files — plus
  an org permission we lack; the kind is stored and a guard refuses it,
  because half-built isolation is worse than none), LESS compilation, and
  the ~40-widget catalogue, indexed by `slate_widget_kinds()` with six
  built. **Surface shipped**: the four-area editor the capture divides —
  action bar with the eight panel buttons in the capture's order, widget
  list as a tree under the Widget/Workflow toggle, canvas rendering the
  tree by container type, and the Widget Editor's four named tabs
  (Property, Layout, JSON, Events). Four panels have engines (Events,
  Styles, Variables, and Datasets which the docs say became Variables);
  the other four open a note naming the page that would build them rather
  than an empty shell. **Post-build reconciliation** (navigation re-walked
  element by element) found one defect and three gaps: the JSON tab
  "displays JSON errors and enables Update only after you make a valid
  change" while mine silently swallowed a parse failure — fixed, so the
  error shows and Update is disabled until the draft is valid AND changed;
  and "exit to view mode" is a named action-bar element, now a View mode
  toggle hiding the three editing areas. Recorded, unbuilt: the canvas
  screen-size dropdown, the widget list's toolbar/canvas split, and the
  whole Undo-support section (deletion undo by toast or Cmd+Z, restoring
  event wirings). **689 is a correction the suite caught**: 688 opened a comment
  with "Values from the CONTAINER TYPE dropdown", and `Values from <slug>`
  is a promise the guard checks — it read `the` as a page. That set comes
  from a capture, so it now declares nothing and joins the printed
  undeclared count, as 682's did. Residual: the four-area editor surface
  (action bar, widget list tree, canvas, widget editor with its four
  tabs), and 39 unread pages.

- **Code Repositories** — SHIPPED (690/691,
  readings/code-repositories-foundation.md). Repositories typed transforms
  or functions, branches, files, commits, pull requests with reviews,
  checks and tags — plus all five tabs (Code, Branches, Pull requests,
  Checks, Settings). **The spine is enforced, not documented**: a commit or
  file write to a protected branch is refused by trigger, and the only way
  in is merge_pull_request, which opens a narrow window and closes it —
  the probe asserts master is protected again the moment the merge
  returns. The surface agrees with the guard rather than inviting a
  refusal: on a protected branch the editor is read-only and Commit is
  disabled.

  **Stated divergences**: not a git object store (commits are rows with a
  message and parent, files are current content per branch), and the IDE is
  not built — Code Assist, IntelliSense, the nine helper panels, the
  debugger, Clone, artifact repositories; Preview/Test/Build are drawn
  disabled saying so. Model development refuses by name (no model engine).
  ontology_branches are deliberately NOT reused: a code branch is git's.

  **691 is the correction reconciliation found, and it is the important
  kind — I had made us STRICTER than Foundry.** 690 blocked a merge on any
  rejection; the page makes that one of two separately-chosen review
  policies and says that otherwise "the approval will supersede the
  rejection". require_no_rejections is now a column, off by default. The
  same walk found a FIFTH protection requirement I had missed — Restrict
  stable version tags (Functions repositories only) — recorded rather than
  invented, since its semantics live on a section not yet read. Also
  recorded: advanced approval policies (ALL/ANY rules conditional on a file
  regex, with a YAML view). Residual: the transforms connection — a file
  declaring Output(...)/Input(...) IS a job spec, and generating one from a
  committed file is what makes this application load-bearing rather than
  adjacent — CLOSED by 692. 31 of 35 pages unread.

- **A transform file is a job spec** — SHIPPED (692). The connective arc:
  Code Repositories now feeds the build engine instead of sitting beside
  it. A .sql file's FILENAME declares its output dataset (the tutorial
  states exactly that), its backticked references resolve to input
  datasets, and its body after CREATE TABLE ... AS becomes the job spec's
  logic — with the backticks rewritten to the CTE names job_spec_query_text
  builds, which is the same move Foundry's editor makes when it swaps a
  backticked name for a RID. **The hook is Foundry's own**: publishing runs
  under the name ci/foundry-publish, because the page says that process is
  what makes changes take effect — and 690's protected-branch requirement
  already looked for a check of exactly that name, so the two halves met
  without either being bent. Python transforms refuse by name (they declare
  through decorators, and this platform does not run Python).
  **The probe caught a real design flaw**: raising on a publish failure
  rolled back the very check row recording it, so publishing now RECORDS a
  failed check rather than throwing — which is what a CI process does, and
  what the Checks tab exists to show. Residual: the Build button publishes
  but does not then run the build; wiring publish → build_jobs is the next
  step, and Python transforms remain unbuildable by design.

- **The Build button builds** — SHIPPED (693). Closes the loop: run the
  checks, then build every output dataset of the file, in that order,
  because the page says "build a new version of your output dataset after
  running automatic checks on your code". Three behaviours are the page's
  own rather than ours: checks run first and a file that fails them does
  not build (its failed check survives to say why), the build targets ALL
  output datasets of the current file, and a file that generates none
  triggers no build and does NOT error — "if the current file does not
  generate any datasets, no build is triggered". So a repository now runs
  the whole path: author on a sandbox branch, Build, and the dataset is
  rebuilt through the same build_jobs engine schedules use.

  **A tooling gap found here and worth knowing**: `pnpm gen:client` types
  every scalar function return as non-nullable, because Postgres does not
  record whether a function may return NULL — and this one does. The
  surface casts and says so; fixing it properly means typing every scalar
  return as `T | null`, which touches every caller and is its own decision.

- **Fusion** — SHIPPED (694). A spreadsheet whose table regions sync to
  datasets: spreadsheets/sheets/cells/regions, a grid surface, and
  `sync_table_region` opening a transaction, writing the schema from the
  region's column headers and their chosen export types, committing and
  materialising — which is exactly what the page describes ("you may see a
  number of finished and aborted transactions on the dataset"). Editor on
  the DATASET is required, as the page says, composed from the project-role
  predicate.

  **A sort REARRANGES the cells**, faithfully, because the page is emphatic
  that "a sort in Fusion cannot be turned off to return to the original
  ordering" — storing an order instead would be a divergence nobody
  notices. The surface says so before running one.

  **Formulas are stored, not evaluated, and the number is the reason: 202
  functions across five categories.** A cell keeps what was typed; the grid
  renders a formula in monospace with a title saying it is not computed.
  Same call as Workshop's 62 widgets. NOT built, recorded: lookups and
  index datasets, dropdowns and locked cells, formatting, templates,
  presentation view, XLS import, time-series visualisation, Actions from
  cells (the overview steers those to Actions anyway), multi-user cursors.
  15 of 22 pages unread.

  **A defect found while adding the Home card**: Slate had been built,
  routed and categorised since #851 but its Home CARD was never added — an
  earlier edit changed the section's "not built" note without landing the
  card itself, so Slate was reachable only by URL. Both Fusion and Slate
  now appear under Operations, which is four of the capture's five.

## Known gaps, not queued

**Automate: what is left after the queue.** The entry that stood here listed
three things blocked on the execution queue. The queue, manual execution and
auto-mute all shipped the same day (622-627), so the entry is deleted rather
than annotated — that rule is the reason this file's build order had to be
scrapped. What genuinely remains:

- **The 4-hour run ceiling.** Not built for a reason rather than by omission:
  effects run inside one transaction on one tick, so there is no long-running
  execution to time out. It becomes real the moment an effect leaves the
  transaction.
- **Auto-pause.** Its trigger is "excessive activity", with no threshold, metric
  or window on any page — the contrast with auto-mute's exact 80%-of-30 is what
  makes the difference visible. Not buildable without inventing a number.
- **Effect inputs.** Notification effects, per-object execution, batch size,
  parallelism and a manual run's input object set all need the objects that
  triggered a condition to reach the effects. Nothing carries them today, and it
  is the one absence several published settings sit behind.

**Platform-experience residuals.** Languages and Platform version stay out
with reasons recorded in `platform-experience.md`; the enrollment-scope
WRITER for logos and titles waits on enrollment-level permissions (the rows
exist and resolve, nothing may write them). The home page URL shipped in 650.

**The 2026-08-24 gap sweep's queue.** Measured against the live catalog, both
directions; the leftovers it found were deleted in 658 and the census widened
to every commentable catalog. What it recorded as build gaps, ranked:

- **Health checks** — ENGINE SHIPPED (659, reading
  `readings/data-health.md`): 21 of the 27 published types across all five
  families, config CHECKed per type, evaluation on transaction commit + a
  per-minute heartbeat for thresholds and manual intervals, MAD × 1.4826
  deviation, escalate-on-consecutive-failure, watchers with the page's three
  levels, pause. The surface followed (660 + the
  Health panel on the dataset page and the platform-wide /data-health
  listing — measured value, history dot-strip, watch menu, the check RID).
  The monitoring engine
  followed (reading #807, engine 661/662): monitoring views as filesystem
  resources, rules with one condition per severity over single/folder/project
  scopes, stateful (rule, target) alerts with transitions and platform-wide
  snooze, subscribers, a per-minute heartbeat. The Monitoring View tab
  followed (663 + surface): checks join views (health_checks.monitoring_view_id),
  the view list, Troubleshoot alerts with the Monitor/Check merge and
  alert-summary dots, snooze dialogs at alert and rule level, Manage monitors
  with the published scope availability, Manage subscriptions. Monitoring
  residuals: schedule rules are single-scope
  (published Single/Project — our schedules carry no location, 495); object/
  link, function and action rules blocked on run ledgers that do not exist
  (object_type_indexes is a status scalar); email/PagerDuty/Slack/webhooks
  (no notification system); the alert debug page (waits on function/action
  rules). Health-check second tranche = the four sync checks, dataset partition
  (Spark storage heuristic), transaction file size (we store no sizes),
  approximate column relation (cross-dataset), row-count-vs-last-result;
  notifications/emails and the Issues integration wait on those products.
- **Checkpoints** — ENGINE SHIPPED (664/665, reading
  `readings/checkpoints.md` #810): configurations (org XOR space scope,
  three justification types, reviewer-only name/description behind a column
  grant), conditions (AND/NOT, one matcher per kind), static-snapshot
  records + items, `submit_checkpoint`, and the operator-approved
  server-side `checkpoint_gate` wired by BEFORE triggers into eleven
  producing paths (group/marking members, role grants, schedules, builds) —
  claims-less system paths exempt. 665 returned `action_required` to
  approvals exactly as 651 scoped, with `retry_approval_request` as the
  reviewer's path. The surface followed (own PR):
  the /checkpoints app (Review with filters and the details panel;
  Configuration with the four-step wizard — Frequency omitted, login-only),
  the CheckpointHost prompt dialog (all three justification types, recent
  justifications, the capture's footer), and runWithCheckpoint wired into the
  group-member, role-grant, schedule and build mutations (the retry loop
  handles the multiple-checkpoints case). Residuals: submit_action via
  apply_action patch; login (needs a prompt-capable login path);
  reauthentication; object-set condition variants; per-item redaction; the
  space-admin and `checkpoints:review-records` review doors; requester
  completes-at-request-time in Approvals.
- **Action form trio** — ENGINE SHIPPED (666/667, reading
  `readings/action-form.md` #813): defaults as parameter columns (static and
  object-property with the above-in-the-list guard) + type-class prefills
  honoured server-side in apply_action (generate_uuid, prefill_current_user);
  override blocks with first-true-wins ordering whose conditions ARE the
  criteria tree (nullable override_block_id — one grammar); sections with
  columns/derived collapsibility and their own overrides; the
  action_form_effective resolver consumed by apply_action for requiredness;
  the equal-to-base warning in ontology_warnings. 667 made the Studio save
  path upsert parameters by api_name so form config survives a save.
  The surface followed (own
  PR): RunActionDialog renders from action_form_effective — sections with
  columns/collapse/always-shown descriptions, static and object-property
  prefills with the Edited chip (single-selection row supplies the object),
  override-driven show/hide/disable/require, values re-resolved as they
  change. Residuals: the Studio editor for defaults/overrides/sections;
  constraints storage (and with it constraints overrides); section
  conditional-override authoring UI.
- **The action Schedule rule** — SHIPPED (668/669, reading
  `readings/trigger-schedule-build.md` #816): kind `schedule` with its FK and
  project-scope + edit-time-permission guard; run_schedule_now gated by the
  applying-action window; schedule rules run first in apply_action;
  schedule_runs.rid (grammar inference) + value source `schedule_run_rid`
  (the set went function-valued); the save path carries schedule_id. 669
  corrected 668's double-registration (a live-patch anchor that appears
  twice replaced both — assert occurrence counts before splitting on one).
  Residuals: the builder surface (rules editor kind + run-RID mapping), the
  capture's Unique Identifier mapping type, parameterized schedules, the
  status-link value formatting. Notification and webhook side effects stay
  recorded-out (no machinery).
- **`required` properties are unenforced** — CLOSED (670/671, reading
  `readings/required-properties.md` #818): allow_empty_arrays joins the flag
  (the capture's two-switch gear); the index-time arm fails the build job by
  name, scoped by presence in the property's own datasource; the apply-time
  arm refuses a blank required value and binds a datasource's required
  properties when an edit touches it — the worked example's Budget/Genre
  case probed verbatim. Three latent defects surfaced and fixed on the way:
  the gather selected every backed column from every physical table (multi-
  datasource types could not index; scoped in 670, unassigned properties
  restored in 671 after the suite caught the collateral), and object_state's
  create path lost the primary key (edit-created objects reindexed into a
  null pk). Residual: the OMA Require-values toggle + gear surface.
- **Ontology history and restore** — ENGINE SHIPPED (672, reading
  `ontology-manager-save-session.md` §7): ontology_saves +
  ontology_save_changes recorded by BOTH landing paths (the working-state
  save and merge_proposal) before their deletes — per-field diffs for the
  history view plus a full post-save definition snapshot per resource;
  restore_object_type stages the entry''s definition into the working state
  (created-after stages a delete, deleted-after a recreate), reviewable and
  discardable, exactly the documented semantics. saved_at is
  clock_timestamp (the 495 intra-transaction ordering lesson). Post-build
  reconciliation against restore-changes.md and its four captures
  (2026-08-25): the engine holds every stated behaviour; every delta is
  surface-shaped, and the captures fix the structure for that PR — GLOBAL
  history is an OMA sidebar History entry between Proposals and Resources,
  titled "Ontology history", time-bucketed (THIS YEAR / LAST YEAR), one
  author+date group per save with per-resource rows ([kind icon] name |
  Edited/Created pill | open | chevron, collapsed by default); PER-RESOURCE
  history is a History tab in the resource rail with an Unsaved section on
  top ("not yet been saved or published"), section-grouped field diffs
  (GENERAL INFORMATION / PROPERTIES / DATASOURCES, strike-through old →
  new), and the anti-clockwise restore button ON EACH ENTRY; a footer
  bottom-left says last-edited when/by (derivable from the latest
  save_changes row). Pill vocabulary: our operation ''modified'' renders as
  the capture''s Edited. Residuals: that surface; hide-inaccessible and
  merge-by-author as view options; restore for the other five kinds is
  undocumented and stays unbuilt.
- **Property formatting** — ENGINE SHIPPED (673, reading
  `readings/property-formatting.md` #824): format_rules (ordered array,
  first match wins; conditions reference siblings by property_id text so
  copy-rules semantics are free) + value_formatting (numeric/datetime/user/
  resource_rid, typed by base type) as validated jsonb columns; the save
  path carries both; import_working_state refuses dangling rule references
  by the documented name OntologyMetadata:UnreferencedRuleSets — 634's
  caveat closed. Post-build reconciliation (both pages re-walked): engine
  holds every stated behaviour; deltas are surface-shaped plus one model
  note — Add-reference comparison values are representable in the values
  array but unvalidated (the rule editor implements them). Excluded with
  reasons: the Math rule kind (one sentence, no grammar), artifact GID
  (no artifacts), Fixed Values numeric base (named, never specified).
  Residuals: the property-pane cards + rule editor + copy-rules dialog +
  Explorer chip/formatter rendering, built to the captures (own PR).
- **CBAC** — SHIPPED (674, readings/cbac.md): cbac_banner (names joined //
  in category-then-name order, backgroundColors from the cbac_marking_colors
  side table — 463's markings.color deletion stands, the api attests color
  only in banner composition), cbac_marking_restrictions (disallowed /
  implied / required + both verdicts, userSatisfiesMarkings composing
  satisfies_markings), and the algebra upgrade the restrictions page
  attests: 'disjunctive' joined 399's category_type CHECK exactly where its
  comment planned, and satisfies_markings learned one-per-disjunctive-group
  + single-level implication (probe holds conjunctive behaviour unchanged).
  649's show-with-classification-banner toggle landed. Inference recorded:
  segment ordering, white text color, no transitive implication; both
  display types return one string (no short form stored). Surface shipped
  (675): platform_experience carries the caller's CBAC banner (composed
  over their CBAC-configured memberships, NULL when none), AppLayout wears
  it above everything, static banner hidden beneath unless the toggle says
  otherwise. Residuals: no authoring surface — the toggle's switch, the
  restriction relations and the colors table are SQL-only (649 has no
  banner form either); and the restrictions basics stub documents a
  marking-selection dialog consumer ("valid and sufficient for a
  classification") for whenever a marking picker gets built.
- **Documentation on projects and folders** — SHIPPED (676,
  readings/project-documentation.md): folders.documentation (the
  Add-description route), projects.cover_page +
  cover_page_discoverability (the capture's two radio labels; the set is
  deliberately UNDECLARED in the vocabulary suite — the prose page never
  prints the tokens, the reading carries the trace), and
  discoverable_cover_pages() — the security/cover-pages carve-out as a
  fail-closed SECDEF function composing resource_file_access, probed
  against a genuinely closed marked project. The queue's
  add-documentation page turned out to be a section I skipped inside
  compass/create-a-project when reading for the Compass phase. NOT built,
  with reasons: the README.md file route (no file-resource kind exists),
  the space "Project default roles" setting (absent from
  manage-orgs-and-spaces' own enumeration). Recorded: Point of contact,
  Views, Pinned strip, cross-org discoverability (Foundry: under
  development). Surface shipped (677 + web): rid_display resolves a RID to
  (kind, name) under INVOKER rights so an invisible link stays plain text;
  DocMarkdown renders the restricted markdown (text nodes only — inline
  HTML disabled by construction — rid links to icon+name); CoverPagePanel
  sits first in project details (edit, ToC card, the capture's two
  discoverability radios + None); a Discoverable strip on the Projects
  page shows carve-out cover pages with Request access; folders get
  Add-description in FilesCard. Post-build reconciliation (all five pages
  re-read whole) — remaining residuals by name: no drag-drop README (no
  file resources); DocMarkdown is a SUBSET of Standard Markdown (no
  blockquotes, hr, nested lists, no per-heading ToC anchors); the
  capture's "Last updated on" line has no backing column (the Activity
  log records the update, the panel does not show a date); Foundry's
  Add-description sits in a folder Actions MENU, ours is an inline
  button; Foundry's editor is rich-text over markdown, ours edits raw
  markdown; the create pane still lacks the space picker (pre-existing,
  re-confirmed).
- **The User wire shape** — SHIPPED (678/679, readings/users-wire-shape.md):
  `username` NOT NULL unique WITHIN the realm (stamped from the email the
  way 656 stamps realm — 678 shipped the column and every fixture broke on
  the not-null, 679 added the stamp), `given_name`, `family_name`,
  `status` (ACTIVE/DELETED, the wire's own tokens, declared), and
  `user_attributes` as the map-of-lists table with the reserved
  `multipass:` prefix enforced and `multipass:realm-name` stamped per the
  capture. `login_attribute` now reads the store first, then the wire
  fields, email arm unchanged (the conditions engine calls it at every
  login). Deletion is soft: three grant paths — project roles, group
  members, marking members — refuse a DELETED user by the published
  `UserDeleted` name, and undelete is the same UPDATE. NOT built, with
  reasons: profile pictures (binary store), revoke-all-tokens and the
  30-day inactivity clock (Supabase owns sessions), preregistration and
  provider-info external IDs (the external-provider day). Surface shipped:
  UsersSection in Platform Settings to the CAPTURE's columns (Username |
  Given name | Family name | Organization | Realm — the prose lists a
  different set and the capture is the drawn thing), the details panel in
  its captured order (initials disc + name + username, User ID,
  Organization, Groups, Attributes as name-over-values), prefix search over
  the three name fields per the search endpoint's own spec, Show deleted
  as a separate switch because that endpoint excludes them, and soft
  delete/undelete. Post-build reconciliation (all eleven api pages + the
  prose page + the capture re-read) caught one defect and recorded two
  divergences: the Realm column was drawing the provider's DISPLAY NAME
  where the capture and the wire field both mean the realm IDENTIFIER
  (`palantir-intern…`) — fixed; the display name belongs to
  `multipass:realm-name`, where it already sat. Divergences: `list-users`
  takes `include` as a single status (ACTIVE **or** DELETED) while our
  Show-deleted switch widens to both, and the `organization` field is an
  Organization RID on the wire where we render its name. Residuals: no
  Create user or Pre-register user button (provisioning is Supabase
  auth's, preregistration is the external-provider day), and attribute
  editing has no list-of-values editor beyond comma entry.
- **Inviting reviewers** — SHIPPED (680, readings/proposal-reviewers.md).
  It was never a divergence from 651: the page's own warning callout says
  the list "tracks who should review changes, not to restrict approvals",
  so advisory-list and computed-eligibility are two halves of one design.
  680 adds `can_approve_proposal_task` — whether THIS caller's approval
  would count — composing the same three predicates `task_approval_status`
  counts with, so the label can never disagree with the arithmetic; the
  probe asserts an admitted approval actually moves the counter, and that
  membership of the reviewers list confers nothing. No invite function:
  the table's own policy already says who may write it, which is the rung
  the ladder stops at. Surface: Invite reviewers popover with the list and
  removal, tasks split under the capture's heading (eligible above, the
  rest below, both still reviewable — "Users without permissions may still
  review the task"), the View policies popover in the capture's order, and
  the state label corrected from the invented "Awaiting approval" to the
  page's own "In progress". **A defect the unreached table was hiding:**
  the Assigned-to-me tab filtered on `proposal_reviews` (already
  reviewed) — it now reads the invite list. Not built, with reasons: the
  per-task before/after edit diff (`branch_resource_changes` holds
  authorship, not field-level history), per-task comments (no store), and
  the branch-taskbar and Global-Branching invite entry points (neither
  surface exists). Post-build reconciliation (both pages re-read whole)
  found TWO gaps the 680 build had missed, both stated in PROSE rather than
  only drawn, and 681 closed them: the page says the status tag sits "next
  to the resource name" while our rows drew a uuid slice
  (`ontology_resource_label` resolves all six kinds — five carry `label`,
  `type_groups` carries `name` — under invoker rights so an unreadable
  resource keeps its identifier instead of leaking a name); and reviewers
  may decide "all modified resources OR specific ontology resources", two
  grains where 680 built only the second (`review_proposal` applies one
  decision across every task as the same per-task upsert, INVOKER, so
  proposal_reviews' policy stays the only rule). A wrong first attempt is
  recorded in 681's header: 651's `review_approval_task` belongs to the
  Approvals engine's own tables, not to proposal tasks — the probe caught
  it by raising `Approvals:NoSuchTask`.
- **Action reverts** — SHIPPED (682-684, readings/action-reverts.md). A
  revert is a compensating APPEND, never an undo: 422's table comment
  already said "There is no mechanism to directly undo a single user edit",
  so create is answered by delete, modify by a modify back to its
  before-image, delete by a create from it. The missing piece was
  identity — apply_action stamped action_type_id but nothing naming ONE
  submission — so `action_applications` is that row and
  `object_edits.application_id` points at it, with `before` captured at
  apply time rather than replayed. `action_types.allow_revert` defaults
  true ("New actions are revertible by default"), and turning it off
  CLEARS revertible on existing unreverted applications by trigger,
  because the page says turning it back on does not restore them — which
  is why the flag is stored per application instead of joined live.
  `revert_action` refuses four ways by name: not the applier, already
  reverted, not revertible, and any object edited since (the page's
  most-recent-edit rule, any property). Side effects are deliberately NOT
  reverted — Foundry's own divergence, stated on the page. Surface: the
  Form tab's Submission options card with the toggle, and the apply toast
  now reading "Edits successfully applied." with a **Revert** action (the
  drawn button's word; the prose says Undo). **Two corrections the local
  suite caught, both mine**: 682 gave action_applications RLS with only a
  SELECT policy while apply_action is INVOKER, so every authenticated
  apply was refused and fourteen unrelated action tests failed with the
  wrong error (683 adds the applier-writes-their-own policies — 682's
  probe ran as owner, which is exactly why it missed it); and
  reverted_by_user_id had no index (684). Not built, recorded: the
  capture's other two Submission-options rows, Customize submit button and
  Customize success message, because nothing stores a custom label or
  message and a switch over a thing that does not exist is inert. Known
  race, recorded: the toast reads the application back from the table, so
  two concurrent applies of one action by one user would name the wrong
  submission. Post-build reconciliation (the page re-read whole against the
  build) found no missed behaviour and two things to record. **The
  before-May-2024 rule has no analogue here**: Foundry leaves the toggle
  OFF by default for actions that predate the cutoff, while our ADD COLUMN
  DEFAULT true turned it on for every existing action type — immaterial
  rather than wrong, because every edit written before 682 carries a NULL
  application_id and so cannot be reverted at all; the flag only reaches
  future submissions, and ours are all OSv2, which is the cutoff's actual
  reason. **The lost-toast remediation is not built**: when the toast is
  gone the page offers migrating to a new object type and copying edits
  with functions, or dropping all edits on the object type — we have
  neither operation, and inventing a drop-all-edits button is not
  something the page specifies.
- **Corpus fact**: the mirror holds 2,597 DISTINCT page bodies, not 4,123 —
  every api page exists under three paths; `data-health`/`health-checks` and
  `projects`/`compass` are section-level duplicates.

**Realms residuals.** The identity-provider engine shipped in 654/655
(reading `authentication-and-realms.md`): providers as config-as-data with
GoTrue seeded as the internal realm, `groups.realm`, rule_based groups with
their login-time producer synced in `custom_access_token_hook`, ordered
first-match organization assignment with the blocked-login refusal, and the
Test-rules contract as a function. What stays out, with reasons in the
reading: external providers (SAML/OIDC arrive with machinery — the fourteen
how-to pages are their corpus), provider groups as a condition target,
org-assignment GROUP rules, the user-directory/passkeys surface (GoTrue''s
own), (the rules editor shipped as Control Panel > Authentication, 657 +
/control-panel). The api audit pass (656)
added three more records: the user/group attributes map (name to list,
multipass:-reserved, provider-populated at login), the Group wire shape's
multi-organization visibility list, and the User status enum.

**Approvals residuals.** Engine (651), inbox surface (652 + /approvals) and
the first filer (653 + Request access on Projects, reading
`request-access-to-a-project.md`) shipped; the readings record what stays
out and why: checkpoints (and with them the action_required state),
notifications, the add-reference kind, file upload on comments, Control
Panel's ingress/egress/web-hosting workflows, on-behalf-of requests (engine
takes them; the dialog says Myself), and Discoverer-based narrowing of the
project listing (the listing is the documented discovery surface).

**~~`authorized_group_ids` compiles fail-closed~~ — it did not, in one shape
(FIXED 568).** Foundry declines to define the attribute ("Contact your Palantir
administrator"), so 484/490 bound it to an empty array. That is closed for
`intersects` and `superset_of` and **open for `subset_of`**, since the empty set
is a subset of everything — `authorized_group_ids subset_of <column>` was true
for every row. It now compiles to `false`, because any placeholder leaves the
outcome to the operator. `policyFailClosed.test.ts` guards the class.

Worth keeping: `granular_comparison_check` already refused `NOT` for exactly
this hazard, quoting Foundry's warning and calling itself "stricter than the
warning, and deliberately so". The same failure walked in through an operator
the warning does not name.

### Action rules on interfaces — BUILT (569–570), and 569 was wrong

`action-types/rules` lists twelve rule kinds; we carried seven. **569** adds
`action_type_rules.interface_id` and registers the remaining five. None
executes: the three object kinds need the parameter Foundry generates for them
("an 'Object type' parameter will be automatically generated", "an 'interface
reference' parameter will be generated, constrained to the selected
interface"), and the two link kinds wait for the link instance store that
`create_link` and `delete_link` already wait for. Each says so in its own note
rather than sharing a vague one — registered, expressible, refused at execution
with a stated reason, which is how `create_or_modify_object` has been carried
since it was registered.

**570 corrects 569, and the way it was wrong is the point.** The governing
sentence is one clause:

> you can use interface action rules only to modify the *interface shared
> properties*  — `action-types/actions-on-interfaces`

569 enforced it by joining `action_type_rule_properties.property_id` against
`interface_properties.property_id`. Those columns are different types — a uuid
referencing `object_type_properties(id)` against the property's text api id —
so the guard raised `function string_agg(uuid, unknown) does not exist` the
moment any interface rule carried a property. **569's own assertions checked
the registry and never inserted a rule property**, so the path they were meant
to prove was never executed. That is exactly the failure
`a lesson written is not followed` records, made again while the lesson was two
migrations old. The rule holds without amendment: **an assertion has to execute
the path, and a guard nobody has watched fail is not a guard.**

The type error was pointing at a real design fault, not a missing cast. The
column can only reference an *object type's* property, and an interface rule
does not write those — a rule naming `Aircraft.status` is a rule about Aircraft
however it is labelled. So 570 gives the table a second reference,
`interface_property_id`, with `num_nonnulls(...) = 1`: a rule property names
either an object type's property or an interface's, never both.

**And a third guard nobody had looked at.** `guard_action_rule_property` read
the rule's `object_type_id` and refused the row outright when it was null —
"% does not write object properties" — which was right while every rule
carrying properties targeted an object type, and made all five interface kinds
unusable. It is also where the check belongs, because it fires on the property
INSERT rather than needing the rule row touched afterwards. The rule row still
re-checks, because repointing a rule at another interface strands the
properties the old one declared. `interfaceActionRules.test.ts` covers both
directions.

**571 is the consequence nobody would have looked for.** `action_editable_properties`
answers Phase C's design sentence — *"this is the only property that users can
edit"* — with an inner join through `property_id`. After 570 an interface rule's
property lives in the other column, so **every interface action reported zero
writable properties**. Not an error; a zero, from the function whose whole job is
that answer. 571 adds the interface arm: the interface property resolved through
`interface_implementation_mappings` to the concrete property each implementer
mapped it onto, one row per type — Foundry's own example being `Title` on Bug
and `Summary` on Feature request for one interface `Subject`.

It also gives `object_type_interfaces.interface_actions_enabled` **its first
reader**. 450 added that column citing this same page and nothing ever read it —
declared, defaulted, inert, which is the half-built shape seen from the other
side. A type that turned interface actions off is not edited by the action, so
its properties leave the answer.

**The reading came after the build, and is recorded that way.**
`readings/actions-on-interfaces.md` was written once 569 was already applied.
It found two things review had not: the governing quote both migrations carry
is **cut short** — it ends "or to delete objects" — and the Interface action
control gate this page describes was **already built in 450**, while
`readings/interfaces-phase.md` was simultaneously recording the page as
unmirrored and the question as open. The schema knew and the reading did not.

### Portfolios — BUILT (554–556), after its prerequisite

`readings/portfolios-and-space-roles.md` was recited, approved, and built:
**554** space roles, **555** portfolios, **556** the catalog hygiene the first
two owed. What follows is why the order was forced, kept because the finding
outlives the build.

**The finding that matters: portfolios cannot be built first.** Every portfolio
operation is gated on a space role, and *we have no space roles at all* — space
access today is organization membership and nothing else. I first concluded the
space-role vocabulary was undocumented; **that was wrong**, and checking rather
than trusting it is the only reason the reading is right.
`platform-security-management/manage-orgs-and-spaces` publishes it, and
`space-permissions.png` publishes the contents of the default roles.

Two corrections that would have become structure:

- **There is no "Editor" role on a space.** The defaults are Contributor,
  Project Templates Administrator and Space Administrator. `security/portfolios`
  says "the Editor role on a Space" as prose shorthand for whoever holds the
  portfolio workflows — by default Contributor. The two-vocabularies trap.
- **The permission is a workflow, not a role**, and both are named in the
  screenshot: `Curate portfolios within the space` and `Manage portfolios within
  the space`. A space role **bundles workflows** — the identical mechanism 540-542
  built for organizations in 540–542, one scope up, so the precedent to copy
  already exists.

Order therefore: **space roles, then portfolios** — which is what shipped.
`projects-roles-and-portfolios.md` (13 citations) is still allocated and
unswept; it covers project roles and access requirements, not the portfolio
half this build needed.

**Two things this build turned up that are not portfolio questions:**

- **Project contents — FIXED (561), and one gap that was not one.**
  `project_resources` read org-wide while its write policy already required
  `editor`, so after 558 a caller with no role could not see a project and
  could still enumerate its contents. Closed on inheritance ("role grants
  inherit to child resources").

  **Role delegation was already built** — `Projects:GrantExceedsRole` refuses a
  discoverer both `owner` and `editor`. It was listed as a gap and was not one;
  **the tenth time an audit has found the thing already built.** Now asserted.

  The sweep behind 561 listed all 36 permissive read policies gated on
  organization alone; the rest are org registries or specified as
  organization-visible (portfolios, collections).

- **Schedules — FIXED (562). Builds — still open, and now for a stated reason.**
  The pipeline question split in two once the pages were read.
  `building-pipelines/schedule-troubleshooting` publishes the schedule rule
  exactly: view needs `Viewer` on the target dataset, edit/delete/pause needs
  `Editor` on the target dataset **and** on the scoped project — and, since
  "If you lost permissions for one dataset, remove this dataset from the
  schedule before you save", editing needs **every** target. 562 implements
  both through `dataset_role()`; read is `ANY` target and that is marked
  inference, since our `target_dataset_ids` is an array where Foundry's rule is
  singular.

  **Builds get nothing**, because no page read says who may view one. The
  Builds application is described as showing "all builds occurring across
  Foundry", which is a product description rather than a permission, and
  `building-pipelines/security-overview` is a page of links about Markings.
  `builds`, `build_jobs` and `schedule_runs` stay organization-scoped until a
  page says otherwise.

  **The scoped project — ANSWERED and BUILT (567).** `api/` carries `scopeMode`
  as a union: project scope names `projectRids`, a **list**, and is "the
  boundaries for the schedule build" rather than an attribution. `scope` had
  been read by *nothing* — no function, no policy — so it recorded an intention
  and enforced nothing. It now names its projects, the union is a CHECK both
  ways, and a trigger refuses a target outside the boundary. The *discovery*
  half is deliberately not built: Foundry's user-scoped schedule discovers
  outputs from what the owner can build, and ours never discovers anything.

  **Builds — still unpublished, now confirmed from the API too.** `get-build`
  gives only the OAuth scope `api:orchestration-read`; `create-build` names only
  `CreateBuildPermissionDenied` without saying what permission was missing.
  Checked from both sides now, not one.

  **The folder-and-file role-grants toggle is NOT to be built**, and the
  reading says why. It disables "folder and file role grants" — and there is no
  folder or file level here: `project_role_grants` names a project and nothing
  finer, no per-resource grant table exists, and no link-sharing table exists
  either (the toggle governs that too). A folder's access is already entirely
  its project's. So the switch has one honourable position and we are in it,
  which is the position Foundry recommends: "We recommend keeping role grants
  on folders and files disabled."

  What would make it real, in order: per-resource role grants, then link
  sharing, then the toggle over both, then the space-level default, then the
  documented cascade that deletes existing resource grants when it is turned
  off. That cascade is why it is not merely a boolean and cannot precede the
  thing it deletes.

- **Project reads are organization-scoped, not grant-scoped — FIXED (557–560).**
  `readings/access-model-and-permission-vocabulary.md` has the full account.
  The conjunct landed on `projects` and `datasets` (`folders` already had it),
  and finding it exposed two more defects: `project_role` **restated** the
  organization test more narrowly than the predicate beside it, so a guest
  could not hold a grant made to them; and it was SECURITY INVOKER while being
  consulted *by* a policy over the very table it reads, so it answered `viewer`
  to the owner and NULL to the caller. Both fixed, with `accessModel.test.ts`
  as the standing guard.

  The open question — which `default_role` preserves behaviour — **dissolved**:
  every production pair was checked and zero lose visibility, so no backfill
  was needed. And 557 removed the fixtures 554/555 had committed to production,
  with the lesson that a migration wrapped in one transaction commits whatever
  its assertions insert. The published formula is a conjunction
  (`security/checking-permissions`): access requires "Satisfying the
  Organization and Marking requirements" **and** "Having one or more roles
  (directly, via a group, or a default role)". Mandatory controls only ever
  subtract — "Organizations and Markings, will *always* prevent an ineligible
  user from accessing a resource, regardless of the user's role" — and roles
  only ever add.

  **Both halves exist here and were never joined.** `resource_file_access` is
  the mandatory half; `project_role()` is the discretionary half and is already
  complete (direct grant, group grant, `default_role`, strongest wins). The
  projects read policy calls only the first. So the fix is one conjunct — and
  it is **not safe to ship blind**, because all six production projects carry
  `default_role IS NULL` and the conjunct would hide every one of them. The
  data decision comes first and is the operator's.
- **Question 3 stays open after eight pages.** Nothing splits
  `Curate portfolios within the space` from `Manage portfolios within the
  space`; the GA announcement uses "Editors" and "Administrators" for the same
  activity in consecutive paragraphs. Our split is marked as inference inside
  555, and only two predicates change if a page later contradicts it.

  **The search did establish a prior, and it points away from our split.**
  Foundry's sibling curation surfaces bundle create with manage:
  `app-building/curating-apps` says permissions to create collections and tags
  "are the same as the permissions to promote", and `compass/data-catalog`
  gives one permission both add/remove and "manage who has this permission".
  So a single bundle is likelier than our boundary. Recorded as analogy — the
  answer will come from an expanded Space permissions card, not from prose.

  Two decisions were corroborated on the way: **curation is not access** now
  has a third independent source ("Anyone can view collections and their
  descriptions, but you will only have access to curated files that are shared
  with you"), and **delegation is a management act** — which 555's
  `managers appoint curators` already assumed — is stated outright for
  collections.

**Open question 1 is answered (§7), and the question was the wrong shape.**
`manage-roles` — a page no reading had opened — shows that "roles on a space"
and "role sets" are two mechanisms that share a settings page:

- **Roles *on* a space** (Contributor, Space Administrator…) grant **workflows**,
  belong to the space, and are what gates portfolios. Per-space, as proposed.
- **Role sets** group the roles usable *inside* a space, on projects, folders
  and files. They grant **operations**, are owned by an **Organization**
  (defaults by the enrollment), come in three contexts — Project, Ontology,
  Marketplace Installation, and **no Space context** — and a space points at one
  per context: "Projects in this space must use this role set."

So portfolios are unblocked by the first and unaffected by the second.

**And it names what we already have.** `project_role_grants`' owner / editor /
viewer / discoverer **is the "Project defaults" role set, hardcoded**, and
`ontology_role_grants` is "Ontology defaults". That is a supported place to
stand — default role sets "are always available to all Organizations" — so what
is missing is customisation (custom role sets, editing a default role inside
one, role inclusion, and the replace-with-mapping that rewrites every grant in
the space). **Recorded, not queued**: nothing is blocked on it.

A third granularity also arrives with it: **operations** (`stemma:mutate-default-branch`)
are what roles in a role set are built from, below the workflow level Control
Panel uses for organization and space roles.

**Open question 2 is answered too, by `api/` — and the answer is that the docs
are the wrong source.** The Role object
(`api/v2/admin-v2-resources/organizations-list-available-roles-organization`)
carries `roleSetId` as **required**, an `isDefault` flag whose description is
harder than the prose ("Default roles are provided by Palantir and cannot be
edited or modified by administrators"), a `type` naming the resource the role is
valid for — **`ORGANIZATION` is one of its values, so organization roles live in
this same model** — and an `operations` list. The role contents that every
screenshot collapses are a **`listAvailableRoles` response**, served rather than
published. The cross-organization phase's "not published" conclusion was right
for the right reason.

**Workflow versus operation — settled enough to act on, in the same reading.**
They are one concept at two scopes, on strong evidence and no outright
sentence: the definitions match, both are what you pick when building a custom
role, and decisively the API's Role object carries `type: ORGANIZATION` with a
list called `operations` while Control Panel shows those same organization
roles granting *workflows*. One object, one scope, two words.

**So the tables are right and stay.** `organization_role_workflows` and
`space_role_workflows` store slugs of display names, which is the audience we
build for — Control Panel, where a person picks a workflow by name. **No
identifier can be populated today**: the corpus publishes exactly one,
`stemma:mutate-default-branch`, and it belongs to no workflow we store. A row
gains an `operation` column when a page publishes its identifier, one card at a
time the way 542 grew the catalogue.

**Type classes and render hints — resolved 2026-08-18, and the entry was three
different things.**

*Capabilities* was an engine with no caller: 415 built the table, the
`capability_slots()` registry, the guard and the policies, and production held
zero rows with nothing reading or writing them. The **Capabilities tab** is now
built, shaped as the screenshot has it, with the picker reading its `accepts`
list from the same registry the guard enforces. `capabilities.test.ts` fires
all three refusals, which had never run.

*Render hints* were already real and already consumed — `searchable`,
`sortable`, `selectable`, `analyzer` on `object_type_properties`, with the
published dependency rule enforced as `hints_need_searchable` and readers in
`object_set_where`, `evaluate_object_set`, `aggregate_object_set` and
`search_index_payload`. **Seven of the ten published hints are unbuilt**:
Disable formatting, Identifier, Keywords, Long text (pure Object View display
hints, no index cost) and Low cardinality, Enable leading wildcards, Enable
regex queries (search behaviour, each requiring Searchable). Each waits for a
surface that would read it.

*Type classes as a general mechanism* stay deliberately unbuilt. "The
configuration of all supported type classes will move to the Capabilities
page", so a generic kind/name bag would be building the thing Foundry is
retiring — and `metadata-render-hints` frames the whole feature in **Object
Storage v1 (Phonograph)** terms, the backend whose scalar we already had to
undo. Take hints one at a time, from a consumer that needs one.

**The lineage surface was already built, and this file said otherwise for
twelve days.** The entry read "`lineage_graph()` exists and nothing renders it".
All three slices the reading planned are live: L1 the engine (`lineage_graph`,
four edge sources, the staleness fact), L2 the surface
(`features/lineage/LineagePage.tsx` — the SVG layered DAG, chevron depth,
details drawer, routed at `/lineage` and `/lineage/:kind/:id`, listed in
`apps.ts`), and L3 the simulation (`simulate_marking_changes`, the four
documented states, the mode banner). `lineage.test.ts` is its standing guard.

Verified live rather than by reading the tree: the graph, the simulation and
`dataset_markings` were each called **as `authenticated`** against production
after 550–552 revoked the anon grants on exactly those functions. The reading's
13 citations are swept, and it now carries `verify: strict`.

**This is the eighth time an audit found the thing already built.** The pattern
holds: the entry described the gap at the moment it was written and nothing
deleted it when the gap closed. Deleting a shipped entry is the rule this file
opens with; it is also the rule that keeps getting missed.

**Recorded from the functions reading**: batched execution, `VALIDATE_ONLY`
mode, the `returnEdits` options, interface and struct edits, retries with
backoff, `fallbackBranches`, `connecting` build targets, Cancel build.

**A function version on a branch — ANSWERED, and the answer is "not for what we
build".** I recorded this as a question for the operator after 536. Two mirrored
pages settle it, and I should have read them before asking:

> "You can develop, publish, and consume functions on a global branch. This is
> currently supported for **TypeScript v1 functions and AIP Logic functions**."
> — `functions/branching-functions`

> "**TypeScript v2 and Python functions:** Currently, you cannot modify
> TypeScript v2 or Python functions on a branch. You may reference a specific
> version of a function on a branch and test that version before merging it
> back to the `main` branch. However, the function code will only be able to
> leverage the schemas that exist on the `main` branch."
> — `global-branching/integrations`

**We built the v2 contract** (`readings/functions.md`), so `function_versions`
must NOT gain a branch — that would be building something Foundry does not have
for our flavour. And the read-side sentence is already satisfied: nothing in the
function execution path consults the branch overlay, so a function's ontology
reads see `main`, which is what the page requires. Verified, not assumed.

The screenshots also correct an assumption worth recording: a branched version
is a **normal version number carrying a `Branched pre-release` label**
(`4.0.1 Branched pre-release` next to a plain `4.0.0`, and "Releasing: 6.0.0
(unstable)"), **not** a semver prerelease tag. If branching ever reaches our
functions, the marker is a flag beside the version, not `-rc1` inside it.

**Nesting a version resolver inside a query over its own table loses
uncommitted rows.** Observed reproducibly in 536: `WHERE id =
function_resolve_version(...)` over `function_versions` misses rows written
earlier in the same transaction, while the identical predicate inline finds
them, and the function receives the right arguments throughout. Minimal
reproductions in both `sql` and `plpgsql` did **not** reproduce it, so the
mechanism is not yet pinned. Committed rows are unaffected. Both call sites now
resolve into a variable first, which sidesteps it — but the cause is unexplained
and could bite another pair of functions.

**`ObjectMap` is parked.** `features/objects/ObjectMap.tsx` + `basemap.ts` are
`@surface-orphan-ok`: a maplibre map that plots any object with a geopoint
property, kept deliberately ahead of its caller.

**Property base type SHAPES — the entry that stood here was wrong twice.** It
said Geoshape, Attachment and Time series were "beyond the 22" and each waited
"for something that stores one". Checked: `property_base_types()` returns 22 and
all three are IN it, and `property_column_type()` returns a SQL type for every
one, so nothing was waiting. What they lacked was a shape — of the eleven
jsonb-backed types only `media_reference` had a validator (582).

**Geopoint and Geoshape are done (632)**, and doing them found a storage bug:
`geospatial/ontology` says a geopoint's contents are "a string of either
latitude,longitude ... or a Geohash" and a geoshape is "a GeoJSON Geometry
string". Ours mapped both to `jsonb`. Corrected to `text`, free because zero
properties used either and `property_column_type` has exactly one reader.

The validators sit on the first rung of the ladder — a CHECK the indexer emits
onto the generated column — and the must/should split is honoured: the three
collections are refused, and a `Point` geoshape is legal-but-discouraged because
the page says *should* not, against a list that says Point *must* be allowed.
**Winding order and self-intersection are NOT checked**: they are real geometry,
PostGIS would answer them, and adopting it is a substrate decision. Recorded as
being LESS strict rather than half-implemented.

**Struct is done too (633)**, and it was the largest of them: `struct` was a
base type with a jsonb column of any shape and no way to say what fields it has,
against six mirrored pages. The shape question was the whole job — the obvious
build is a `struct_types` registry properties point at, and that is wrong.
`create-struct-type` never leaves the Property editor, so the fields belong to
the PROPERTY. Twelve field types, enumerated, and nesting falls out of the
enumeration rather than needing a rule of its own. "Structs must have at least
1 field" is an `ontology_violations()` arm rather than a refusal, on the
media-source precedent: the base type is picked at step 3 and the first field
added at step 5.

Not built and named: struct field RIDs (properties have no `rid` column at all,
so fields would be ahead of their parent), shared-property field inheritance,
main fields (Beta), automapping.

**Still shapeless**, and each for its own reason: `attachment` (`base-types`
gives it one sentence and names no structure), `time_series` and
`geotemporal_series` (42 and 6 unread pages behind them), `vector`, `array`,
`marking`, `cipher`.

**Time series had a table and it was a mirage (628/629).**
`time_series_properties` came from 276, before the teardown. 379 kept it by
declaring it in `shape_registry` — and `shape_registry` was later deleted along
with the guards that read it, on the reasoning that wanting an allowlist is the
signal to index instead. The allowlist went; the thing it excused stayed, and
nothing was left that could notice. Zero rows, no foreign key, no function, no
view, no surface, and `Time series` is not one of the twenty-two base types, so
no property could have been one. It also registered a raw `source_table` plus
column names, which is the generic-table shape deleted three times before.

**What building it actually means:** `time-series/` is **42 mirrored pages**,
none read — syncs, derived series, function-backed series, geospatial series,
alerting. `base-types` gives the property one line and links straight out to it.

**`proposal_reviewers` came up in the same sweep and was NOT dropped.** It has
no SQL reader, but its siblings `proposal_reviews` and `proposal_tasks` have two
and four, and it was built after the teardown (420). An unreached member of a
live feature is a question; a survivor of the deleted product with nothing that
could ever reach it is an answer. Open: does anything intend to write it?

**The media half is BUILT (582)**, and it carried the reading's nine
untraceable quotations with it as allocated — the last of the seven, closing the
citation backlog.

A media reference is three RIDs, not one: `base-types` prints the shape and names
"a reference containing the media set RID, view RID, and specific media item
RID". `media_reference_valid()` checks all three, and `rid_valid()` arrived with
it — 391 and 396 minted RIDs, 412 pulled a locator out of one, and nothing had
ever asked whether a string IS one.

**The media source is not a capability, despite living on the Capabilities tab.**
`object_type_capabilities` (415) nominates a PROPERTY FOR A SLOT
(`geospatial.altitude`); the media panel attaches a DATASET AND BRANCH TO A
PROPERTY. Opposite direction, so `object_type_media_sources` is its own table.
"It is on the Capabilities tab" is exactly the reasoning that would have put it
in the wrong one.

The page's MUST — "a media reference property must have a media source" — is a
`ontology_violations()` row rather than a refusal, because the panel shows the
property carrying an `Add media source` button and therefore existing before its
source does. Same incremental-authoring argument as the derived-property chain.

**Attachment stays unbuilt**, and there is nothing to build: `base-types` gives
it one sentence — "A type for storing files on objects for use with functions on
objects" — and names no structure at all.

**Then the same corpus falsified its SHAPE (585).**
`object-types-get-object-type` defines `datasources` as a union of Foundry
resource kinds, and one of them is `mediaSetView` — "An object type datasource
backed by a Foundry media set view, providing media for media reference
properties", carrying a **media set RID and a view RID** and binding a **list**
of properties.

So 582 was wrong three ways: a media source is a datasource on the OBJECT TYPE,
not a row per property; it names a media set and a view of it, not a dataset and
a branch; and the kind belongs in the datasource union rather than in a table
only media knows about. I had read the screenshot's `images · master` as a
dataset and a branch **because that is what we already had** — the same
inference-by-familiarity that got the vector property wrong an hour earlier.

582's own validator already required the view RID, so the schema had been
disagreeing with the validator shipped beside it.

Two things 582 got right and 585 keeps: a media reference property needs BOTH
backings — the dataset whose media reference column it reads and the media
source its references point into — and the MUST is a linter row rather than a
refusal.

**And the guard predated the third kind.** `guard_object_type_datasource`
derives an organization from the datasource's dataset and refuses one the
ontology's space does not serve; a media set view has no local dataset, so every
media datasource was refused as foreign. The org rule is about a DATASET being
reachable from this space, so it is skipped rather than passed vacuously — and
so is the MAP-column check that reads a dataset schema.

**The value-shape check corroborated rather than falsified**, which is worth
recording because that corpus has falsified our CHECK constraints twice.
`api/v1/ontology-resources-objects-get-object` returns a media reference with all
three RIDs and real tokens — `ri.mio.main.media-set.…`, `ri.mio.main.view.…`,
`ri.mio.main.media-item.…` — so `media_reference_valid()` requiring the view RID
is right, and the prose page's three-part description is not a simplification.
Checked because the rule says to, not because anything looked wrong.

**Function signature types beyond the nine.** `functions/types-reference`
publishes, with a TypeScript v2 tab for each: Short, Decimal, Binary, Byte,
mandatory and classification markings, Map, Set, Optional, Struct/custom types,
Range and the two aggregation shapes, Object, Interface, Interface object set,
Attachment, Notification, Media, User, Group, Principal, and the geometry types.
We accept nine tokens plus arrays and `ObjectSet<T>` (539). **Each of these
needs the isolate to marshal it, and a token the runtime cannot carry is worse
than a missing one** — the signature would pass and the call would fail. So the
list grows one type at a time, when something needs to pass one.

### What is NOT on disk, measured (2026-08-22)

Drift asks whether what we have has moved. The other question — is there
something we do not have — had never been answered past the headline "16% is not
on disk". Measured by matching all 4,818 known URLs against the mirror, allowing
for the dashed form the mirror flattens nested paths into:

**61 sections are wholly absent, 1,206 pages between them. NOT ONE SECTION IS
PARTIALLY MIRRORED.**

That second sentence is the useful one. "Is this page on disk?" reduces to "is
this section on disk?", which `MAP.md` already answers — so a `grep` of MAP that
finds the section is sufficient, and one that does not means the whole section
is missing rather than that particular page.

**Most of the 1,206 are products this repository does not build** — Notepad
(50), Code Workbook (43), Contour (33), Vertex (28), Carbon (25), Reports (22),
Forms (19), plus `available-connectors` (216) and `pb-functions-transform` (96).
No action.

**Five named things we HAVE built, and their sections were absent.** Mirrored,
55 pages, 3 failures that are index entries with no page behind them:

| section | why it mattered |
|---|---|
| `cipher` (10) | `Cipher` is one of our twenty-two base types |
| `projects` (10) | distinct from `compass/`, which we had; we build projects |
| `geospatial` (18) | the Geoshape gap could not even be read about |
| `data-health` (12) | Health issues, which `ontology_violations()` answers to |
| `health-checks` (8) | same family |

**And `cipher/` immediately produced a FOURTH source against the base type's
spelling**: "go to the `Property Type` field and select `Cipher text` from the
dropdown" — a UI string in Ontology Manager, which is the product we are
building, so it is the most tempting source yet.

**The rule held and nothing changed.** `properties-overview`'s table still
enumerates `Cipher`, our base type is still `cipher`, and `vocabulary.test.ts`
still parses that table and passes. Four sources now describe the member as
"Cipher text" and one enumerates the set as `Cipher`; the page that LISTS beats
the page that DESCRIBES, however many of the latter accumulate. 599 and 600 cost
two migrations and a merged PR to learn that, and this is the first time the
rule has been tested since — recorded so the fourth source does not reopen it.

### The drift sweep (2026-08-22) — 58 pages moved, and one rule was RELAXED

`check:doc-drift` reported **58 pages changed upstream**. `object-link-types`
re-mirrored first, because two of its pages carry more weight than the rest:
`create-object-type` is cited by five readings, and `properties-overview` is the
page `vocabulary.test.ts` PARSES for the twenty-two base types — if that table
had moved, our vocabulary would be stale and **nothing would have noticed**,
because the test parses the mirror rather than upstream.

**It had not moved.** Of 47 pages re-fetched, 14 changed content at all and
almost all of it was copy-editing: contractions expanded, smart quotes fixed,
and one genuinely incoherent example repaired (`properties-overview` had an
`Employee` dataset with columns for `departure date`, `arrival date` and
`passenger count`, obviously stranded from a flight example; it is now
`employee number`, `start date`, `role`).

**One substantive change: Palantir DELETED the `decimal` restrictions** from
`property-metadata` — that decimal properties "cannot be used within action
types as the precision cannot be guaranteed", and that the type "is also not
supported in Object Storage v2". Both sentences are gone.

We never encoded either, checked rather than assumed: `pg_proc` has nine
functions mentioning decimal and all nine are "decimal is a base type / a column
type / an aggregatable type" — none refuses it anywhere. So the relaxation
creates no divergence, and this entry exists so a future reader does not
re-introduce the restriction from a stale memory of the page.

Two citations broke and were repaired to the current wording: a typo upstream
FIXED that a reading had quoted verbatim ("the type of column X may been
changed"), and a `won't` that became `will not`.

**The rest was swept the same day.** 22 further sections re-mirrored, 861 pages
written, 28 failed — and all 28 are pages we never had on disk, not damage.
Nothing was deleted; the failures are part of the 16% the mirror has never
covered.

**Thirteen more citations broke and were repaired.** Almost all of it was the
same copy-editing pass: contractions expanded, smart apostrophes normalised. Two
were upstream FIXING a typo a reading had quoted verbatim — "a property the
contains one of these identifiers" and "each others saved changes" — which is
the drift guard working in the pleasant direction. One was a genuine rewrite,
`manage-roles`' "we've included the Viewer role" becoming "the Viewer role is
included".

**One correction lands on a page we built from, and we were already right.**
`building-pipelines/triggers-reference` — the page 613 cites — changed its OR
operator from "Satisfied when either `E1` and `E2` have occurred" to "Satisfied
when either `E1` or `E2` has occurred". Our `schedule_satisfied` returns true on
the first satisfied child and false otherwise, which is disjunction; we read
through the confusing wording in 493-496 and the page now agrees. Its cron
example also had 9:55**pm** corrected to 9:55**am**, which our parser never read.

**New capability, not a falsification:** `functions/media` grew by ~160 lines —
`uploadMedia`, media metadata unions, an `itemMetadata.type` discriminant across
TypeScript and Python. Functions-on-media is not built here (F1 is a QuickJS
isolate with declared imports), so this is a section that moved ahead of us
rather than under us.

**A caveat on the sweep's own method.** Re-mirroring an entire section to find
its changed pages rewrites the `mirrored <date>` line in every file, so 890
files show as modified and 14 of 47 actually changed. `git diff --numstat` with
a threshold of one line each way separates them; a plain file count does not.

### The drift sweep (2026-08-18/19) — the corpus moved under fourteen readings

`check:doc-drift` had been failing with **36 pages changed upstream across 14
readings**. Swept: every affected section re-mirrored, every stale citation
replaced with current wording, and the material findings written into the
readings that own them.

**The two guards are one mechanism, and this is the first time it ran end to
end.** Drift says *a page moved*; re-mirroring it makes `check:readings` fail on
*the exact sentence we were standing on*. Six citations surfaced that way. A
reading is not re-verified by re-reading it — it is re-verified by refreshing the
mirror underneath it and seeing what breaks.

**Nothing shipped was falsified, and the near-miss is the lesson.** `retries`
now says function effects "may receive immediate, short-term retries", which
reads like `automation_effects_retries_where_allowed` (restricting configured
retries to action and logic) is wrong. It is not — the sentence that constraint
was built on is still on the page verbatim, and the sweep added a *second*
mechanism, which `effects` now names separately as per-effect automatic retries
versus event retries. **When a drifted page seems to contradict a constraint,
re-read the page, not the diff.** A diff shows what moved and never what still
holds.

**Two real divergences, both since BUILT (572, 573) after the operator asked
for them to be verified against the pages and images first:**

* **We always allowed overlapping schedule runs.** `create-schedule` documents
  a default — a schedule does not start a new run while another is in progress —
  and `schedule_candidates()` filtered on `NOT s.paused` and nothing else, with
  the pg_cron heartbeat firing every minute. Not a regression (the sentence is
  new), but a *silent* divergence: nothing failed, runs piled up. **572** adds
  `allow_overlapping_runs`, default false.
* **A time condition takes one cron, and Foundry now takes several.** **573**
  makes it either one `cron` or a non-empty `crons` array, never both, sharing
  one `timezone`, firing when any matches.

**Verifying before building changed both of them.**

For the schedule, the images settled the default twice over —
`advanced-settings.png` shows all six Advanced-options checkboxes unchecked —
and reading the *code* found the trap: `record_schedule_run` clears
`trigger_state`, because a run consumes what it observed. A suppressed attempt
never ran, so routing the skip through it would have eaten the observed events
silently. That is a worse bug than the one being fixed, and nothing but reading
the helper would have shown it. Hence `record_schedule_skip`. No new outcome
token was needed either: `Ignored` is already defined as "The run was attempted,
but a build was not created".

For the cron list, verification caught a **scoping** error that was one step
from shipping. `condition-time` is *Automate's* condition;
`building-pipelines/triggers-reference` still says a time trigger is "defined
using a cron expression and a time zone" — singular. Two grammars that look
alike, one page moved, and a test now asserts a `crons` array is still refused
on `schedules.trigger`.

It also produced a better reason for the decision already taken. Non-overlap is
not enforced not merely because Foundry frames it as advice, but because **we
fire once per tick on any match** — an overlap is a non-event in this engine,
and a CHECK would refuse configurations that behave correctly. And the timezone
stays on the condition, because the only cron screenshot predates multiple
expressions and no image shows the multi-cron control at all; a zone per
expression would be invented structure.

**Three additive gaps recorded, deliberately not built:** download is a separate
permission from view, and *which resource* it is checked on depends on where the
object type lives; a manual automation run reads its input object set as the
person who started it, not the owner — the first documented exception to
executing as the owner; and Automate discards edits returned by function
effects, so the supported route is a function-backed action.

**The sweep repaired something nobody was looking for.** 108 mirrored files
carried `<img src="./media/…">` references, and **no `media/` directory exists
anywhere in the corpus** — every one of them pointed at nothing. `map` and
`data-connection` had zero images on disk at all. For a protocol whose second
step is "read every paragraph, and every image", that was a silent hole, and
re-mirroring closes it — 108 files down to **one**.

That last one is its own small finding. `superrepo` still carries a dangling
reference because the section has no URLs in `all-foundry-urls.txt`, so
`--refresh superrepo` printed a line and did nothing. **A refresh that skips a
section reports the same as a refresh that succeeds**, and the sitemap this
index derives from caps at 5,000 entries — which is how a mirrored section ends
up unreachable by the tool that maintains it.

**And a correction I made and had to unmake.** Mid-sweep I concluded the drift
checker had a false positive — that it compared our rewritten image paths
against upstream's originals, so any page with an image would drift forever. It
does not. `check-doc-drift`'s `normalise` strips HTML tags outright and reduces
`![alt](path)` to its alt text, so both halves of our rewrite vanish before the
comparison; verified by running the real function over both forms. What actually
had the weak normalisation was **the throwaway probe script I wrote to classify
the 36**, and I attributed its blind spot to the checker. All 36 were real prose
changes, as first reported. The lesson is small and exact: **when a tool and a
scratch script disagree, the scratch script is the suspect** — and running the
real function takes a minute.

### Value type constraints know their base type — BUILT (575)

The 2026-08-19 gap run found `value_type_constraints.kind` unpaired with
`value_types.base_type`: a `regex` constraint on an `integer` was accepted and
then silently ignored by `value_conforms()`, which is an interpreter rather than
a validator. No error at write, none at read.

**Foundry makes the mismatch unrepresentable rather than rejecting it.**
`create-value-type` picks the base type at step 5 and the constraint at step 6
"depending on the base type", and `value-type-create-constraint.png` shows the
picker for a String offering exactly RID, UUID, Length, Regex, Enum — the
Array and Struct kinds are not drawn. There is no rejection message in the
section because there is no way to author the mismatch.

So the trigger is **not us being stricter than Foundry** — it is the same
guarantee at the layer where our authoring happens, since
`mint_value_type_version()` takes caller JSON and the generated client is not
the only writer.

**It is the opposite case to that reading's Decision 6, and checking beat
reasoning by analogy.** Decision 6 governs a property *binding to* a value type,
where the docs show Foundry lets you save a binding the data violates — a CHECK
there would be stricter than Foundry. This governs a value type's own internal
coherence, where Foundry is not permissive at all. Applying one decision to both
would have enforced the case Foundry allows and permitted the case Foundry
forbids.

Two things made it a trigger rather than a lint: constraints are **immutable**
once their version exists ("The base type metadata and the constraints that
define the validation rules for the type are immutable"), so a lint reporting
"version 3 is malformed" leaves nothing to do about version 3; and the pairing
spans two tables, so the rule-placement ladder's first rung is unavailable.

The guard on the child is only sufficient because the parent cannot move: 452
already refuses a `base_type` change after save, built before anything depended
on it, and both the migration and the test assert that rather than assume it.
**The audit found zero constraints in production**, so the guard arrives ahead
of any backlog.

### Every vocabulary this session built, checked against `api/` (2026-08-19)

Mirroring `api/` turned it from the biggest hole into the largest unread corpus,
and the first thing done with it was to test every CHECK vocabulary this session
shipped. **Two were falsified, two corroborated, and two have no API surface at
all.**

| vocabulary | verdict |
|---|---|
| vector similarity functions | **FALSIFIED** — three, not four (583) |
| media source shape | **FALSIFIED** — a datasource of a media set view (585) |
| derived aggregations | corroborated; the api's extra four are query-time |
| action rule kinds | the api exposes 8 of our 12 — a scope split, not an error |
| cleanup flags | no API surface: an Ontology Manager feature |
| dependent kinds | no API surface: an Ontology Manager feature |

**Both falsifications had the same cause**, which is the lesson worth carrying:
each mapped a Foundry concept onto the nearest thing already in our schema — a
Pipeline Builder expression's enum for the vector metric, a dataset and a branch
for the media source — rather than asking what resource kind Foundry names.
Screenshots invite that; the API resists it, because it prints the kind.

**The two "no API surface" rows are a finding, not a gap.** Cleanup and
Dependents exist only in Ontology Manager, so nothing can falsify their
vocabularies and nothing will. That is worth knowing before someone goes looking.

**And the action-rule row is the one most likely to be mistaken for a defect.**
The api's `LogicRule` union carries **nine** kinds — corrected from eight by
`readings/api-action-type.md`, which counted them: the ninth is `applyScenario`,
and it maps onto nothing of ours because we have no scenario at all, while the
mirror carries five pages describing one. `action-types/rules` enumerates
twelve. That is not two spellings of one idea — the case CLAUDE.md's table
covers — but **what the Ontology Manager can configure versus what a program can
send.** We build Ontology Manager, so twelve is right. It is also independent
evidence for 569's decision to register the two interface link rules without
executing them: the public API does not expose them at all.

**16% of the documentation is not mirrored**, and `api/` is no longer the hole —
it was fetched whole on 2026-08-19 (1,243 pages, 6 unavailable). The count that
sentence used to carry has moved from four falsifications to four: it falsified
our CHECK constraints twice before this session and twice within an hour of
landing. Refresh the index with `--urls` before concluding a page does not exist.

**The rule about `api/` has changed shape and the new one is harder.** It is no
longer "not on disk"; it is **on disk and under-read**. This line used to say
"no reading has been written from it", and that was already false when written:
`readings/api-authentication.md` read `api/v1/general-overview-authentication` on
2026-08-18. Five readings now rest on the corpus and it is still 1,238 pages
unread, which is the real shape of the problem — a claim of zero was both wrong
and less alarming than the truth. "The page does not exist locally" is a failure you notice; "the
page exists and nobody looked" is not.
