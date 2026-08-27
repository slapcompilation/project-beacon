---
verify: strict
---

# Contour — a path is a pipeline you built by looking at it

**The section is 33 pages, 163 images. Pages read whole (18):** `overview`,
`core-concepts`, `boards-overview`, `boards-add`, `boards-join` (head + join
board), `boards-descriptions` (its headings and Summary; it is the 25-board
catalogue, §4), `datasets-save`, `analysis-create-path`, `analysis-parameterize`
(through multi-value), `expressions-overview`, `expressions-syntax` (data types
and heading structure), `dashboards-overview`, `dashboards-getting-started`,
`analysis-share-results`, `change-dataset-version`, `convert-to-pipeline-builder`
(head + considerations), `project-references`, `correctness-non-determinism`
(head). **Not read whole (17):** the remaining board detail in
`boards-descriptions`, `boards-filter`, `boards-map`, `boards-verify-results`,
`analysis-share-collaborate`, `analysis-switch-aggregated`,
`dashboards-getting-started`'s tail, `expressions-arrays`,
`expressions-relative-dates`, `expressions-use-board`,
`expressions-window-functions`, `correctness-timezones`, `compute-usage`,
`performance-optimize`, `faq`, `getting-started`, `_index`.

**Images: my 18 pages reference 93 distinct files (recounted by the adversary
pass — my first claim said 77, which was false); I opened two** —
`contour/images/overview.png` and `contour/images/boards-category-mode.png` —
because they carry the workspace anatomy and the toolbar. The rest are mostly
per-board configuration captures (46 of `boards-descriptions`'s 48 are the
`board-descriptions-*` family), parameter dialogs, join GIFs and dashboard
captures; they become due board-by-board, and I am the one who skipped them.
**The section also carries TWO UI ERAS** — `overview.png` is the dashboards
era (blue Dashboard button, Add to dashboard); `boards-insert.png` is the
older Reports era (Add to report, no Dashboard button) — so any number
measured from a capture must say which era it came from (CLAUDE.md rule 8).

**Not sunset.** No page in the section carries a Sunset marker (grepped), and
the Home capture lists Contour under Applications for Analytics with the
tagline "Visualize, filter, and transform data".

---

## 1. The shape: analysis → paths → boards, top to bottom

> "An *analysis* in Contour consists of one or more analytical *paths*."

— `contour/core-concepts.md`

> "Each Contour *path* should begin with a particular dataset you are interested in; you can then add different Contour [*boards*](#boards) to visualize, filter, or transform the data. You can also bring in additional datasets and join them to your current set."

— `contour/core-concepts.md`

> "Data flows down through the applied boards from the top of a Contour path to the bottom."

— `contour/boards-overview.md`

This is the exact opposite of Quiver, and Quiver's own docs drew the contrast
("Unlike a Contour path, a Quiver canvas is used for display and organization
only"): **a Contour path IS the dependency order.** A board has one input — the
board above it — so the graph is a list, and position in the list is the
computation.

**What the overview capture adds** (`contour/images/overview.png`): the
workspace is a tab bar with one tab per path plus `+`; the path's head is a
card naming the input dataset with its project path, branch chip (`master`), a
version timestamp, `1,461,897 rows · 18 columns`, and a `Change` button;
boards follow as full-width cards joined by downward arrows — `FILTER` boards
render structured predicates (Keep rows ▾ where ⟨column chip⟩ is between
(inclusive) …) with a Calculate summary footer, and a `TABLE` board carries a
preview counter over its rows and columns and an **Add to dashboard** button
(all read off contour/images/overview.png).
A left rail holds Parameters (chips like `$rate_code` with typed glyphs and an
Apply/Cancel pair), dashboard and settings glyphs. Top right: a blue
**Dashboard** button beside an **Editing mode** dropdown.

## 2. The load-bearing sentence: a saved path is a JOB

> "You can save the results of your path as a new, separate dataset in Foundry. The sequence of transformations you performed in the path is saved as a Foundry *job*, and is executed as part of the Foundry build system. This means that if one of the underlying datasets changes, or you change some part of the path, you can easily recompute your new dataset."

— `contour/core-concepts.md`

That is our `job_specs` (493) to the letter: declared inputs, one computation,
one output dataset, recomputable by the build engine. Where Foundry compiles a
path to Spark, we compile it to the job spec's SQL — which is the whole Spark
divergence for Contour, scoped to one function. Three rules from
`datasets-save` bound it:

> "All datasets built in Contour will always use the latest versions of the input datasets."

— `contour/datasets-save.md`

> "You must use the `Update` button to pick up logic changes."

— `contour/datasets-save.md`

> "In a project scoped analysis, all inputs and outputs must be in scope to save the results of a path as a dataset."

— `contour/datasets-save.md`

So the saved dataset follows latest inputs (a job spec over master views does
exactly this), and logic changes reach the job only through an explicit
Update — the job spec's version bump, not a live link.

## 3. Paths can chain, and the version selector is analysis-wide

> "In Contour, there are two types of datasets you can use to begin a new analysis path:"

— `contour/analysis-create-path.md`

— datasets on the platform, or "Results from a path in the current analysis".
A path starting from another path's result is the analysis-internal edge.
And the input version can be rewound:

> "Contour allows you to start an analysis with a previous version of your dataset."

— `contour/change-dataset-version.md`

> "If you are changing the dataset version on an existing analysis, Contour will simply update your entire analysis on top of the selected version."

— `contour/change-dataset-version.md`

The capture confirms where this lives: the version timestamp on the path head.
Note the asymmetry with §2: the ANALYSIS may pin an old version, but the SAVED
dataset always builds from latest.

## 4. Boards are a 25-kind catalogue with six toolbar categories

`boards-descriptions` enumerates the set, one `##` heading each: Summary,
Filter, Expression, Table, Histogram, Distribution, Time series, Edit columns,
Transform data, Chart, Grid, Heatmap, Pivot table, Column editor, Multi-column
editor, Enrich, Link, Set math, Join, Export, Reorder columns, Macro, Sort,
Calculation, Unpivot — twenty-five. The toolbar groups them:

> "Category mode is the default mode for the toolbar, where all the available boards can be easily found grouped by their functionality. You will notice that some boards appear in multiple categories, as they have multiple functionalities."

— `contour/boards-add.md`

The prose names the categories — Suggested, Filter, Visualize, Join,
Transform, Edit Columns — and `contour/images/boards-category-mode.png` draws
them in that order, each with a colour and an icon, each opening a dropdown of
boards with one-line descriptions and a preview panel (Library/Editor tabs for
Expression). Also on that page: Search mode, and an Actions mode.

Several boards double as FILTERS — a histogram bar click keeps or removes
rows — which is why "some boards appear in multiple categories". A board is
therefore (kind, configuration, and optionally an interactive selection that
filters downstream).

## 5. Parameters: three types, multi-value, `$name`

> "The supported types are **Date**, **String**, and **Number**."

— `contour/analysis-parameterize.md`

> "To enable a parameter to take multiple values simultaneously, toggle **Allow multiple values** in the parameter settings. This option is available for **String** and **Number** parameters but not for **Date** parameters."

— `contour/analysis-parameterize.md`

> "Parameters can be used in the Filter or Expression boards."

— `contour/analysis-parameterize.md`

The capture shows the `$` reference syntax and the typed chips. Contrast
Quiver, where parameters are cards; here they are analysis-level named values.

## 6. ONE dashboard per analysis — the opposite of Quiver again

> "Each Contour analysis is associated with one Contour dashboard. To add a board to the dashboard, click the **Add to dashboard** button on the top right of the board."

— `contour/dashboards-getting-started.md`

> "You can add all Visualize boards to a dashboard, excluding the Text and Map boards."

— `contour/dashboards-getting-started.md`

Quiver: "Create multiple dashboards per analysis." Contour: exactly one, built
by promoting boards from paths. A dashboard membership row per board, no
dashboard table at all — the analysis IS the dashboard's identity.

## 7. The expression language is SparkSQL-flavoured, and that is the divergence

> "Contour's expression language incorporates a number of functions from SparkSQL."

— `contour/expressions-overview.md`

`expressions-syntax` enumerates five data types (String, Integer, Double,
Boolean, Date) and a function library across 21 sub-headings;
`expressions-window-functions` adds window functions with a documented
non-determinism warning:

> "When using `ROW_NUMBER`, `FIRST`, `LAST`, `LEAD`, `LAG`, `NTILE`, `ARRAY_AGG`, or `ARRAY_AGG_DISTINCT` in a window function, be careful of nondeterminism."

— `contour/correctness-non-determinism.md`

Ours would evaluate expressions as Postgres SQL — same seam as the transform
files (692), where the compute language is the recorded substrate divergence.

## 8. Escape hatch: export to Pipeline Builder

> "Although Contour is the ideal tool for exploratory analysis and drilling down on specific issues, it is not well-suited for production pipeline maintenance."

— `contour/convert-to-pipeline-builder.md`

Foundry itself says a long-lived path should become a pipeline. Our
`transform_file` layer (692) is the receiving side of that idea; recorded, not
built.

## 9. Connects to

- **`job_specs` and `run_build` (493-496)** — §2. Save-as-dataset publishes a
  job spec whose SQL is compiled from the path's boards; Update bumps it.
- **Quiver (696-698)** — the deliberate opposite on both axes: path-as-order
  vs canvas-as-display, one dashboard vs many. Both catalogues, both typed.
- **`dataset_view` / branches / versions (391-396)** — the path head's branch
  chip and version timestamp; §3's rewind is `dataset_view_from` at an older
  transaction.
- **Project references** — "you must have `compass:import-resource-from` on
  the resource … and `compass:import-resource-to` on the destination project"
  (`contour/project-references.md`); the workflow-catalogue finding again —
  named operations our roles do not yet carry.
- **Fusion (694)** — both end the same way: a real dataset other tools consume.

## 10. Corrected BEFORE building — the adversary pass

A foundry-adversary pass ran against this reading before any migration was
written, and it falsified the four decisions that would have shaped the
schema. All 19 attributed quotes survived byte-exact; the design around them
did not.

**A board can have a SECOND input, and paths fan out.** The list model was
wrong as stated. Join, Union, Enrich, Link and Set math each name another
set, and that set can be a path:

> "You can filter a dataset prior to joining by opening it in a new Contour path, adding filter conditions, and then joining to the result of that path instead of the dataset."

— `contour/performance-optimize.md`

and the Map board takes one source PER LAYER, defaulting to the current set:

> "The **Data source** represents the dataset or Contour path that the layer will use to display data and compute aggregations. By default, the **Current set** is selected for this option which will use data from the current Contour path."

— `contour/boards-map.md`

Common-input paths make the path graph a fan-out DAG, not a chain:

> "Instead, use a **common input path** and use that path’s result as an input for other paths."

— `contour/performance-optimize.md`

So: a path remains the ordered spine of a board's PRIMARY input, and a board
may carry secondary input references (dataset or path). The list is the
order; it is not the whole graph.

**A path's head is one of FOUR kinds, and the compiler refuses two.** A
dataset, another path's result, a restricted view, or a virtual table:

> "You will not be able to save a path with a Restricted View as an input as a dataset."

— `contour/datasets-save.md`

(a callout I skipped on a page I claimed read whole), and the virtual-tables
capability table marks Contour's "Save as dataset" column "Not supported".
We have restricted views (481-486); save-as-dataset must refuse them.

**The category is not a scalar — the page's own matrix is five booleans.**
`boards-descriptions` OPENS with a 25-row capability matrix (Visualize /
Filter Rows / Aggregate / Manipulate Columns / Remove Duplicates) that I
never mentioned; Histogram alone is yes-yes-yes-yes(via Pivot)-no. The
catalogue holds the five flags; the six toolbar categories are display
grouping, capture-derived.

**The 25 headings are not the whole board set.** The Map board has its own
23KB page outside the enumeration; the Text board is named
("You can add all Visualize boards to a dashboard, excluding the Text and Map boards"
— `contour/dashboards-getting-started.md`) but has no page I can find; and
the Actions-mode toolbar capture spells `Charts` and shows an `Edit data`
entry the enumeration lacks. The enumeration still wins as the spine
(the 599/600 rule), with Map added from its own page and the divergences
recorded in the note column rather than silently.

**A dashboard is a real structure, not a membership list.** The tail of
`dashboards-getting-started` (which I had not read) gives it a name, ordered
renameable TABS, first-class text widgets, and layout rules:

> "You can organize your dashboard into tabs. Tabs can be renamed or dragged into a different order. Boards and text can be dragged from one tab to another."

— `contour/dashboards-getting-started.md`

> "Note that rows can only consist of a single item type - you cannot have a row with both boards and text boxes."

— `contour/dashboards-getting-started.md`

One-per-analysis survives, and more strongly than I knew: the filesystem
API's resource-type enum lists `CONTOUR_ANALYSIS` alone where Quiver gets
`QUIVER_ANALYSIS`, `QUIVER_ARTIFACT`, `QUIVER_DASHBOARD`, `QUIVER_FUNCTION`
(`api/v2/filesystem-v2-resources/resources-get-resource.md`). So: no
dashboard resource, but tabs and items tables and a dashboard name on the
analysis.

**A board row carries more state than kind + configuration.** A board can be
DISABLED in place (the deep-dive course: toggling Enabled leaves it visible
but unapplied), renamed, and an aggregating board can PIVOT — switching every
downstream board onto its aggregate output:

> "Some boards that allow you to calculate aggregate metrics have an option to pivot. This switches your working dataset to the aggregate data computed in that board, instead of the original dataset. Any boards that follow will use the new aggregate dataset."

— `contour/analysis-switch-aggregated.md`

That flag changes the schema of everything below it, and Histogram — in the
first build slice — carries it.

**Two compiler rules I had missed, one off an image I had opened:**

> Use parameters in filters and expressions to quickly manipulate data by typing "$". Filtering will be ignored when no value is set for a parameter.
> — contour/images/overview.png

An unset parameter DROPS its filter — it does not evaluate false. And the
parameter model has a tail I skipped: default values, suggested values
(linked to a column, capped at 1000, or a manual list), cross-filter groups,
and session-local overrides ("Overriding a parameter value will persist
until you refresh the page, and will not affect what that other users see" —
`contour/analysis-parameterize.md`). Parameters also reach text widgets and
titles, not only Filter and Expression boards.

**The analysis is stale until refreshed; only the SAVED dataset is always
latest.**

> "At this time, there is no way to automatically update a Contour analysis path; this must be completed manually."

— `contour/faq.md`

So the analysis pins what it read (the §3 version selector is that pin made
visible), refresh moves the pin to latest, and the compiled job spec ignores
the pin entirely — §2's rule survives with its other half attached.

**Better citation for §2, from a page I had not read:**

> "Contour paths can be \"saved as\" datasets. This saves the underlying code generated by the Contour backend into a dataset job specification. This dataset build can then be run on a schedule or ad hoc."

— `contour/compute-usage.md`

"Job specification", verbatim — the `job_specs` mapping is Foundry's own
word, and schedulability comes with it.

**Also recorded from the pass:** the deep-dive course (30 extracted lessons I
never consulted) conflicts with the mirror on sizing — the course says five
paths of at most 20 boards, `performance-optimize` says 15-20 paths per
analysis; `expressions-window-functions` and `correctness-non-determinism`
disagree on the non-deterministic function list (5 names vs 7); selections
are TYPED per board kind (bar-or-range, interval, date range, multi-select,
cell set, drawn circle — each with Keep/Remove); boards can be INSERTED
mid-path and copied-above into a new path; and
`questions-answers/contour-community.md` names two export operations
(`export-dashboard-data`, `export-data`) for the workflow catalogue.

## Decisions

1. **Build the path engine**: analyses → paths → boards. A path's head is a
   dataset OR another path's result (restricted-view heads exist and
   save-as-dataset refuses them; virtual tables are recorded unbuilt). A
   board's PRIMARY input is its position in the path; join-class boards and
   map layers carry SECONDARY input references (dataset or path) in their
   configuration, and common-input paths make the path graph a DAG. A board
   row carries kind, title, enabled, pivoted, configuration jsonb and a typed
   selection jsonb. (Corrected by §10.)
2. **The board catalogue is the seventh indexed catalogue** —
   `contour_board_kinds(kind, visualize, filter_rows, aggregate,
   manipulate_columns, remove_duplicates, built, note)`: the 25 the page
   enumerates PLUS Map from its own page, flags from the page's own
   capability matrix, toolbar categories left to the surface as
   capture-derived grouping. Text board and `Edit data` recorded in notes as
   named-but-unlocated. A first slice built: Summary, Filter, Table,
   Expression, Histogram. The rest refuse by name. (Corrected by §10.)
3. **Save-as-dataset compiles the path to a job spec** (§2) — filters become
   WHERE, expressions become SELECT terms, the input is the head dataset's
   master view; Update re-publishes and bumps the version. The Spark → SQL
   substitution is the recorded divergence, scoped to the compiler.
4. **Parameters are analysis-level typed values** (Date/String/Number,
   multi-value for String/Number only), referenced `$name` in filter and
   expression configurations. (Quote-backed: §5.)
5. **One dashboard per analysis** — no dashboard resource (the api/ resource
   enum has no CONTOUR_DASHBOARD), but a real structure: a dashboard name on
   the analysis, ordered renameable tabs, and items (a promoted board OR a
   text widget) with row layout, one item type per row. (Corrected by §10.)
6. **The version selector pins the ANALYSIS, never the saved dataset** — the
   path head stores a pinned transaction used for previews; REFRESH moves the
   pin to latest (there is no automatic update); the compiled job spec always
   reads latest, because §2's rule says so. An UNSET parameter drops its
   filter from the compiled SQL rather than evaluating it. (Corrected by
   §10.)
7. **Not in this build, recorded by name:** 20 of the 25 boards (including
   Join, Set math, Pivot table, Heatmap, Macro); the expression function
   library beyond direct SQL passthrough; window functions and both
   correctness pages' warnings; dashboards' chart-to-chart filtering,
   presentation view and PDF export; multi-value parameters' array semantics
   in expressions; Export board; project references; convert-to-Pipeline
   Builder; compute usage; the 75 unopened images.

## Questions

1. **How much of the expression language should the Expression board accept?**
   Passing the text through to the job spec's SQL makes Postgres the dialect —
   honest but not Contour's language. Validating against Contour's documented
   function list means building a parser. I propose passthrough with the
   divergence recorded on the board kind, the transform-file precedent.
2. **Does a board's interactive selection (histogram bar → filter) belong in
   the engine or the surface?** The pages describe it as a filter the board
   applies downstream; I propose a `selection` jsonb on the board row so the
   compiled SQL sees it, and the surface writes it.
3. **`boards-verify-results` and `boards-filter` are unread** — they may
   carry rules about result sampling and filter semantics that bound the
   compiler. To read before building the compiler, not after.
