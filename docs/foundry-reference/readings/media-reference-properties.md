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

**NOT read, and nothing below rests on them:** `media-overview`, `importing-media`,
`configure-granular-policies-media`, `transforming-media`, `virtual-media-sets`,
`use-media-in-osdk`, `media-usage-limits`, and the `api/v2` specs for
`attachment-properties` and `media-reference-properties`. The API specs matter
before any CHECK constraint is written — they are where enums live, and they have
falsified our constraints twice. **This reading is not sufficient to build from
alone**; it settles the shape, not the vocabulary.

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

## Decisions

1. **Media reference is a base type, not a new property kind.** It joins the
   existing base type list; nothing about `object_type_properties`' shape changes
   to accommodate it.
2. **No new backing mechanism.** The property reads a media reference *column* on
   the dataset that already backs the object type — the model we have.
3. **A second binding is required**: object type → media source, and the image
   shows that source is a **(media set, branch)** pair, mirroring
   `object_type_datasources`. **Whether it reuses that table or takes its own is
   not decided here** and should not be guessed — media sets are not datasets,
   and `data-integration/media-sets` is unread.
4. **Media reference may not be arrayed**, per `media-in-ontology`, despite
   `base-types` listing only two exclusions.
5. **Nothing is built from this reading yet.** The API specs carry the enums, and
   this reading has not read them. *(Inference, flagged: that the three source
   types in the screenshot form a closed set is read off a radio group — three
   options with no scroll — not off a sentence. Treat as strong but unconfirmed
   until a page or an API enum states it.)*

## Questions

1. **Is a media set a dataset?** Everything here treats them as different things
   ("the media set that the media references point to", a separate RID family
   `ri.mio.main.media-set`), yet the media source is bound with a branch exactly
   as a dataset is. `data-integration/media-sets` should settle it, and the
   answer decides Decision 3.
2. **What is the Capabilities tab?** It is named as the place a media source is
   configured, and we have no such tab. Whether it holds more than media sources
   is unknown — `capabilities-typeclasses-and-branching` is an allocated sweep
   and probably answers it.
3. **What is the media reference column's type on the dataset?** The page says
   the column "is specifically designed to store media reference values" without
   naming the type. Our datasource columns are typed; this needs a name.
4. **Do the three source types apply to every property?** If so, `User edits` and
   `Linked objects` are two property-source modes we have never modelled, and the
   answer is much larger than the media phase.
