# Quiver — the foundation

**Pages read whole (24):** `quiver/overview.md`, `core-concepts.md`,
`analysis-data-model.md`, `analysis-types.md`, `analysis-canvas.md`,
`analysis-graph.md`, `analysis-global-identifiers.md`, `analysis-save-share.md`,
`dashboards-overview.md`, `objects-overview.md`, `cards-index.md`, and the
thirteen `cards-index-*.md` category pages.

**Images: the section holds 442. The ten pages above reference 40 distinct
files, of which I opened four** —
`howto-analysis-canvas-annotated.png`, `analysis-graph-compact-nodes.png`,
`concepts-global-ids.png`, `concepts-input-output-types-next-actions.png`.
**Thirty-six I did not open**, and they are named here so the debt is recorded
rather than implied: `quiver-overview.png`, `howto-gear.png`,
`concepts-next-actions-input-type.png`, `concepts-editor-input-type.png`,
`concepts-input-output-types-cards-search-bar.png`,
`concepts-card-output-type.png`, `concepts-graph-canvas-toggle.png`,
`howto-analysis-canvas-add-cards-to-canvas-1.gif`,
`howto-analysis-canvas-add-cards-to-canvas-2.gif`,
`howto-analysis-canvas-create.png`, `howto-analysis-canvas-rename.png`,
`howto-analysis-canvas-resize-cards.gif`,
`howto-analysis-canvas-reorder-cards.gif`,
`howto-analysis-canvas-move-canvases.gif`,
`howto-red-eye-with-strikethrough.png`,
`howto-analysis-canvas-show-and-hide.gif`,
`howto-analysis-canvas-delete-dialog.png`,
`howto-analysis-canvas-view-dependencies.gif`,
`analysis-graph-preview-panel.gif`, `analysis-graph-focus-mode.png`,
`howto-analysis-graph-buttons.png`, `howto-analysis-graph-zoom-buttons.png`,
`save-button.png`, `history-button.png`, `howto-analysis-history-menu.png`,
`howto-share-button-location.png`, `howto-share-options-panel.png`,
`howto-share-link-sharing.png`, `howto-share-roles-example.png`,
`howto-share-button-location-in-your-files.png`, `dashboard-overview.png`,
`getting-started-add-data.png`, `getting-started-adding-objects.gif`,
`howto-object-single-add.gif`, `howto-object-set-from-oe.gif`,
`howto-object-set-import.png`. Nine of those are GIFs of an interaction whose
outcome the prose already states; the rest are button locations. The four I
opened are the four that carry structure the prose does not.

**Pages NOT read: 267 of 291.** The section is overwhelmingly a card
catalogue — see §6, which counts it exactly.

---

## 1. What Quiver is

> "Quiver provides a point-and-click interface to perform data analysis on
> object and time series data from the Ontology."
> — quiver/overview.md

It reads the ontology we already have; it does not introduce a store of its own.
That matters for what follows, because every other application we built this
week needed a backing table before it could do anything.

`core-concepts.md` names seven concepts: **Cards, Canvas and graph, Objects,
Time series, Dashboards, Parameters, Saving and versioning**.

## 2. The load-bearing idea: an analysis is a TYPED graph

This is the whole design, and it is stated twice on one page:

> "Every card in Quiver can take zero or more inputs and produces an output of a
> specific type."
> — quiver/analysis-data-model.md

> "A card can only be added as an input to another card if that card's output
> type is equal to the downstream card's input type."
> — quiver/analysis-data-model.md

So a Quiver analysis is a DAG whose edges are **type-checked**. The page then
draws the consequence in a worked example: a filter object set produces an
`object set`, an object property consumes a `single object`, so an **object
selector** must sit between them because it is the card that converts one to the
other. Conversion is not a coercion — it is a card.

The type list is enumerated on the same page, twenty-eight of them, and this is
the enumeration that wins over any single card page that spells one differently
(CLAUDE.md, "an enumeration beats a description"):

`Object set`, `Single object`, `Categorical chart`, `Object selection`,
`Pivot table`, `Ontology SQL`, `Transform table`, `Materialization`,
`Time series`, `Time series chart`, `Time series group`, `Bounded time series`,
`Event set`, `Time scatter plot`, `String`, `Number`, `Time`, `Boolean`,
`Duration unit`, `String array`, `Number array`, `Time array`, `Boolean array`,
`Numeric range`, `Time range`, `X/Y range`, `Flow start`, `Flow end`.

Two of those are not data at all but arity markers, which is how a zero-input or
zero-output card still types:

> "Flow start | Indicator that a card does not take any inputs."
> — quiver/analysis-data-model.md

> "Flow end | Indicator that a card does not produce an output type."
> — quiver/analysis-data-model.md

The type system is not decorative — it drives the authoring UI:

> "It only shows cards that are able to take your current card's output type as
> input."
> — quiver/analysis-data-model.md

**Inference (not on the page):** if we hold the catalogue as a table of
(kind, accepted input types, output type), then the type check, the next-actions
menu and the editor's input picker are all one query against it, and a card kind
we have not built refuses *by name* rather than rendering blank. That is the
same shape as `workshop_widget_kinds()` and `fusion_cell_types()`.

## 3. Global identifiers

> "Unique Quiver global identifiers (IDs) in the form of `$A` are automatically
> assigned to all Quiver cards when added to an analysis."
> — quiver/analysis-global-identifiers.md

They are the reference mechanism everywhere — formulas, Vega specs, axis
bindings:

> "To reference specific columns in a transform table, use the syntax
> `$A.column_name`."
> — quiver/analysis-global-identifiers.md

**What the image adds that the prose does not.**
`concepts-global-ids.png` shows IDs well past one letter — `$AHK`, `$GE`, `$AU`,
`$BQ` — so the sequence is A…Z then AA…, not a 26-card ceiling. The same capture
shows the badge is **colour-coded to the plot's series colour** ($AV magenta, $T
red, $BI green, $BQ cyan), which is the colour-groups feature I have not read.
And it shows an ID used as a *value*: the Editor's `X axis` field for four
separate plots reads `$GE 📅 Default Shared …` — one card referenced as the
shared time axis of many.

## 4. Canvas and graph are two views of one graph

> "A canvas is a page where you can display, rearrange, and resize the cards in
> your analysis."
> — quiver/analysis-canvas.md

And the sentence that stops a whole class of wrong modelling:

> "Unlike a Contour path, a Quiver canvas is used for display and organization
> only. Rearranging cards in your canvas will not affect the underlying sequence
> of data transformation."
> — quiver/analysis-canvas.md

So canvas membership is a **join table with position**, never the dependency
order. The two are explicitly independent in both directions:

> "Note that adding cards to your analysis on a canvas will also make them
> visible in the graph. However, cards added in graph mode are not automatically
> placed on a canvas."
> — quiver/analysis-canvas.md

Which means a card may exist in the analysis and be on no canvas at all — the
page names that state:

> "The card will appear in the **Not in canvas** section of the **Analysis
> Contents** panel, where it can be configured, added back to a canvas, or
> deleted."
> — quiver/analysis-canvas.md

Deletion therefore has two modes, and the page gives both verbatim:

> "**Delete and remove from downstream cards:** Removes the card from the
> analysis entirely."
> — quiver/analysis-canvas.md

> "**Remove from canvas:** Keeps the card in the analysis and keeps dependent
> cards unchanged."
> — quiver/analysis-canvas.md

And "unused" is a **three-part definition**, not a guess:

> "It is not placed on any canvas"
> — quiver/analysis-canvas.md

> "No card on a canvas depends on it"
> — quiver/analysis-canvas.md

> "It is not referenced by any dashboard, function, or global settings entity"
> — quiver/analysis-canvas.md

Graph mode is the same data drawn as nodes:

> "In graph mode, cards are represented as nodes on a graph, and inputs and
> outputs are represented by links."
> — quiver/analysis-graph.md

**What the images add.** `analysis-graph-compact-nodes.png` shows a node is four
things: the `$AHK` ID badge, the title, a canvas-membership glyph, and a **type
tag pill** reading `Time series` — the output type, on the node itself. The
canvas capture (`howto-analysis-canvas-annotated.png`) shows the same pill on a
canvas card header (`Object set`, `Time range`, `Time series chart`), so the
output type is chrome on every card in both views. That capture also gives the
top bar exactly: breadcrumb, `File`/`Help`, then `ADD DATA · Objects · Time
Series | ADD CARD · Search cards` on the left and the `Canvas ▾` view toggle on
the right; undo, redo, history, settings, **Save**, **Share** above it; a left
inner rail of Analysis contents / `(x)` parameters / `fx` functions /
dashboards / settings; and a canvas tab bar along the bottom with `+`.

## 5. Analysis types, saving, permissions

Three analysis types, from the comparison table:

> "| Analytical flexibility | High | Low | Low |"
> — quiver/analysis-types.md

Quiver analysis (all data, dashboards yes), **Time series analysis** and
**Object set path analysis** (one data kind each, no dashboards, convertible up
but never back):

> "Note that Quiver analyses cannot be converted to the simplified analysis
> types"
> — quiver/analysis-types.md

Saving is manual and versioned:

> "Access and revert to historical versions of your analysis by opening the
> **Analysis history** menu at the top of the screen."
> — quiver/analysis-save-share.md

And permissions need no new mechanism at all:

> "The permissions for a Quiver analysis are derived from its Project in the
> Foundry file system."
> — quiver/analysis-save-share.md

> "The access level stays the same between the Project and the Quiver analysis."
> — quiver/analysis-save-share.md

That is our `project_role_grants` unchanged. Link sharing is a second mechanism
on top of it and is **not** in scope below.

Dashboards are read-only presentations of an analysis, many per analysis:

> "Quiver dashboard mode allows you to present insights from your analysis in
> read-only, interactive dashboards."
> — quiver/dashboards-overview.md

> "Create multiple dashboards per analysis."
> — quiver/dashboards-overview.md

## 6. The catalogue, counted

291 pages in the section. **203 are `card-*` and 39 are `cards-*` — 242 of 291,
83%, is the card catalogue.** The remaining 49 are the foundation, of which I
read 24.

I parsed the thirteen `cards-index-*` pages mechanically rather than claiming a
count. They are organised by **output** type —

> "Select a card type category below to see all cards that return data of that
> type:"
> — quiver/cards-index.md

— and each bullet group states its signature in prose ("The following cards
accept object sets and return a single number:"). That yields **203 index rows
naming 167 distinct cards** across 41 distinct signature phrasings. Every card
the index names exists on disk.

**36 card pages are named by no `cards-index-*` page.** Thirty-four are reached
instead from the eighteen `cards-transform-table-index-*` pages or from
`cards-parameters.md` — a second and third catalogue axis. **Two are linked from
nothing in the section at all:** `card-multi-chart-time-series` and
`card-numeric-range-to-date-range`. I have not read either; they are recorded
here because "the index is complete" would have been a false claim.

**What the search-window image adds.** `concepts-input-output-types-next-actions.png`
shows the signature is drawn as **icons with a tooltip**, not words — `[in] → [out]
+1`, where `+1` means one further accepted input type, so a card may accept more
than one input type for the same slot. It also gives a category axis the prose
never lists: the next-actions bar reads `Search · Filter · Visualize · Calculate
· Join · Transform · Convert`, and the same seven appear on the empty canvas.
That set is **capture-derived**, so per our rule it may not carry a
`Values from <slug>` declaration.

## 7. Connects to

- **`packages/ontology` object sets and traversal** — the `Object set` and
  `Single object` types are ours already; `card-filter-object-set` and
  `card-switch-to-linked-object-set` are object-set operations we have.
- **Object Explorer (475/476)** — same inputs, different framing: Explorer
  filters and aggregates one object set, Quiver chains many typed steps.
- **`fusion_cell_types()`, `workshop_widget_kinds()`, `slate_widget_kinds()`,
  `code_repository_kinds()`** — the catalogue-as-index pattern this needs a
  fourth instance of.
- **Projects and `project_role_grants`** — §5 says the permission model is
  already built.
- **Time series** — Quiver's second data kind. We have no time series store, and
  that is the single largest thing this section assumes and we lack.

## Decisions

1. **Build the typed graph, not the cards.** The engine is
   analyses → canvases → cards → typed input edges, with the type check as a
   trigger. This is the part that is 100% documented and 100% structural.
2. **The 28 types are a declared value set** from `analysis-data-model`, which
   enumerates them in one table — `Values from quiver/analysis-data-model`.
3. **The card catalogue is an indexed backlog**, `quiver_card_kinds(kind,
   input_types, output_type, built, note)`, seeded from the index pages'
   machine-parsed signatures. Build a first slice only; every other kind is
   present, named, and refuses with its own name. Same treatment as Workshop's
   62 widgets and Fusion's 202 functions.
4. **Canvas membership is a join table with geometry**, never an ordering of the
   dependency graph, and a card with no canvas row is legal — that is
   `Not in canvas`.
5. **Deletion takes a mode** (`detach` / `remove_from_canvas`), and `unused` is
   the page's three-part test, implemented as written.
6. **Global IDs are stamped by trigger**, A…Z then AA…, unique per analysis, in
   the pattern of 679's `stamp_username`.
7. **Permissions are the project's**, with no Quiver-specific grant table.
8. **Not in this build, recorded by name:** link sharing; the AIP query bar; the
   preview panel and focus mode; colour groups; time series of any kind
   (no store exists); the 267 unread pages; the two orphan card pages in §6.

## Questions

1. **Time series is a hard dependency for roughly a third of the catalogue** and
   we have no store for it. Is a `time-series` section reading the next arc, or
   do we build Quiver over `Object set` / `Transform table` / scalars alone and
   let every time-series kind sit in the catalogue unbuilt? I have assumed the
   latter for this build.
2. **`Transform table` is a local, mutable table type** ("A local table used for
   flexible, low scale analysis") whose 18 index pages describe an operation
   library. Is that a Quiver concept or should it reuse the dataset layer? The
   pages say local and low scale, which reads as neither — I have left it as a
   catalogue entry rather than choosing.
3. **Does a saved version snapshot the cards, or is it a pointer?** The page
   says revert but not what is stored. I have assumed a JSON snapshot of the
   analysis, which is what `analysis_history` implies and what our branch
   overlay does not fit.
