---
verify: strict
---

# Reading — Render hints

Pages read in full: `object-link-types/metadata-render-hints.md`.
Images read: `object-link-types/images/render-hints.png` (the page's only one).

Read as the named prerequisite of `object-explorer.md` §Decisions 5 — the
search/sort configuration OE consumes lives here.

## What the page says

> "Foundry uses render hints to communicate information about the use of
> Ontology properties to Object Storage v1 (Phonograph) and user applications
> in the platform."

They are performance controls as much as feature flags:

> "Many render hints are tied to reindex performance for an object type."

Two technical columns qualify every hint. "Adds raw index?" means Phonograph
"stores the render hint information by creating another index when storing the
backing dataset", so the property "two columns will be counted toward the total
number of columns indexed". "Requires reindex?" means the change waits for the
backing datasources to reindex — "You can wait for the next triggered reindex
or you can manually start the reindex" from the object type's Datasources tab.

The ten hints:

| hint | what it does | raw index / reindex |
|---|---|---|
| Disable formatting | values escape locale number formatting in Object Views | no / no |
| Identifier | numeric keys stop being treated as numbers — no formatting, no range filter in OE | no / no |
| Keywords | property gets "its own section" in Object Views | no / no |
| Long text | large text renders "in a more readable format" | no / no |
| Low cardinality | "there are not many possible values"; some widgets only filter such properties | yes / yes |
| Selectable | aggregations — "this property will be aggregated in Object Explorer histograms and Object View charts"; also "the Exact Match filter capability" | yes / yes |
| Sortable | string sorting; "Numeric and date properties are always sortable"; "Not recommended for arrays" | yes / yes |
| Searchable | the root switch; disable to "improve reindex performance ... especially significant if the property contains large strings" | yes / yes |
| Enable leading wildcards | `*term` queries on strings | yes / yes |
| Enable regex queries | regex queries on strings | yes / yes |

The dependency structure is stated three separate times and once in reverse:

> "Searchable must be selected in order for applications to apply the
> Selectable, Sortable, or Low cardinality render hints."

— and Enable leading wildcards and Enable regex queries each repeat "The
Searchable render hint must also be selected". So **Searchable is the parent of
five of the other hints**; only the four no-index hints (Disable formatting,
Identifier, Keywords, Long text) stand alone.

## What the image adds, that the prose does not

`render-hints.png`: the RENDER HINTS block is a checkbox list in the property
editor's right pane, sitting **below TYPE CLASSES and above PROPERTY
VISIBILITY (Normal / Prominent / Hidden radio)** — the three property-metadata
controls are one column. Checked index-adding hints carry an orange
**"Requires resync"** chip (the UI's word; the prose says reindex). For the
selected *date* property, `Long text` renders greyed out — availability is
**base-type-dependent**, which no sentence states. The pane sits beside the
datasource column-mapping view (dataset columns on the left, properties in the
middle, blue line for the selected mapping).

## Connects to

- `object-explorer.md` — Searchable/Sortable/Enable-leading-wildcards are what
  OE's search, column sorting and `*term` filters read; `understanding-text-search.md`
  says leading wildcards need this hint *plus* a reindex into Phonograph.
- Our schema: `object_type_properties` carries `visibility` (the pane's third
  block) and type classes exist per 415; render hints are the missing middle
  block of the same pane.
- 442 (`an_object_type_is_live_when_its_index_builds`): "Requires reindex" maps
  onto our index lifecycle — a hint flip is an index-affecting edit.
- `properties-and-keys.md`: "Indexing is what turns a datasource into queryable
  objects" — the hints are per-property instructions to that indexing.

## Decisions I had to make (mine)

1. **Render hints become boolean columns on `object_type_properties`** —
   `searchable`, `sortable`, `selectable` first (the three OE consumes), the
   rest added when a consumer exists. One column per hint, not a jsonb bag:
   they are a fixed documented vocabulary with CHECK-able dependencies.
2. **The dependency is a constraint**: `sortable OR selectable OR
   low_cardinality → searchable`, exactly as quoted.
3. **"Numeric and date properties are always sortable"** — the sortable column
   binds string properties only; numeric/date sorting is unconditional.
4. **A hint flip marks the index stale** (our 442 lifecycle), mirroring
   "Requires reindex" — the UI chip's "resync" wording is recorded but the
   column names follow the prose.

## Open questions

1. Defaults: the page never says which hints a new property starts with. The
   screenshot's example has Searchable+Sortable+Selectable checked on a date
   property, which suggests on-by-default for the big three, but that is one
   example, not a rule.
2. Which hints apply to which base types (Long text greyed for date is the only
   evidence of type-gating).
