# Deep Dive 7 — Data Analysis in Contour (capture)

> Captured 2026-07-19 from source PDFs (`source/07-contour/`, 30 lessons). Condensed record in our
> words with short quotes; Beacon mapping at the bottom. Unknowns `OPEN:`.

## 0. Course frame & tool positioning

- Contour = tabular data analysis + visualization: "a linear sequence of dependent blocks of logic
  that operate on data," organized into **paths** for interpretability. Tasks: cleaning/transforming,
  visualization, saving results as new datasets, the **expression language**, dashboards.
- **Their own four-tool positioning** (Course Introduction — the clearest statement across all nine
  courses): **Contour** for ad-hoc analyses + regular reporting (dashboards, Notepad embedding) on
  *datasets* in one tool; **Quiver** for advanced exploration on *Ontology objects* incl. time series,
  embedding in Workshop; **Pipeline Builder** for production pipelines (low/no-code, release process);
  **Code Repositories** for production-ready code. The closing Tips add: Contour's "real strength lies
  in analysis, visualization, and dashboarding"; if you only need reusable cleaning, use Pipeline
  Builder — and **"Even if you start in Contour, you can export your logic to Pipeline Builder"**
  (ad-hoc → production promotion path).
- Use case: TitaniumWorks Manufacturing data analyst prioritizing equipment inspection from `parts` +
  `equipment` CSVs (uploaded as structured datasets; Marketplace fallback).

## 1. The board/path model (Introduction to Boards)

- Analysis = sequence of **boards** (visualization, transformation, or both); the first,
  non-removable board is the input dataset; "data always flows from the top of the page down";
  the **board toolbar** always sits under the last board. A sequence = a **path**.
- New paths can start from: any dataset on the stack, any dataset already in the analysis, or **the
  result of any previous path** (input board titled "<path> (resulting set)"). Boards and paths are
  renameable — renaming boards is recommended "as kind of documentation."
- **Complexity budget, stated as doctrine:** "confine your work to no more than **five paths, each
  with a maximum of 20 boards**, for optimal performance and clarity." Clean each dataset in its own
  path.

## 2. Boards exercised (the analysis arc)

1. **Table** (Suggested > Table): columns + dtypes + 1,000-row preview; **Show data** drawer available
   at *any* board = data as computed at that point.
2. **Calculation**: summary stats (unique count of `part_id` = 3,428; of `eq_id` = 5) — "useful to
   validate your logic when performing joins, window functions, or complex data transformations";
   compare counts as the analysis progresses.
3. **Multi-Column Editor**: rename `eq_id` → `equipment_id` (naming consistency for the later join);
   drop six part columns (no effect upstream or on the source dataset); "Keep new columns by
   default" toggle for post-join paths.
4. **Find and Replace**: strip the `p-` prefix from `part_purity` (find `p-`, replace empty).
5. **Convert types**: `part_purity` String → Double.
6. **Filter**: `part_production_date` on-or-after Jan 1 2024 → 3,428 → **2,176** rows (Calculate
   summary). Boards have an **Enabled/Disabled toggle** — disable to see the unfiltered count flow
   through, re-enable; "good practice to confirm the row count and validate your analysis as you go."
7. **Join** (Join > Join): Mode **Add columns**; choose the `equipment` dataset; pick just the three
   relevant columns (option to take all + prefix incoming); match condition `equipment_id` =
   `equipment_id`, Match all. (Noted trap in the data: both an installation and an inspection date.)
8. **Expression** (×2) — the expression language does "SQL-like operations on refreshed data,
   without … transferring data extracts to Excel each time a report is due":
   - `avg_purity`: windowed average — average `part_purity` partitioned by `equipment_id`, rounded
     to 2 places (`avg(...) OVER (PARTITION BY ...)` inside `format_number`).
   - `inspection_alert`: CASE logic combining inspection recency (>365 days via `date_diff` from
     `current_date()`) with purity thresholds (<.90, .90–.95) → 'high'/'medium'/'low'.
   - **Staleness warning captured verbatim in spirit**: a popup flags that `current_date` "is only
     evaluated when the path is recalculated" — "for a production use case, we'd likely then want
     this analysis to be running on a daily basis."
9. **Histogram**: count by `inspection_alert`; **clicking the 'high' bar creates a filter** — "Keep
   rows where inspection_alert is high" — applied to all subsequent boards. Course note: analysts
   often use visualization boards *instead of* filter boards because they "view your data and apply
   filtering functionality simultaneously."
10. **Pivot Table**: rows `equipment_plant` + `equipment_id`, aggregate unique count of `part_id`;
    only 3 of 5 plants visible (upstream histogram filter). **"Switch to pivoted data"** toggle: the
    aggregated table can become the data for later boards (histograms can pivot too).
11. **Chart**: one board, many types (bar, line, scatter, heat grid, pie). Built a scatter
    (avg_purity × unique equipment count), then reconfigured to a stacked vertical bar (avg_purity ×
    unique part count, segmented by equipment_id).

## 3. Parameters

- Created in the left **(x) Parameters panel**: name `plant` (display name follows), **allow multiple
  values**, **suggest values from linked column** (`equipment_plant`).
- Used in a Filter board as **`$plant`** (renders as a yellow token). With no value set, no filtering
  happens; setting Plant 1–3 in the panel → 1,341 rows.
- Purpose: "filter consistently across multiple paths … reducing redundancy and chance for human
  error"; parameters surface interactively in dashboards (plant managers pick their plant).

## 4. Dashboards

- Per-board **Add to dashboard** + per-board titles + dashboard title; preview panel on the left.
  Course dashboard: histogram + pivot + bar chart ("Inspection Prioritization Dashboard").
- Viewer interactivity: **chart-to-chart filtering** (click the 'high' bar → downstream boards
  update; a note flags that saved filters are overridden; **Reset** arrow restores), the parameters
  panel, fullscreen presentation.
- **Export as PDF** (Actions → Portrait; applied filters/overrides are included).
- **Email on a schedule → "recipes"**: "recipes are used to monitor for conditions of interest, to
  automatically send notifications through Foundry or email … and to deliver a preview of additional
  context." Configure recipient/group, message, cadence, name/description **and expiration** →
  emailed link + PDF. Precondition: Settings → "Refresh analysis data on open."

## 5. Settings & operational notes ([Optional] Common Settings)

- Editing mode vs viewing; **locked analysis** when another tab holds it; **visualization timezone**
  — "Contour implicitly expects timestamps to be in UTC," display configurable to local/fixed.

## 6. Their recap best practices (condensed)

Clean per-dataset in separate paths; validate at each step (Calculation/Table/Show data — "you can
always remove boards after validation"); parameters for consistent filtering; the 5-path/20-board
budget.

## OPEN items

- OPEN: **Notepad embedding** — named in the use case goals, no lesson in the export.
- OPEN: recipes beyond the email flow (they're described as a general monitor/notify primitive).
- OPEN: "export your logic to Pipeline Builder" mechanics; Contour compute-usage model.

---

## Beacon mapping (analysis — separate from the record)

**Verdict for the parity board: we don't need a Contour.** Contour is dataset-level ad-hoc analysis
for analysts. Their own positioning routes *object* analysis to Quiver — so the parity question for
ontology-native Beacon is session 8's, not this one. The demand Contour serves (analyst drill-down,
data QA, one-off reporting) is covered for us by SQL + Insights lenses, plus the profiling grammar
already noted from session 2. **Skip-verdict confirmed with evidence.**

**Patterns worth keeping:**
1. **Visualization-as-filter** (click a bar → a filter chip that flows downstream) — third appearance
   of this grammar (Object Explorer pivots, Contour boards, dashboards). Whatever Search
   Around/Insights work we do, click-to-filter is the interaction baseline users will expect.
2. **Recipes** — user-authorable "watch this condition → notify/email with context, with a cadence
   and an expiration" — is our monitors metric/trigger pattern *plus* delivery, as end-user config.
   The hospitality-shaped version: **scheduled email digest of a lens/briefing** (GM gets the morning
   briefing PDF). Classic hotel-ops ask; demand-gated note for the Home/Insights arc.
3. **The `current_date` staleness warning + "run it daily in production"** is our prediction-arc
   `asOf` discipline surfacing in their UX — they warn exactly where we fixed bugs (Q1–Q4). Good
   company.
4. **Enabled/Disabled board toggle** = one-click ablation to see a step's impact — cheap, legible
   debugging affordance; same spirit as our eval diff views.
5. **Complexity budgets stated numerically** (≤5 paths, ≤20 boards) — worth adopting the *practice*
   of explicit budgets in our own guidance (e.g., agent block counts, tool-set sizes) rather than
   vague "keep it small."
6. **Ad-hoc → production promotion** ("export your logic to Pipeline Builder") maps onto our
   authoring ladder: an operator/copilot exploration graduating into a registered tool is the
   NL-native version of the same move.

**No impact on** P5/P6 or Track 1.
