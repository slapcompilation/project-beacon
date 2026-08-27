---
verify: strict
---

# Contour — a path is a pipeline you built by looking at it

**The section is 33 pages, 163 images. Pages read whole (16):** `overview`,
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

**Images: my 16 pages reference 77 distinct files; I opened two** —
`contour/images/overview.png` and `contour/images/boards-category-mode.png` —
because they carry the workspace anatomy and the toolbar. **The seventy-five I
did not open are the per-board configuration captures** (the
`board-descriptions-*` family, 48 of the 77), the parameter dialogs, the join
GIFs and the dashboard captures; they become due board-by-board if boards are
ever built individually, and I am the one who skipped them.

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

## Decisions

1. **Build the path engine**: analyses → paths (ordered, dataset-headed,
   chainable from another path's result) → boards (ordered within the path,
   kind + configuration jsonb + optional selection). Position is the
   computation; there are no edges to type-check because the list is the
   graph. (Quote-backed: §1.)
2. **The board catalogue is the seventh indexed catalogue** —
   `contour_board_kinds(kind, category, built, note)` from the 25 the page
   enumerates and the six capture-confirmed categories. A first slice built:
   Summary, Filter, Table, Expression, Histogram — enough to filter, derive,
   see, and count. The rest refuse by name.
3. **Save-as-dataset compiles the path to a job spec** (§2) — filters become
   WHERE, expressions become SELECT terms, the input is the head dataset's
   master view; Update re-publishes and bumps the version. The Spark → SQL
   substitution is the recorded divergence, scoped to the compiler.
4. **Parameters are analysis-level typed values** (Date/String/Number,
   multi-value for String/Number only), referenced `$name` in filter and
   expression configurations. (Quote-backed: §5.)
5. **One dashboard per analysis** — a membership row per promoted board with a
   position; no dashboards table. (Quote-backed: §6.)
6. **The version selector pins the ANALYSIS, never the saved dataset** — the
   path head stores an optional pinned transaction used for previews; the
   compiled job spec always reads latest, because §2's rule says so.
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
