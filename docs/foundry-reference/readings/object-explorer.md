---
verify: strict
---

# Reading — Object Explorer

Pages read in full (17 of 17 — the whole section, verified against the live
left-nav on 2026-08-12): `_index`, `overview`, `getting-started`,
`search-objects`, `search-syntax`, `understanding-text-search`, `analyze-sql`,
`filter-results`, `explore-charts`, `view-results`, `pivot-linked`,
`compare-object-sets`, `save-explorations`, `save-lists`, `apply-actions`,
`generate-urls`, `configure`.

Images read: all 90 in `mirror/object-explorer/images/` (the section was
re-mirrored 2026-08-12 with `--refresh`; the earlier mirror had stripped every
image). `_index` and `overview` are byte-identical — the tenth section where
that holds.

The app's internal name is **hubble**: every external URL route is
`/workspace/hubble/...`, the admin group is `hubble-exploration-admins`, and
the OE-specific type classes are namespaced `hubble-oe`.

## 1. What Object Explorer is

From `overview.md`:

> "Object Explorer is a search and analysis tool for answering questions about
> anything in the Ontology."

> "Users can easily find objects of interest by running queries ranging from
> simple keyword searches to comprehensive property filters ... explore the
> resulting object sets using the exploration view, or view them as a table of
> results, or select a specific object to see its Object View."

> "Object Explorer requires minimal configuration, and is geared towards less
> technical users."

The unit everything operates on is the **object set**: search produces one,
charts aggregate one, actions apply to one, comparisons compare two, and a save
persists one (dynamic or static).

## 2. Home page

From `getting-started.md`:

> "It is an orientation hub where one can start exploring objects, either with
> a specific question in mind or to discover possible object types to explore."

- **Global search bar** searches "individual objects, object types, saved
  explorations, or modules (objects-backed applications)". Warning: "If the
  Ontology contains more than 250 object types that a user may discover, the
  keyword search will be limited to the first 250 object types."
- Matches are on "titles and/or metadata (e.g. name, description, etc.) of
  object types, property types, saved explorations" and "any title or property
  of individual objects". Object-type and property-type matches show as
  type-ahead; **"Search for..."** is the first row and leads to the results page.
- **Groups**: "All object types accessible to a user are displayed under the
  search bar in configurable object groups" — the groups authored in Ontology
  Manager's metadata widget (`configure.md`), with an "Other" group for
  ungrouped types when custom groups exist.
- **Group graph**: per group, a List | Graph toggle; the graph "displays the
  links within the object types in the group and links to other object type
  groups", a `<->` badge on each edge opens the link types, clicking a node
  offers **Preview** / **Start exploring**.
- **Preview** panel: description, **visibility**, properties (with `Title` and
  `Primary key` tags), linked object types, **Start exploring**.
- **Favorites**: star on the card; "Favorites show up in a dedicated group at
  the top of the side navigation."
- **Explorations & lists** appear at the top of the page; "They can also be
  found in the Artifacts tab."

**What the images add** (`home_general.png`, `home_search_bar.png`,
`home_object_type_groupings.png`): the page headline is "Explore your data —
Select an object type from the list below to explore or view results"; the
window has its own **tab bar** ("New exploration" tabs, `Explorations ▾` and
`Lists ▾` pickers top-right); the search bar carries a **scope selector inside
it** (`All ▾` → Groups | Object types tabs, per-type counts drawn as bars,
"Searching selected" once narrowed); under the bar sit **Overview · Objects ·
Object types · Artifacts** tabs; each type card is icon + name + grey count
badge (7.28k) + star + `(i)` Preview on hover; the side nav paginates with
Prev/Next; types can carry an `Experimental` tag.

## 3. Search results page

Tabs **All / Objects / Object types / Artifacts** with counts; the sidebar has
**All results**, **Object type filters** (per-type match counts), **Object type
groups**, and **Artifacts** "divided into 'Explorations & Lists', 'Comparison
Views', and 'Modules'". (`search-objects.md`)

Sorting is specified exactly:

> "All prominent object types are shown before non-prominent object types.
> Within the prominent and non-prominent results, object types are sorted (in
> ascending order) by the number of individual object results for that type."

> "No hidden object or property types will be displayed as search results here
> or elsewhere in Object Explorer."

**Search-around from a result**: hovering an individual object offers "starting
an exploration of objects across a particular link to that individual result"
(the SFO → arriving-flights example); the image shows a link-picker dropdown on
the result row. Matched terms render highlighted (images).

## 4. Search syntax and the analyzer

`search-syntax.md`: quotation marks for phrases; **AND / OR / NOT** with
parentheses; `?` (one char) and `*` (zero or more); leading wildcards only with
the **Enable leading wildcards** render hint; "Combined leading-and-trailing
wildcards (`*term*`) are not supported"; `~` for fuzzy.

`understanding-text-search.md` is the mechanism page:

- Indexing runs each string property through an **analyzer**: tokenize at
  whitespace/punctuation, lowercase. Five analyzer types: **Standard, Simple,
  Not analyzed, Whitespace, Language** (english, french, german, japanese,
  korean, arabic, combined_arabic_english).
- "Properties must have the **Searchable** render hint enabled to be
  searchable."
- Underscores and periods stay inside a token (`banana_pudding` is one token).
- Global bar = token search, **OR by default**; property keyword filters offer
  **Contains / Starts with / Exact / Is not**.
- Leading wildcard search is **property-filter only** (not the global bar), and
  after enabling the render hint you "reindex the object type's backing data
  sources into **Object Storage v1 (Phonograph)**".
- Wildcard queries are **not analyzed**: "a wildcard query containing uppercase
  letters will not match" and multi-word wildcards cannot match.
- A capability matrix compares OE global / OE property filter / Workshop filter
  list / Functions API (8 string methods, `.exactMatch()` … `.fuzzyMatchAllTokens()`).
- Callout: "Object Explorer remains the primary interface for Ontology
  discovery ... **Insight** builds on Object Explorer" — a whole sibling
  section (10 pages) not part of this reading.

## 5. Filtering an exploration

`filter-results.md`: the search bar is "the central hub for filtering the
current set of objects". Three routes:

1. **By property** — alphabetical property list; picking one opens a value
   pop-over whose input "varies based on the type of the property".
2. **By value** — type the value and the right side offers
   "where Destination City Name is Los Angeles" if it exists in the current set.
3. **By keyword** — Enter creates a Has-keywords pill; per-term toggles
   **Is not / Starts with / Exact**, controlled by the toggles
   "rather than editing the terms in this dropdown"; **And/Or** builds nested
   expressions; clicking an And/Or tag flips it, and
   "if operators on two adjacent levels become the same, the filter will simplify to a single level of nesting".
4. **On links** — "Has Link" presence filter (with or without); properties *of*
   linked objects; links **to specific objects** ("Linked objects are displayed
   by their title in the resulting listogram").

Images: the property menu is two-pane — left rail = the main type plus
**LINKED OBJECT TYPES**, right pane = properties; while typing, each linked
type shows "N properties matching"; the pill grammar is `<Property> is <value>`,
`Has keywords (term1* AND NOT term2) OR term3`, and link-path pills read
`🔗 Origin Airport > Number Of Carriers is between 9 and 17`.

## 6. Charts (the Explore perspective)

From `explore-charts.md`:

> "Each chart represents an aggregation of a property field on the main object
> type, or linked object types. By default, there will be one chart shown for
> each **prominent property** on the selected object type ..."

Mechanics: **Add chart** card at the bottom (or "Add chart to view" while
building a filter — that one lands in the **first** position); remove via X
(does **not** remove the filter); reorder by dragging empty header space;
resize to one or both of the **two columns**; listograms grow via Show
more/less.

Chart types, with the aggregation vocabulary the images supply:

| type | for | notes |
|---|---|---|
| **Listogram** | String, Boolean, Array | Display as = Count / Sum / Average / Min / Max / **Property Count** / **Est. Unique Count** (object-explorer/images/charts_listogram_controls.png); sort by count or value; select values → **Keep / Exclude** → "Keep [FRP] Flights where Origin City Name is any of 2 selected values" (object-explorer/images/charts_listogram_select.png) → Apply filter |
| **Pie chart** | booleans, strings | config adds "Number of sections" |
| **Histogram** | numeric, date | auto-buckets; click a bucket or drag a range; min/max inputs; "Apply filter for 1 selected range" (object-explorer/images/charts_histogram_select.png) |
| **Grid plot** | two properties | X property × Group By property; X/Y axis limits (default 10); 7 color scales; Show Value Labels toggle; Plot Height; ctrl-click a contiguous range |
| **Single Statistic** | one numeric | Sum, Average, Min, Max, Count, Unique Count; "cannot be used for filtering" |
| **Statistics Table** | grouped numerics | Sum/Min/Max/Average/Count, optional summary row; filter by clicking a row |
| **Cluster Map** | geopoint | "The default for any geopoint type property"; scaled bubbles; aggregation configurable; click bubbles → apply filter |
| **Choropleth Map** | region-code text | needs typeclass `choropleth_map_config_id` with name `countries` / `us_states` / `us_counties` / `us_zip_codes`; config shows **Upload Static Layer** |

Charts on linked objects render a breadcrumb header (`Aircraft > Acquisition
Date`) with the linked type's icon.

**Undo/redo**: "the last 5 exploration states are saved"; undoable = filter
edits, layout changes, perspective changes, pivots.

**Layouts**: "shareable views for a specific object type" covering charts,
column configuration and sorts — the dialog states "**Layouts do not save the
current filters**". Fields: Name, Description, **Initial Perspective**
(Explore | Results), **Path** (the image shows `/Palantir/Example Layouts` — a
layout is saved *somewhere in the filesystem*), and "Set as default layout for:
For yourself / For all users". "If an individual user sets their own default
layout ... that layout will take precedence over any global default."

**Preview panel** (right rail): "a list of up to 20 results"; click a card →
Object View tab; Sort by in the subheader; a gear opens a multi-property sort
dialog "applied in order".

## 7. Results perspective (the table)

`view-results.md`:

- Infinite scroll; sorting only on properties with the **`Sortable`
  renderHint**; multi-sort where "the last one selected takes precedence" and
  earlier sorts show numbered badges; "Clear All Sorts".
- Columns: drag-handle reorder; **Freeze X columns**, where
  "The checkbox column is included in the count"; resize on a blue boundary;
  a per-column Hide option;
  **Configure columns** dialog — left panel "default columns", right panel full
  order/visibility, Show/Hide all, filter box, Move to top/bottom, "don't
  truncate text in this table"; admins can "save the current view as a new
  layout and set it as the default for all users".
- **Title column click** opens the Object View "in a new Object Explorer tab";
  selecting rows opens the **Selection Preview** panel from the right (the
  collapse icon closes it). "If multiple objects are selected, the object view
  for any of the **first twenty** is available for previewing." A dropdown
  offers **Compare objects** — two Object Views side by side.
- **Time series properties** render "the most recent observation ... on the
  left, and a sparkline visualizing the history ... on the right".
- **Inline edits**: "Properties that are configured with an inline edit action
  can be directly edited ... Once a user meets the submission criteria of the
  inline edit action, a pen appears next to the value on hover ... To submit,
  the submission criteria need to be passed again."

Image: the Selection Preview is a full Object View (tabs Overview / Properties
/ …, hero fields, an **Actions** dropdown, refresh and comment icons).

## 8. Pivot

From `pivot-linked.md`:

> "it is possible to shift the main object type of your exploration to any
> linked object type ... and filter us to only those flights departing from
> the large, eastern airports that we had filtered down to previously ... It is
> possible to pivot through multiple links, thus allowing you to flexibly
> explore across the ontology."

The image shows the carried filters as link-path pills on the new main type.

## 9. Comparison Views

`compare-object-sets.md`: **Compare** sits below the search bar; the comparison
set is "an existing saved exploration", "all objects of the given type", or a
new set defined on the fly ("dynamic filtering", with a colour picker). "All of
the charts in the layout will change to show the results from each of the
compared sets side-by-side"; joint filters apply to both; save and share like
explorations ("Sharing your comparison will not share access to the linked
explorations and/or underlying objects"); searchable from home.

Images: the header becomes two exploration pickers (blue/red diamond markers),
the filter bar reads "Apply a filter on all compared sets..." (object-explorer/images/comparison_filter.png),
every listogram row carries paired coloured bars, result rows carry a colour
stripe, and the save dialog is
"Save current view as a comparison of Object Sets" (object-explorer/images/comparison_save.png)
with a folder Save location (`/Shared/Flights_Project`).

## 10. Saving: Explorations and Lists

- Exploration: "revisit the same set of search parameters while retaining the
  applied filters and the configured layout" (`save-explorations.md`).
- List: "the saved list will not change unless manually updated"
  (`save-lists.md`); the save takes the whole result in bulk or the ticked
  selection.
- Both: **Private** ("saved into the Explorations folder in your home folder")
  or **Public** ("prompted for a location"); "The configuration of your
  enrollment might prevent saving files in home folders"; sharing never grants
  data access; both reachable from the home search and from the
  Explorations/Lists dropdowns (filters All / Favorites / Created by Me /
  Shared with Me).

The save dialog screenshot (`object-explorer/images/explorations_saved_list.png`) is the sharpest
statement of the dynamic/static split: Exploration = "Save filters as a dynamic
exploration that updates with new results"; List = "Save current results as a
static list matching filters at this moment", with a radio between saving only
the selected rows and saving everything in the results
(`object-explorer/images/explorations_saved_list.png`). The same header exposes a **Monitor** button
and an **Analyze in Quiver** button (other apps, noted only).

`generate-urls.md` attests what a saved exploration *is* at the RID level:

- `/workspace/hubble/exploration/saved/ri.object-set.main.versioned-object-set.<uuid>`
- `/workspace/hubble/external/objectSet/v0/ri.object-set.main.object-set.<uuid>`

— i.e. **an exploration is a versioned object set resource**; ad-hoc sets from
other applications are plain `object-set`. The complex-search JSON grammar
(propertyFilter: textFilter / valuesFilter / dateRangeFilter /
numberRangeFilter / relativeDateFilter / timestampRangeFilter /
relativeTimestampFilter; linkFilter: presenceFilter MUST_HAVE) allows "many
PROPERTY filters, but only 1 LINK filter".

## 11. Actions, Open In, Export

`apply-actions.md`: three buttons — "**Actions** for data writeback, **Open
In** for bringing your current exploration to another platform application, and
**Export** ... such as to an Excel spreadsheet". "The current set of selected
objects ... (or all objects, if none are selected) is passed directly to the
form"; "Actions are unavailable if the number of selected objects exceeds
1000"; ambiguous prefills are left empty.

`configure.md` adds the admin knobs, all **type classes** (kind + name pairs):

- success toast link: kind `actions`, name `view_object_with_type:<OBJECT_TYPE_ID>`
  on the create action's Primary Key parameter (image confirms placement).
- hide an action in OE: `hubble-oe:hide-action` on the Object Reference List
  parameter.
- dynamic-object-set actions (**"still in development and ... subject to
  deprecation without an automatic migration"**): a String property
  value-formatted as **Resource RID**, a Modify Object rule, and type classes
  `hubble-oe-object-set-rid` / `hubble-oe-security-rid` (the latter names a
  folder whose permissions the saved sets inherit; "the object sets are not
  exposed in a Project and are not searchable").
- Default-layout admins: "the `hubble-exploration-admins` multipass group, or
  ... the `Object Exploration Admin` application permission in Control Panel".

## 12. Analyze using SQL [Beta]

Read-only Spark-SQL scratchpad over "the backing datasource or the
materialization": "Ontology entities with edits disabled must have a singular
datasource. Entities with edits enabled, edit-only properties, or multiple
datasources **require a materialization**" (the editor's warning card offers
"Create materialization"). "Queries cannot mix tabular sources ... and Ontology
inputs." Freshness: "up to 30 seconds". Limits: Contour backend, 1,000-row
sample, usage attributed under Contour. Identifier forms:
`` `ri.ontology.main.object-type.<uuid>` `` or
`` `ontologyApiName`.`objectTypeApiName` `` (image: `` `default`.`ExampleCustomer` ``),
and a many-to-many link type by its RID in backticks.

Image: the RID autofill popover is a full object-type picker — All ontologies /
Group / Status filters, Recently used, a per-type card with properties (key
icon on the primary key, bookmark on the title key), a dependents count, and a
"Create new object type" button at its foot.

## Connects to

- **The index**: OE's substrate is the object index — ours is 442
  (`an_object_type_is_live_when_its_index_builds`) + 443 (`quicksearch_reads_
  the_index`). The global bar is quicksearch grown up: same input, typed tabs,
  sidebar facets, prominence ordering.
- **Visibility**: prominent-before-normal sorting, hidden-never-shown, and
  "one chart shown for each prominent property" all consume `visibility`, which
  we carry on object types and properties (460 sets prominence on promotion).
- **Object sets**: our `object_sets` table (saved set with filters) is the
  exploration half; a List is the static half we do not have. RID grammar for
  both is now attested (`rid-grammar.md` gains `ri.object-set.main.
  versioned-object-set` / `.object-set`).
- **Actions**: 445 (apply writes the edit log) + 449 (submission criteria gate
  the apply) are exactly what OE's Actions button and inline edit invoke; the
  1000-object cap and prefill rules are OE-side.
- **Materializations**: 453 — analyze-SQL is a *consumer* of materializations,
  and its requirement clause is the crispest statement of when one is needed.
- **Groups**: 416 `object_type_groups` is precisely what the home page renders.
- **Type classes / render hints**: Searchable, Sortable, Selectable, Enable
  leading wildcards, choropleth_map_config_id, hubble-oe:* — the render-hints
  page lives in `object-link-types/metadata-render-hints`, **not yet read**;
  it gates the search/sort config half.
- **Object Views**: title-click, Selection Preview and Compare objects all
  render Object Views — our generated object views are the target surface.
- **Phonograph**: "reindex ... into Object Storage v1 (Phonograph)" — third
  attestation of the storage service naming
  (`datasets-rid-and-object-storage.md`).
- **Insight**: a 10-page sibling section that "builds on Object Explorer" —
  standing interest, not queued.

## Decisions I had to make (mine, not Palantir's, unless quoted)

1. **The phase splits in four, in this order**: (E1) the exploration engine —
   object set in, filtered/aggregated answers out, over the merged
   datasource ⊕ edit-log view the index already reads; (E2) the surface —
   home (groups, search, previews), exploration (charts two-column grid +
   Results table + 20-card preview rail); (E3) saved artifacts — Exploration =
   dynamic object set, List = static object set, both project resources;
   (E4) the hooks that already have backends — Actions with the 1000 cap and
   criteria-gated inline edit, and export. Foundry documents no such order;
   this is dependency order.
2. **An Exploration is our existing `object_sets` row; a List is a new static
   membership table.** The save dialog's own words draw the line — dynamic
   filters versus a static snapshot (`object-explorer/images/explorations_saved_list.png`) — and
   `generate-urls.md` shows both are object-set resources. Their
   versioned-vs-plain RID distinction is recorded but not reproduced.
3. **Aggregations are SQL over the merged view.** Listogram/histogram/statistic
   charts are GROUP BY queries per chart. `Est. Unique Count` becomes exact
   `COUNT(DISTINCT …)` — we will not fake an estimator; the label follows the
   behaviour, not Foundry's word.
4. **Prominence and hiding reuse `visibility`** — prominent types sort first
   (ascending by count within tier, as quoted), hidden types and properties are
   excluded from every OE surface.
5. **Search stands on quicksearch's index; the five Lucene analyzers are not
   rebuilt now.** Postgres text search is the stand-in; per-property analyzer
   choice and the Searchable/Sortable/leading-wildcard render hints wait for
   the `metadata-render-hints` reading. Flagged as the largest deliberate
   deviation in the phase.
6. **Deferred whole**: Comparison Views, Analyze-SQL (beta; Spark/Contour),
   choropleth + Upload Static Layer, dynamic-object-set actions (Palantir's own
   deprecation warning), the external URL grammar, layouts' admin
   group/permission plumbing, and Insight.
7. **Caps adopted verbatim where they bind us**: 20-card preview, 1000-object
   actions, 5-state undo (if undo is built at all in E2), 250-type search note
   recorded but irrelevant at our scale.

## Open questions

1. **Where do favorites and layouts live?** A layout has a `Path` field
   (`/Palantir/Example Layouts`) so it is a filesystem resource, but no page
   names its RID type or storage; favorites have no stated home at all.
   Operator's course material may show more.
2. **Analyzer fidelity**: is Postgres tsvector acceptable as the analyzer
   stand-in for now, or should per-property analyzer config (5 types) exist as
   schema from the start even if only one is implemented?
3. **`metadata-render-hints`** (`object-link-types/`) — must be read before
   building search/sort config; is it mirrored?
4. **The Artifacts tab** on home is shown but never described beyond its name;
   its exact contents (explorations, lists, comparisons, modules?) are
   inferred from the search-results sidebar categories.
5. **"Property Count" vs "Est. Unique Count"** in the listogram aggregation
   menu: the page never defines Property Count (count of non-null values, by
   the name). Marked inference.
