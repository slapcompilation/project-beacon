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

---

## 13. The link filter's real shape, and how I got it wrong twice (2026-09-08)

Building the far-property link filter was attempted twice on paper and refuted
twice before any code was written. Both wrong turns are recorded, because each
came from a *real, cited, on-topic page* — which is what makes them worth
keeping.

**Wrong turn 1: I read the encoding page and declared the feature complete.**
`object-explorer/generate-urls.md` prints a filter JSON whose only link member
is a `presenceFilter`, so I concluded our engine already matched Object
Explorer. It does not. `filter-results.md` is the page that documents the
feature, and its *Filtering on links* section gives three kinds:

> To search for objects that have a particular link, select the "Has Link" option

> It is also possible to search for objects that have links to other specific objects. For example, after selecting a link choose the option "Filter by Airline". This opens a filter for links to specific objects. Linked objects are displayed by their title in the resulting listogram.

> To search for objects whose linked objects have a specific property, select the relation in the left side of the search menu panel. From there, choose a property type to filter.

**Wrong turn 2: I treated that JSON block as the ENUMERATION.** It is not. The
block is a worked example, immediately followed by "There are more types of
filters available, including:", carrying its own callout —

> This example may be out of date – use the instructions below to find out the latest format.

— and instructing the reader to obtain the real format by running
`hubble_get_current_search()` in the browser console. A page that says *there
are more, this may be stale, go read it off the running app* **describes** a
format; it does not enumerate a closed set. Designing "we may add no token the
corpus does not print" on top of it is 599/600 with the roles swapped: treating
a description as the list. The same capture that supplies the far-property pill
shows a geospatial value kind (`Airport Location is bounded by any of 41
geographic areas`) that the block never prints, which settles it independently.

### What the shape actually is: a link holds MANY filters

The page that prints the configuration shape is Workshop's, not the Explorer's:

> To filter on linked object properties, select a link within the **Filter on a link** section of the **Add filter...** dropdown.

> Once selected, click into the link config to add filter sections. You will see a setup similar to the **Filters configuration** options described in the Configuration Options section, with some additional options.

> The **Has Link** filter is unique to linked object filters and filters on the presence of a link. For example: "Filter for all **Tasks** that have a link to **Person**."

— `workshop/widgets-filter-list.md`. So the model is **link → a list of filter
sections**, and *Has link* is ONE MEMBER of that list rather than the link
filter's single value. Workshop is a different product, so it does not settle
the Explorer's wire format; but it is the only page in the corpus that prints
the configuration shape, and the Explorer's own menu agrees with it —
`has_link.png` and `linked_to_object.png` show, under one selected link, a `Has
<X>?` row, a `Filter by <X>?` row, then a `PROPERTIES` header and the far type's
properties. Three kinds under one link, which is a link config.

**That nesting resolves two things a flat member could not.** `matchType` is a
field of the `presenceFilter` *value*, so a flat element whose value is a
`numberRangeFilter` has nowhere to put it — nested, presence keeps its own
member and its own `matchType`. And several predicates can share one link, which
`pivot_flights.png` shows directly: two pills, both reading `Origin Airport ›
…`, independently removable.

### The cap does not survive its own documentation

> You can have many *PROPERTY* filters, but only 1 *LINK* filter.

That is the only sentence in the mirror quantifying the filter list, and our
`object_set_filters_valid` enforces it. But `charts_linked_property_charts.png`
shows one Flights exploration carrying far-property filters over **two different
links** (`Aircraft › Acquisition Date` and `Airline › Total Miles`), and
`pivot_flights.png` shows two over one link. Under any counting where a
far-property predicate is a link filter, the validator would refuse states
Foundry's own screenshots reach — and CLAUDE.md forbids being stricter than
Foundry. The cap sentence sits on the page that disclaims itself as possibly out
of date, which is the likeliest explanation.

### And the api settles that this is the Explorer's shape, not the platform's

`functions/api-object-sets.md`: link filters there are presence only —
`.isPresent()` — and far properties are reached by `.searchAroundX()` then
`.filter(...)`, capped at three. The v2 `ObjectSet` union has no link-filter
primitive at all, and `filter.where`'s twenty-eight members contain no link
predicate. So a far-property *filter element* is an Object Explorer construct
that compiles to a traversal; it is not something the platform api models, and
our engine is right to compile it rather than to mirror an api union.

## Decisions (2026-09-08) — BUILT by 776/777 except where noted

1. **The link filter nests.** `{type:'linkFilter', linkType, filters:[…]}` where a
   member is `{type:'presenceFilter', matchType}` or
   `{type:'propertyFilter', propertyType, value}`. Every tag keeps its printed
   spelling; the nesting is Workshop's documented shape and the Explorer menu's.
2. **The current flat form must keep validating.** `object_set_filters_valid` is
   a CHECK on `object_sets.filters`, so saved explorations exist in the flat
   shape and cannot be rewritten by a validator change alone.
3. **`objectType` stays absent.** In the printed example it is the SUBJECT type
   on every element — the three property filters are on review fields and carry
   the same value as the link filter — and Foundry needs it because its
   `objectTypes` is a list. `object_set_where(p_object_type, filters)` takes one
   subject by signature, so the field is redundant here rather than dropped.
4. **"Filter by <X>?" is NOT a property predicate on the primary key.** It sits
   above the `PROPERTIES` header as a sibling of `Has <X>?`, both rows vanish
   when the subject rather than a link is selected, and the page identifies the
   objects by **title**. It is its own kind, and its listogram carries
   Keep/Exclude, which `valuesFilter` has no token for. Deferred, not folded in.
   **Still deferred after 776** — it is the one of the three kinds not built.

## What 776 and 777 built (2026-09-09)

The nested grammar, the far-property predicate, and the cap in the form
Decision 2 of the operator's call gave it.

* `object_set_property_predicate(object_type, filter, alias)` is
  `object_set_where`'s value CASE **lifted, not copied** — its twelve emits all
  had the shape `format('... o.%I ...', prop.property_id, ...)`, so the alias
  threaded through mechanically and the subject arm now calls it with `'o'`.
* A `linkFilter` may carry `filters: [...]` whose members are `presenceFilter`
  and `propertyFilter`. The far predicate compiles into the arm's own EXISTS,
  beside 771's policy gate and **before** the negation, so `MUST_NOT_HAVE`
  means *has no link to a far object matching this* and no far object the
  caller may not read can be inferred from either polarity.
* **The cap moved to one filter per LINK.** Taken literally it would refuse a
  state `charts_linked_property_charts.png` depicts — one exploration filtering
  two different links — and CLAUDE.md forbids being stricter than Foundry. The
  sentence also sits on the page that disclaims itself as possibly out of date.
  Recorded as OUR reading, not as something a page says.
* The flat form still validates and still compiles, because saved explorations
  carry it.

777 exists because 776 shipped without a proof block — **the second time in one
session**, after 775 corrected 774 for the same omission. That is a pattern, not
a slip: the header and the mechanism get written and the migration then feels
finished before any assertion exists.

The web offers the control now, so the grammar is reachable where the page says
it is reached: select the relation in the left panel, then a property of the far
type from the same menu. `AddFilter`'s value controls serve both panes — the
property list follows the pane — and the pill reads the way the capture's
breadcrumb does, `Origin Airport > Number Of Carriers is between 9 and 17`.
`Filter by <X>?` stays disabled with a line saying so, because it is the kind
that is not built.

The web's cap is per-link too, so a second relation is still offered when one
already carries a filter.

## Open questions (2026-09-08)

1. **What does `hubble_get_current_search()` actually return?** The page names it
   as the way to learn the current format. We cannot run it. Everything above is
   therefore the best reading of prose plus images, and the wire format is not
   confirmed by anything that is not disclaimed.
2. **How is the cap really scoped?** Keep it and refuse states the screenshots
   show, or relax it and diverge from the only sentence that quantifies. This
   needs a human call.
3. **How does Exclude compile?** Every listogram carries Keep/Exclude, and the
   far-property member as designed has no negation.


---

## 14. The third link filter kind, and why it is not built (2026-09-09)

`Filter by <LinkedType>?` — the pixels carry the question mark that the prose
drops. Reconciled before building, and the reconcile says **do not build it
yet**.

> It is also possible to search for objects that have links to other specific objects. For example, after selecting a link choose the option "Filter by Airline". This opens a filter for links to specific objects. Linked objects are displayed by their title in the resulting listogram.

**No page and no capture in the mirror shows this filter open, or its serialized
form.** All three link captures — `has_link.png`, `linked_to_property.png`,
`linked_to_object.png` — are of the search MENU with a row hovered, the state
immediately before the click. `generate-urls.md` serializes exactly one link
filter and it is kind 1, presence. The deep dives add nothing: the Object
Explorer lesson text is seven lines and covers no filtering.

Building it would stack four inferences into structure:

1. **The wire member** — nothing publishes one.
2. **Multi-select** — the prose is plural ("specific objects"), and the property
   listogram capture shows two values selected, but that is a different widget
   in a different pane. Reading a plural is not seeing a selection.
3. **Keep / Exclude** — the page grants negation explicitly to the other two
   kinds ("or objects that do not have the associated link"; `"Is not": Negates
   the current search term`) and is **silent** here. The Keep/Exclude dropdown
   is documented for listogram CHARTS: "Selected values can be kept or excluded
   by using the dropdown at the bottom of the chart", and
   `charts_listogram_select.png` shows the dropdown open with exactly `Keep` and
   `Exclude`, over the sentence `Keep [FRP] Flights where Origin City Name is
   any of 2 selected values`.
4. **Title or key** — "displayed by their title" says how they are *shown*,
   never that title is the identifier. Filtering by title is wrong for a type
   whose titles are not unique, and no page gives a key.

CLAUDE.md's rule 3 applies exactly: the mirror does not cover it, the courses are
exhausted, so **ask** rather than invent. A plausible shape invented here becomes
structure, and structure is expensive.

### What is already true, and worth knowing before asking

**The Keep case is already expressible.** 776's nested far predicate on the far
primary key *is* a filter for links to specific objects, and
`linkIndex.test.ts` proves it green today — `far('linkidx_pairs','pk',['B2'])`
returns 1. `object_set_rows` already compiles a saved list of specific primary
keys into exactly that shape at the subject end. So the missing thing is a UI affordance and a
negation, not a mechanism.

**Exclude is a general gap, and its meaning is ambiguous.** No negated values
token exists in the seven value kinds, so a near-property listogram cannot
express Exclude either. And the two readings differ:
`NOT EXISTS(link AND far.pk IN {A,B})` means *has no link to A or B*, while a
listogram Exclude might mean *has a link to some far object that is not A or B*
— different sets for any subject linked to both A and C. No page settles it.
That ambiguity is the strongest single reason not to guess.

### What the reconcile found instead

A defect in 776, fixed by 778: a link filter carrying BOTH the flat `value` and
the nested `filters` was accepted by the validator and **negated twice** by the
engine, so "has no link" asked twice returned the objects that have one. Second
time this session that a reconcile aimed at one thing found a defect in another,
after the far-side leak 771 closed.

## 15. A filter compares a property it can compare (2026-09-09)

Found while reading the time series slice, and filed here rather than there
because it is not a time series defect — it was only *noticed* on a series id.

### What was wrong

`object_set_property_predicate` compiled a range filter against any property at
all. The numeric arm emits, for a `string` property whose index column is `text`:

```
(true AND o.some_string >= 5)
```

and Postgres answers `42883 operator does not exist: text >= numeric`. I ran
that comparison against the live database rather than reasoning about it.

**Five of the seven kinds do this** — `numberRangeFilter`, `dateRangeFilter`,
`relativeDateFilter`, `timestampRangeFilter`, `relativeTimestampFilter` — because
each compares the column to a typed literal. Only `textFilter` and
`valuesFilter` are safe, and for a reason worth stating: both cast the column to
`text` first, so nothing is out of range for them.

### Why it is a defect even though the query fails either way

The result is a bare SQLSTATE from the planner, and this project takes exactly
one rule from Foundry's stack rather than from a page — namespaced, typed
errors, so a caller can branch without parsing prose. `42883` is not that.

**This is not being stricter than Foundry.** Nothing new is refused: the query
already failed. What changed is that it now fails by name,
`Ontology:FilterTypeMismatch`.

### Where the rule went, and why not the validator

`object_set_filters_valid` is the CHECK on `object_sets.filters`, and a CHECK may
not subquery — so it cannot reach `object_type_properties` to learn a base type.
It validates SHAPE only, which is why a saved exploration could hold a mistyped
filter. The refusal belongs at the point of compilation, where the property row
is already in hand.

### How reachable, measured

Our Explorer picks its controls from the property's type, so the UI does not
produce one. The platform function is callable directly, `object_sets` accepts
it, and the generated client exposes it. **Latent through the UI, reachable
through the API** — the same shape as 778's double negation, which was also
written off as unreachable until the validator was read properly.

### What the docs say about this: nothing

`numberRangeFilter` appears in exactly ONE mirrored page,
`object-explorer/generate-urls`, which is the URL-encoding page and which
disclaims its own example:

> This example may be out of date – use the instructions below to find out the latest format.

`api/` publishes no object-set filter union at all.

**And I under-read that page, which 785 corrects.** §15 first said it "says
nothing about which property types each applies to". Four lines below the bullet
list I stopped at:

> The type of the value must match the type of widget that shows by default for that property in Object Explorer. For example: `valuesFilter` for a histogram widget; `textFilter` for textbox.

That is the rule, stated as a **must**. So the refusal 784 added has a documented
principle behind it and not only an inference from Postgres operators. What is
still inference is narrower, and worth stating exactly:

* **that** a mismatch is refused — DOCUMENTED, by the sentence above;
* **which** kinds fit which base types — inference, because the rule is written
  in terms of a property's *default widget* and no page in the corpus pairs
  widgets with property types. `workshop/widgets-filter-list` lists widget kinds
  ("keyword, histogram, single- and multi-select dropdowns, distribution chart,
  single- and multi-date pickers, and timeline displays") without binding them
  to types.

So `filter_kind_applies` stays the narrowest available reading — a kind is
refused only where the comparison it emits has no operator in Postgres — and
nothing is refused on taste.

**The lesson is separate from the one this page already taught.** That lesson was
to read the feature page rather than the URL-encoding page. This one is:
*I read four bullets and treated the section as exhausted.* The sentence that
mattered sat immediately below the list, outside it.

### The three kinds with no UI — CLOSED by 785

That same page lists four kinds beyond the flat two, and three of them compiled
with no control reaching them: `relativeDateFilter`, `timestampRangeFilter` and
`relativeTimestampFilter`. A temporal property now offers all four — between
dates, relative in days, between timestamps, relative in hours — with the field
names the page gives (`sinceDaysAgo`, `startMillis`, `sinceMillisAgo`). The two
relative kinds take NUMBERS rather than dates, which is why the range inputs
change their hints with the mode.
