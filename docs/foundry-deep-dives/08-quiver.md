# Deep Dive 8 — Data Analysis in Quiver (capture)

> Captured 2026-07-19 from source PDFs (`source/08-quiver/`, 25 lessons). Condensed record in our
> words with short quotes; Beacon mapping at the bottom. Unknowns `OPEN:`.

## 0. Course frame & positioning

- Quiver = analytics + dashboarding for **object and time-series data**: no-code transformations,
  parameterized dashboards embeddable in operational apps, and "robust time series capabilities …
  create, transform, visualize, and **forecast**." Key constraint, their words: "**Quiver only
  supports analysis for Ontology objects**." It "can **write back to the Ontology**."
- Four-tool positioning restated (complements session 7's): Quiver for object/time-series analysis +
  embedding; Contour for any-dataset drilldown; Pipeline Builder for production pipelines; Workshop
  for full app customization + multi-step workflows + writeback. Escalation paths: complex transforms
  → Pipeline Builder/Code Repos; advanced statistics/model work → Code Workspaces/Code Repos.
- **AIP is woven through the course**: *AIP Generate* ("add and configure cards by generating the
  next steps in the analysis based on natural language prompts") and *AIP Configure* (describe how a
  card/visualization should look — including generating **Vega JSON** — with accept/reject
  suggestions).
- Same TitaniumWorks inspection use case as session 7, but on **equipment/part objects** delivered
  via a Marketplace bundle (with ontology prefixing).

## 1. Interface model

- Unit of logic = the **card**. Two synchronized views:
  - **Canvas mode** (default): freeform display/position/resize; multiple canvases as bottom tabs
    (renameable); cards "don't necessarily have to be displayed in order of operation" and can be
    hidden from the canvas while still participating in the chain.
  - **Graph mode**: every card as a node with input/output links — "useful for understanding the
    lineage and dependencies within your analysis"; the course's Review step is literally *save,
    open Graph, verify the wiring, return*.
- Left panels: Analysis contents, Parameters, **Visual functions**, Dashboards, Settings (apply-button
  behavior, light/dark, chart color overrides, timezone, tooltips). Right-hand per-card config panel
  (Data / Display / Type / Objects / **Export** tabs; reopen via the cog).
- **Cards are typed**: "every parameter, transformation, and visualization card … can take zero or
  more required inputs and produce zero or more outputs. Inputs and outputs have definitive data
  types." All data cards/sources/parameters get **unique global IDs**, referenced in formulas and
  configs (e.g. `$<cardID>."part_cost"` in Vega encodings).

## 2. The analysis arc (cards exercised)

1. **Add data**: object set of all Equipment (or a single object by name); second object set Parts.
2. **Join to transform table**: left join; join table = Parts; current columns all + a *selected
   subset* of joined columns; match style ALL; `Equipment Id` = `Eq Id`; renamed
   "Equipment - Parts Join" ("good practice to name your cards").
3. **Filter transform table**: keep rows where Part Production Date on-or-after Jan 1 2024.
4. **Parameter**: Create parameter → **Selection > Property value** (dropdown fed by an object
   property: Equipment → Equipment Plant; other kinds — Time/Numeric/String/Boolean — take manual
   input). Wired into the filter card as an added condition with **"Is in array"** against the
   parameter. Gotcha recorded by the course: choosing **"Is (string)"** instead passes no default →
   the card returns *no objects*.
5. **Transform chaining in one card**: Find-and-replace (strip the `p-` prefix → new `Purity`
   column) → **Add Transformation** → Number operations > **String to number** → hide the two
   now-redundant columns via the Display tab's eye icon; type confirmed by the `123` icon. (The
   Transform menu also exposes **functions published from Code Repositories**; "Edit values" manual
   row editing is dismissed as unscalable.)
6. **Group by + array operations**: Group by Equipment Id/Name → per-property **arrays** plus an
   automatic **count** column; then **Number array aggregation** (Average of the purity array →
   `avg_purity`), **Array start** (first element → `capacity`), and a **Numeric formula**
   `@count / @capacity` → `actual_percent_output`.
7. **Visual function** (their reusable-logic primitive): from the Visual Functions panel → a graph
   view where you **Set as output** (the Average Part Purity aggregation) and **Set as input**
   (eligible inputs highlighted purple; the Parts object set) → **Publish** with a name → "available
   for others to use on the platform." Validation on a fresh canvas: add the function, bind its input
   to a new Parts set, and toggle **Auto-update** — "whenever a new function version is published,
   it's automatically applied."
8. **Visualizations**: categorical plot from transform table — grouped bar (max count vs max capacity
   per equipment, grouped segments, axis titles, number-format grouping); scatter (avg purity by
   production date bucketed monthly, segmented by equipment); **Vega plot** (defaults to a boxplot;
   JSON editor keyed by card global IDs; family includes box plots, sunbursts, radar charts; heat
   grids and overlay charts also named).

## 3. Dashboards & embedding

- Dashboard panel: per-card **Add to dashboard** (charts, tables, aggregations, *and parameters*);
  text blocks (paragraph/large-heading), extra tabs and sections; drag-to-rearrange blocks.
  **Publish** (auto-saves the analysis) → a production version link for colleagues; **Preview** shows
  the end-user view.
- **Embedding targets** (their list): Workshop applications, **Object Views**, Carbon Workspaces,
  Notepad. Mechanics shown: "Copy embeddable chart" → paste into Notepad; Notepad can embed a whole
  dashboard via Widget and schedule email distribution via an Automation; in Workshop, the **Quiver
  dashboard widget** takes input object sets "and optional output object sets for interactive
  Quiver dashboards" (selection flows back out).

## 4. Their recap best practices (condensed)

Chain transformations within a card to group logic — but split aggregations into separate cards so
their outputs can feed different downstream inputs; use Graph mode to validate wiring; reuse visual
functions for consistency; embed rather than duplicate.

## OPEN items

- OPEN: **time series + forecasting** — headlined in the intro ("create, transform, visualize, and
  forecast"), never exercised in the course. Directly adjacent to our prediction arc; the doc links
  (Time Series in Quiver) are the follow-up.
- OPEN: **ontology writeback from Quiver** — asserted in positioning, not demonstrated.
- OPEN: Carbon Workspaces; the card **Export** tab; the "New Quiver" toggle (UI transition period).

---

## Beacon mapping (analysis — separate from the record)

**This is the session that speaks to backlog #2/#4 and Insights — and it strengthens our stance
rather than changing it.** Quiver is the freeform object-set analysis canvas we deliberately don't
build. The decisive detail: **Palantir themselves put NL front and center inside Quiver** — AIP
Generate produces the *next cards* from a prompt, AIP Configure writes card/Vega configs from a
description. That is Quiver conceding that the card canvas is scaffolding for what users actually
want to say in language. Our NL-native equivalent (copilot answering over object sets with charts/
tables, Insights lenses for the curated recurring questions) targets the same endpoint without
shipping the canvas. **Leapfrog case: fourth product surface where their own AI direction validates
it** (Workshop's AIP Assist, Pipeline Builder's Generate, Vega Configure, Quiver Generate).

**Genuine parity notes:**
1. **Visual functions = our Logic Tool registry, no-code edition** — publish, name, reuse across
   analyses, versioned. The interesting contrast is their **Auto-update toggle** (consumers opt into
   following new versions) vs our callers-pin discipline. Ours is safer for production gates; theirs
   is better for analyst convenience. Worth remembering if we ever expose tool versions to operators:
   the pin-vs-follow choice should be explicit, per consumer — which is exactly what their toggle is.
2. **Graph mode as the analysis's own lineage view** — every derived artifact can show its dependency
   wiring. Same instinct as our TracePanel/agent traces and the Logic canvas viewer; confirmation
   that "show the wiring" is a first-class surface, not a debug extra.
3. **Typed cards with global IDs referenced in formulas** — even the freeform canvas is typed and
   addressable. Consistent with sessions 3/4: no-code in Foundry is always a veneer over typed,
   referenceable structure.
4. **Group-by → arrays + auto count** is a nice no-code factoring of aggregation; our tools do this
   in code — no gap.
5. **Embedding grammar** (dashboard widget with input *and output* object sets — selection flows back
   to the host app) matches our panel/lens composition; the output-object-set detail is the
   selection-aware pattern again, bidirectional.

**Flags for later:**
- **Quiver's forecast capability (OPEN)** sits adjacent to our consumption-forecast objective. If
  their time-series module ever matters to a fork decision, pull the Time Series docs then — don't
  assume from the headline.
- Their **writeback-from-analysis** claim, if real, blurs analysis and mutation. Our separation
  (tools read, actions write, no writes from Insights surfaces) is a deliberate hard line we keep.

**No impact on** P5/P6 or Track 1.
