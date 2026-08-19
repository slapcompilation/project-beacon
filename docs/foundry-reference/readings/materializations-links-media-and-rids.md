---
verify: strict
---

# Reading — materializations, link editing, media, semantic search, cleanup, RIDs

Closes six open questions and finds a latent defect in code we already shipped.

Pages read: `object-edits/materializations`, `ontology/overview-semantic-search`,
`object-link-types/edit-link-types`, `interfaces/interface-link-types-overview`,
`map/events`, `functions/media`, `media-sets-advanced-formats/media-overview`
and `media-in-ontology`, `ontology-manager/navigation`, `ontology-manager/cleanup`.
The RID grammar was also consulted from the specification at
github.com/palantir/resource-identifier, which is **not in the mirror and is
therefore never quoted here** — §RIDs describes its four segments in my own
words. A quotation the gate cannot read is a quotation nobody can check.

---

## 1 — Materializations, and why that rail entry was greyed out

> "Ontology users can create **materializations** of indexed data from the
> Ontology that contains the **latest state of each object by combining data from
> both input datasources and user edits**."

So the loop closes: dataset → object type → **materialized dataset**. Two stated
use cases: downstream pipelines that need latest-state-including-edits, and bulk
download.

**Why it was greyed in the deep dive screenshot:**

> "Navigate to the **Materializations** tab by **toggling the Edits
> configuration** in the **Datasources** tab…"

That object type had `Edits: Disabled`. The tab is gated on edits being on.

**The v1/v2 difference matters to us.** In OSv1 a writeback dataset was
*required* to enable user edits. In OSv2 edits are enabled by a toggle, so
"materializations **optional** in OSv2". Also: "**multiple** materialized datasets
to be created, in case users want to materialize only **a subset of the
properties**."

**Propagation is a mode, not a schedule:**

> "users can enable **automatic** propagation of user edits. This mode propagates
> user edits to the configured materialized datasets automatically (with a
> **latency of a few minutes**)… If the latency… is not critical, users can reduce
> costs by configuring **periodic** builds… rebuilt whenever the input datasources
> have new data or **every 6 hours**."

**The schema comes from the ontology, not the datasource** — and this is the
sentence that matters most:

> "the schema used for materialized datasets is **copied from the Ontology
> definitions** instead of relying on the backing datasource configuration.
> Specifically, the **API Name** metadata of each property is used as the schema
> of the materialized dataset."

**Retention is not customizable:** "Historical transactions are constantly
deleted and **only the latest snapshot is guaranteed** to be available."

**Two reserved column prefixes:** "`__` prefixed columns (e.g. `__is_deleted`,
`__patch_offset`) … are metadata columns used by Foundry for **deduplication**…
should not be used in production workflows."

**And branching:** "Materializations **cannot be created on a branch**.
Materializations **cannot be edited on a branch**." But changes to an object type
on a branch *are* indexed there and written to the materialization.

## 2 — Semantic search

> "Semantic search is accomplished using AI models to transform the text into
> vectors… called '**embeddings**'… the vectors, each of size N, that are close to
> each other in N-dimensional space are the ones that have similar underlying or
> semantic meaning."
>
> "If the embedded text is then **associated with a particular object in the
> Ontology**… Finding related entities… is simply finding the **nearest
> vectors** in N-dimensional space."

Two "Learn how" paths: a **Palantir-provided model** or a **custom model**, plus
chunking and PDFs. **We already have a `vector` base type** in the 22 — this is
what it is for, and pgvector is installed.

## 3 — Editing a link type: status is a gate

Four changes force a reindex and make links **unavailable** while it runs:
changing a many-to-many backing datasource, **changing cardinality**, **changing
the foreign key**, and **deleting**.

Two hard rules, both keyed on status:

> "link types with an `active` status **cannot be deleted**."
>
> "you **cannot change the API name** for link types with an `active` status."

And the key-mapping rules, which are a constraint we can enforce:

> "in a link type with **many-to many** cardinality, the columns in the backing
> datasource **must map to the primary keys** of the object types. If the type of
> the primary key property… is not the same as the type of the column it is being
> mapped to… **an error will prevent you from saving**."
>
> "In a link type with **any other cardinality**, the application requires that
> the key of one of the object types must map to the **Primary key** of that
> object type, **ensuring that the “one” side of the Cardinality is unique**."

Visibility has stated semantics: "A `prominent` link type will prompt
applications to **show this link type first**. A `hidden` link type will **not
appear** in user applications."

And **type classes** appear again: "Apply type classes as **additional metadata
that can be interpreted by applications**." The same mechanism that stores
legacy group names. It is Foundry's open extension point on a type.

## 4 — Interface link type constraints

A concept I did not have at all.

> "An **interface link type constraint** defines an object-to-object relationship
> **common across all object types implementing an interface**… When an object
> implements an interface with an interface link type constraint, **concrete link
> types on the object type are used to fulfill** interface link type constraints."

Four parameters:

> * **Link target type:** An interface **or** an object type.
> * **Target:** A specific interface or object type.
> * **Cardinality:** One-to-one or one-to-many.
> * Whether or not the link is **required** as part of object type implementation.

Target = **interface** "when you want to model the relationship between two
**abstract** object types" — `Facility` links to `Alert`, and `Airport → Flight
Alert` satisfies it. Target = **object type** "when the relationship… is concrete
and the specificity **should be enforced**".

So interfaces constrain **links**, not only properties. Ours constrain only
properties.

## 5 — Media

A **media reference** is a property base type (we have it). What the Capabilities
tab's media source names is the **media set** those references point to.

A media set has "a **schema type**, which defines the type of files that can be
stored… such as documents, images, or audio" and "a **primary format**, which
specifies the file format that all files in the media set **must** be" — audio
(wav/flac/mp3/mp4/sph/webm), DICOM, document (pdf, +docx/pptx/txt as additional
input formats), email (eml), image, and more.

From `media-in-ontology`, the type-specific operations available on a media
reference property: **OCR on documents · text extraction · audio transcription ·
read metadata**. And two constraints worth keeping:

> "Media files uploaded in action forms are **only uploaded to the backing media
> set upon successful form submission**, to ensure that canceled or failed
> submissions do not result in orphaned media files…"
>
> "**Media reference lists are not supported** as a property type on an object."

## 6 — Events confirm the capability slots

> "Configured in Ontology Manager, event objects contain **start and end timestamp
> properties**."
>
> "**Shape:** Uses a start and end time property to draw a bar by default. An
> object type's start and end time are configured in Ontology Manager's
> **Capabilities** tab."

Also a distinction worth noting: an **event object** is configured on the *object
type* (Capabilities), whereas a **timeline geometry** is configured per-map in the
Layers panel, where "timeline geometries require an object to have at least one
timestamp property depending on the geometry's shape".
The ontology owns the first, the application the second.

## 7 — Navigation and Cleanup

**Search** spans everything: "any object type, property, link type, action type,
shared properties, interfaces, or functions… The search results will **highlight
which field your search term matched on**." List pages "allow for filtering… based
on their **visibility, development status, and indexing issues**."

**Cleanup** is a queue with three verbs:

> **Snooze:** Hide object types from your cleanup queue for a configurable
> amount of time. Snoozing is an action that will affect only the user that
> performs it.

> **Deprecate:** Show object types as deprecated in every context that displays
> object type status.… You can set a deadline along with a deprecation so users
> know how long they have to refrain from using these object types.

> **Delete:** Delete object types from the Ontology and remove associated
> data from object storage.

Its flags are the interesting part, because each is a computable predicate:
**Past deprecation date · Trashed datasource · Datasource not updated in [x]
days · Description missing · Display name regex matches string** (default
`[test|deprecated]`, ECMA syntax) **· Phonograph deindexed**. Flags are
configurable per user, with a priority order.

And: "Deprecation and deletion are **staged the same way as normal Ontology
modifications**… enables saving the changes directly to the Ontology **or
creating a proposal**."

## 8 — The RID specification, from the source

From `github.com/palantir/resource-identifier`:

```
ri.<service>.<instance>.<type>.<locator>
```

| segment | rule |
|---|---|
| **service** | the service or application that namespaces the rest of the identifier — `[a-z][a-z0-9\-]*` |
| **instance** | an **optionally empty** string representing a specific service cluster — `([a-z0-9][a-z0-9\-]*)?` |
| **type** | a service-specific resource type, namespacing a group of locators — `[a-z][a-z0-9\-]*` |
| **locator** | a string that uniquely locates the specific resource — `[a-zA-Z0-9\-\._]+` |

*(Described rather than quoted. These four come from the RID specification at
`github.com/palantir/resource-identifier`, which is not in the mirror and which
the citation gate therefore cannot read. Quoting an unreadable source is how a
citation becomes unverifiable, so the wording here is deliberately mine — the
same call `control-panel-and-banners` made for an unidentifiable screenshot.)*

**A defect this found in code we shipped.** `rid_locator()` (migration 391) is:

```sql
SELECT nullif(split_part(p_rid, '.', 5), '')::uuid
```

**The locator's character class includes `.`** — so a locator containing a dot is
silently truncated to its first segment. Every locator we generate is a uuid, so
nothing is broken today, but the function is wrong against the grammar it claims
to implement. The fix is to take everything after the fourth separator, not the
fifth field.

**Attested RID forms**, harvested across the corpus:

| form | where |
|---|---|
| `ri.ontology.main.ontology.<id>` | `ontology-sdk/add-osdk-to-bootstrapped-repository` |
| `ri.ontology.main.object-type.<uuid>` | Ontology Manager screenshot |
| `ri.ontology.main.type-group.<uuid>` | groups screenshot |
| `ri.compass.main.folder.<id>` | rid-grammar reading |
| `ri.foundry.main.dataset.<id>`, `…transaction.<id>` | 132 + 3 occurrences |
| `ri.mio.main.media-set.<id>`, `…media-item.<id>`, `…view.<id>` | media pages |
| `ri.object-set.main.object-set.<id>`, `…temporary-object-set.<id>` | object-set pages |
| `ri.magritte..source.<id>`, `ri.actions..scenario.<id>` | **empty instance**, as the spec allows |
| `ri.phonograph2-objects.main.object.<id>` | OSDK response envelope |

**Still unattested:** link type, shared property, action type, interface, value
type. The deep dive's action type screenshot showed a bare uuid where a RID was
expected, which is probably truncation in the UI rather than a different form —
not treated as evidence either way.

---

# What this changes in the build map

**Answered and now buildable:**

- **Materializations** — a real phase, gated on `edits_enabled`, schema derived
  from property **API names**, `automatic` vs `periodic` propagation, latest
  snapshot only, and **not creatable or editable on a branch**.
- **Semantic search** — a `vector` property plus nearest-neighbour; pgvector is
  already installed.
- **Interface link constraints** — interfaces constrain links, not only
  properties. New table beside the property constraints.
- **Cleanup** — six computable flags, three verbs, staged like any other change.
- **Type classes** — an open extension point that appears on object types and
  link types; the mechanism legacy groups fell back to.
- **The Ontology's own RID**: `ri.ontology.main.ontology.<id>`.

**A correction to ship:** `rid_locator()` must split after the fourth separator.

**Still open:** the canonical list of Capabilities sections (the tab still has no
page); RID forms for link type, shared property, action type, interface and value
type; and how a branch stores a working change.
