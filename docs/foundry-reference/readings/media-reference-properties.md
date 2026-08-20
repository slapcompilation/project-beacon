---
verify: strict
---

# Reading — The media reference property type

The media phase's first reading. Its scope is deliberately narrow: **what a media
reference property IS, and what backs it** — the question that has to be settled
before a migration touches `object_type_properties`. The media *set* (transactions,
formats, granular policies, transforms) is a separate subject with its own pages,
and this reading does not cover it.

**Read in full:** `media-sets-advanced-formats/media-in-ontology`,
the **Media references** section of `object-link-types/base-types`.

**Images parsed:** `object-link-types/images/media-reference-source.png`,
`object-link-types/images/media-reference-media-source.png`. Both carry structure
the prose never states, and one of them answers a question the prose leaves open.

**Read in a second pass** (see *Answered after the fact* below):
`data-integration/media-sets`, the **Media references** section of
`media-sets-advanced-formats/media-overview`, and
`pb-functions-expression/isValidMediaReferenceV1`.

**NOT read, and nothing below rests on them:** `importing-media`,
`configure-granular-policies-media`, `transforming-media`, `virtual-media-sets`,
`use-media-in-osdk`, `media-usage-limits`, and the `api/v2` specs for
`attachment-properties` and `media-reference-properties`. **Attachments are a
separate property type from media references and this reading does not cover
them** — the phase needs its own pass before either is built.

## What a media reference is

> A **media reference** property type allows you to have media on your objects,
> such as images, videos, audio files, and documents.

It is a **base type**, listed beside Cipher text and Struct, not a separate kind
of property. The page prints the value's shape:

> * **`mimeType`:** The file's media type.
> * **`reference`:** A reference containing the media set RID, view RID, and
>   specific media item RID.

and the example gives the three RIDs their names — `mediaSetRid`,
`mediaSetViewRid`, `mediaItemRid`, under a `reference.type` of `mediaSetViewItem`.
**Three RIDs, not one**: the set, the *view* onto it, and the item. That the view
is addressed separately is the detail most likely to be dropped if we shortened
this to "a pointer to a file".

## What backs it — the part that matters for us

> Object types with media reference properties are backed by a dataset. The
> backing dataset must include a media reference column, which will map to the
> media reference property. This column type is specifically designed to store
> media reference values and ensures proper integration between your ontology
> objects and media sets.

This is our existing model exactly: a property names the datasource column it
reads. **A media reference property needs no new backing mechanism** — it is a
column of a particular type on the dataset already backing the object type.

But it needs one thing more, and this is the sentence a shorter reading loses:

> Additionally, a media reference property must have a **media source**, which
> can be configured in the **Capabilities** tab of the object type. This media
> source should be the media set that the media references point to.

So there are **two bindings, not one**: the property→column binding every
property has, and a *second* binding from the object type to the media set. The
column holds references; the media source says which set they are references
*into*. `must have` is the page's word.

## What the images add that the prose does not

The first screenshot is the property editor with **Source** selected, and it
enumerates something the prose never lists — the three ways any property can be
sourced, each with its own one-line definition:

> Source type
> ◉ Datasource — Back this property with a dataset, restricted view or stream
> ○ User edits — Back this property exclusively with edits from user inputs
> ○ Linked objects — Use a property from another object type
> — object-link-types/images/media-reference-source.png

That is a closed set of three with published definitions, and it is **not
specific to media** — it is the source model for every property, found here only
because this page happened to screenshot it. Note that a datasource is "a
dataset, restricted view or stream": **restricted views are already built here**
(S2), so two of those three we have.

The same image shows the property editor's tabs — `General`, `Source`, `Display`,
`Interaction`, `Dependents` — and puts the **Backing column** picker (`mediaReference`)
under a heading of `Data`.

The second screenshot answers what the prose left open. The prose says a media
source "should be the media set", naming one thing; the image shows the
configured row naming **two**:

> Media Reference Properties — Set up a media reference property.
> Media Reference · + Add media source
> images · master
> — object-link-types/images/media-reference-media-source.png

`images` is the media set and `master` is a **branch**, carrying the same branch
icon used elsewhere in these captures. **A media source is a (media set, branch)
pair**, which is exactly the shape of `object_type_datasources` (dataset +
branch). The prose mentions no branch at all.

## A conflict the pages have with each other

`base-types` states the array rule as a single exclusion:

> All base types may be used in arrays to represent multiple values for a
> property, excluding the `Vector` and `Time series` types.

`media-in-ontology` states a third exclusion:

> Media reference lists are not supported as a property type on an object.

Both are current pages. Read together, the array rule's exclusion list is
**incomplete** rather than wrong — media reference is a third type that cannot be
arrayed, documented only on the media page. Taking `base-types` alone would have
produced a schema permitting media reference arrays. Recorded here because it is
the same failure family as the vocabulary pairs: one concept, two pages, and the
narrower one is authoritative.

## One behaviour worth carrying into actions

> Media files uploaded in action forms are only uploaded to the backing media set
> upon successful form submission, to ensure that canceled or failed submissions
> do not result in orphaned media files in media sets.

The upload is **deferred to commit**, so a cancelled action leaves nothing
behind. This is a transactional rule about action forms, not about the property
type, and it belongs to whatever builds media upload rather than to the column.

## Answered after the fact — Questions 1 and 3

The operator asked whether the docs settle these. They do, on pages this reading
had listed as unread. Both answers are recorded here rather than in a new file,
because a reading whose Questions have been answered elsewhere is how a stale
Decisions block gets built from.

**Question 1 — a media set is NOT a dataset.** `data-integration/media-sets`
defines one on its own terms:

> A **media set** is a collection of media files with a common schema, for
> example, files of the same format. Media sets are designed to work with
> high-scale, unstructured data

and `media-overview` contrasts the two directly, naming a different backing
service for the dataset side:

> A **file** within a regular Foundry dataset (backed by the platform's catalog
> service), rather than a media set.

> If you need to use files from a dataset with Pipeline Builder media transforms,
> first load the files into a media set

They are separate resource kinds. **Decision 3's open half is therefore closed:
a media source cannot reuse `object_type_datasources`**, which names a dataset.

**And the reference is a THREE-variant union, not one shape.** The base type page
showed only `mediaSetViewItem`; `pb-functions-expression/isValidMediaReferenceV1`
prints two more as worked examples:

> {"mimeType":"PDF","reference":{"type":"datasetFile","datasetFile":{"fileReference":{"datasetRid":"ri.foundry.main.dataset.a","ref":"master","logicalFilePath":"file.pdf"}}}}

> {"mimeType":"PDF","reference":{"type":"mediaSetItem","mediaSetItem":{"mediaSetRid":"ri.mio.main.media-set.a", "mediaItemRid":"ri.mio.main.media-item.a"}}}

Counted across the whole mirror the tokens are `mediaSetViewItem` (119
occurrences), `mediaSetItem` (27) and `datasetFile` (1), and there is no fourth.
Note `mediaSetItem` carries **no view RID** — so "three RIDs, not one" above is
true only of the view-scoped variant. And `datasetFile` holds `ref: "master"`,
a branch, beside `datasetRid` and `logicalFilePath`.

**Had a CHECK been written from `base-types` alone it would have admitted one
token of three.** This is the api/prose split the repo already knows about,
except the falsifying page here is an expression reference, not `api/`.

**Question 3 — the column is marked by a TYPECLASS, not a distinct column type.**
`media-overview`'s Python example writes the metadata dataset with:

> column_typeclasses = {'mediaReference': [{'kind': 'reference', 'name': 'media_reference'}]} # Enables in-line thumbnails in dataset

So the backing column is an ordinary column carrying the typeclass
`{kind: reference, name: media_reference}`. That is why `base-types` could say
the column "is specifically designed to store media reference values" without
naming a type — there is no new type to name. **This ties the media phase to the
`capabilities-typeclasses-and-branching` sweep**, which is the allocated reading
for typeclasses generally.

One behaviour worth keeping, since it constrains any retention design:

> Even if a *path* has been overwritten by a newer upload, a saved media
> reference to the "overwritten" media item will continue to render and
> reference the original item.

## Answered on a second push — Question 2, the Capabilities tab

Asked to try harder for sublinks in main categories. The Capabilities tab has
**no page of its own** — grepping `MAP.md` for "capabilit" returns pages about
AIP Analyst and AI FDE, nothing ontological. It is documented **entirely at the
point of use**, and almost all of it in `map/`, a section this reading had no
reason to open. That is the same rule the organization role→workflow catalogue
follows, applied to a UI surface.

Assembled from four pages, the tab carries at least six groups:

**Geospatial** —

> A circle geometry can be specified on an object type by selecting a **Radius**
> property in the **Geospatial** section of the object type's **Capabilities** tab.

> To specify that a string property contains H3 cell IDs, select that property
> under **H3 cell** in the Geospatial section of the object type's
> **Capabilities** tab.

with `Track Latitude` and `Track Longitude` in the same section, which "must be
numeric time series properties representing the object's location over time".

**Event** —

> Object types can be configured as events by specifying **Event start time**
> and **Event end time** timestamp properties in the **Event** section of the
> object type's **Capabilities** tab.

plus an **Event intent** "indicating the severity of the event", in that section.

**Search Around** —

> To designate an intermediary object type to always link merge, turn on **Link
> merge always** in the **Search Around** section of the intermediary object
> type's **Capabilities** tab.

with `Incoming links to merge` and `Outgoing links to merge` beside it.

**Default tab** — "You can change the default tab for an object in Ontology
Manager's **Capabilities** tab." **Offline App Sync** — `developer-console`
walks through enabling it there. And **Media reference properties**, which is
how this reading arrived.

The `developer-console` screenshot also places the tab: the object type editor's
sidebar reads `Observability`, `Capabilities`, `Object views`, `Interfaces` —
so **Capabilities is a peer of Interfaces**, which we already model, not a
sub-panel of properties.

> Observability / Capabilities / Object views / Interfaces
> — developer-console/images/eo-capabilities.png

**What this means for us.** Capabilities is where an object type declares
*optional roles it can play* — mappable, event-like, traversal-merging,
offline-syncable, media-bearing — each one a small set of property designations
on the type. That is the same shape as our primary-key and title-key
designations, which are already property-level declarations. **It is a
designation surface, not a new backing mechanism** *(inference: no page says
this in general terms; it is read off six instances that all take the same
form)*. The media source is the one member that is not purely a property
designation, since it names an external resource.

## Answered on a third push — Question 4, and yes the distinction is documented

The three source types are not a media quirk. **Each one has its own page in
`object-link-types`**, and the three are mutually exclusive strategies for where
a property's value comes from.

**Datasource** — the default, and the only one the overview describes:

> Property values are created and displayed in user applications by adding
> backing datasources to an object type in the Ontology Manager.

**User edits → `edit-only-properties`:**

> Edit-only properties allow you to define Ontology properties that are not
> directly mapped to a column in the backing dataset of the object type.

It carries two constraints the radio label does not show:

> **Permissioned to one of the datasets backing the object type:** To ensure
> data consistency and security, edit-only properties must be permissioned to
> one of the datasets backing the object type.

> **Available only in Object Storage v2:** Edit-only properties are a feature
> that is exclusively available for object types leveraging Object Storage v2.

So an edit-only property is *unmapped but still permissioned* through a
datasource — it does not escape the datasource, only the column. **That matters
for us: we are on OSv2, so this one is available rather than blocked.**

**Linked objects → `derived-properties`** (Beta):

> Derived properties are properties that are calculated at runtime based on
> values from linked objects. Instead of storing data directly, a derived
> property pulls information from objects connected through link types,
> optionally applying aggregations like averaging, counting, or collecting
> values into lists.

> Derived properties are **read-only** and cannot be edited by functions or
> actions.

The three therefore divide cleanly by **where the value lives**: in a column, in
the edit store, or nowhere at all — computed at read time across a link. That is
a real trichotomy, not three labels for one mechanism.

**One discrepancy, recorded rather than resolved.** `edit-only-properties`
describes the control as a **toggle**: "Under the **Data** section, toggle on the
**Edit-only property** toggle and choose a dataset to permission to". The
screenshot in `base-types` shows a three-way **radio group** labelled `Source
type` in that same region. Two shapes for the same choice — most likely the
radio group is the newer control that absorbed the toggle, but **no page says
so**, and the difference is not worth guessing at. Whichever it is, the property
still ends up sourced one of three ways.

## Decisions

1. **Media reference is a base type, not a new property kind.** It joins the
   existing base type list; nothing about `object_type_properties`' shape changes
   to accommodate it.
2. **No new backing mechanism.** The property reads a media reference *column* on
   the dataset that already backs the object type — the model we have.
3. **A second binding is required**: object type → media source. ~~The image
   shows that source is a **(media set, branch)** pair~~ — **corrected
   2026-08-19 by `api/v2`, which publishes the datasource as a `mediaSetView`
   carrying `mediaSetRid` and `mediaSetViewRid`, "the Resource Identifier (RID)
   of a single View of a Media Set. A Media Set View is an independent
   collection of Media Items".** The screenshot's second element, rendered
   `images · master` with a branch-like icon, is the *view*, not a branch. The
   pair shape was right and one of its halves was wrong, which is the failure
   mode of reading structure off an icon.

   It also does **not** take its own table for the pair, as this decision
   assumed. 585 made the media set view a third arm of `object_type_datasources`
   — the API models it as a datasource kind beside `dataset` and
   `restrictedView` — and `object_type_media_sources` holds only the binding
   (datasource, property).
3b. **The reference value is a three-variant union** — `mediaSetViewItem`,
   `mediaSetItem`, `datasetFile` — and any CHECK must admit all three. Only the
   first appears on the base type page.
4. **Media reference may not be arrayed**, per `media-in-ontology`, despite
   `base-types` listing only two exclusions.
5. ~~**Nothing is built from this reading yet.**~~ Built across 582, 585 and the
   surface that finally reached it (2026-08-20). The flagged inference — that
   the three source types form a closed set, read off a radio group rather than
   a sentence — **held**: they are exactly `column`, `user_input` and
   `linked_objects`, and the API's property mapping union (`column`, `struct`,
   `editOnly`) agrees on the first and third from the other side. The API specs carry the enums, and
   this reading has not read them. *(Inference, flagged: that the three source
   types in the screenshot form a closed set is read off a radio group — three
   options with no scroll — not off a sentence. Treat as strong but unconfirmed
   until a page or an API enum states it.)*

## Questions

1. ~~Is a media set a dataset?~~ **ANSWERED above: no.** Separate resource kinds,
   separate backing services, and files must be loaded into a media set before
   media transforms accept them.
2. ~~What is the Capabilities tab?~~ **ANSWERED — see below.** It holds far more
   than media sources, and none of it is documented in the ontology section.
3. ~~What is the media reference column's type?~~ **ANSWERED above: there is no
   new type.** The column carries the typeclass `{kind: reference, name:
   media_reference}`, which is why the page could describe the column without
   naming a type.
4. ~~Do the three source types apply to every property?~~ **ANSWERED: yes, and
   each has its own page.** `edit-only-properties` (OSv2-only, unmapped but
   permissioned to a backing dataset) and `derived-properties` (Beta, read-only,
   computed across links) are two property-source modes we have never modelled.
   Both are real gaps, and neither belongs to the media phase.

**All four questions are answered. New questions this raised:**

5. **Is our property model missing the source dimension entirely?**
   `object_type_properties` assumes a backing column. Edit-only and derived
   properties do not have one, and edit-only is available to us today.
6. **What does `derived-properties` need to express?** Aggregations named on the
   page — averaging, counting, collecting into lists — over a link type. That is
   an expression language, not a column reference, and it should get its own
   reading before anything is built.
