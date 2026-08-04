# What is left to build

The only planning document. Rewritten 2026-08-04 when twenty-nine other docs were
deleted — they had drifted far enough that twelve separate stale claims sent work
in the wrong direction in one week.

**Rules for this file.** It says what is NOT built. The moment something ships,
its entry is deleted rather than annotated — a file that accumulates "✅ SHIPPED"
lines becomes a history, and history is what git is for. Anything describing how
the system works belongs in `CLAUDE.md` or a guard, not here.

---

## Blocked on something outside the code

**Contract reconciliation.** The ΗΛΙΑΚΤΙΔΑ supply contract is ingested and
chunked. The invoice we have is a **blank template** — its "From:" block is empty
field labels and its lines are `Είδος 1` / `Είδος 2`, so there is no supplier and
no line item to reconcile against.

Needs one filled-in invoice from a supplier the system stocks, for variants it
carries. Everything downstream — match lines to contract terms, flag price and
quantity variance, cite the clause — is ordinary work once that exists.
`detectBlankTemplate` now flags this case at ingest so it cannot be mistaken for
data again.

---

## Half-wired — the database does more than the UI offers

**Status on link types and interfaces.** `link_types` and `ontology_interfaces`
carry `status`, `visibility`, the deprecation record, the delete and rename
guards and the cascade. Only object types have a UI for any of it.

---

## Property base types — the gap the media question exposed

Our `PropertyType` is four values: `text | number | boolean | date`. Foundry's
base types include those plus **Vector, Geopoint, Geoshape, Attachment, Time
series, Geotemporal series, Media reference, Cipher text and Struct**
(`mirror/object-link-types/base-types.md`).

Two of those are load-bearing for work already half-built here:

**Media reference.** *"A media reference property type allows you to have media on
your objects... points to a specific media item within a media set. The media
reference contains information about the media file, which means Foundry can
display the media wherever the media reference is used."* `documents` carries
`storage_path` and `bucket_name` as plain text — a media reference in everything
but type, which is why nothing can render a source document beside a chunk.

It is also where document processing *belongs*: `mirror/media-sets-advanced-formats/media-in-ontology.md`
says OCR, text extraction, audio transcription and metadata reads are
**operations on the media reference**, performed in functions on objects. Ours
live inside one `document-ingest` edge function instead.

**Vector**, *"for storing vectors on objects for use in a semantic search"* — our
chunk embeddings sit in a column the ontology does not know about.

Neither is queued. Both are recorded because the ontology-augmented-generation
chain (chunk object → media reference property → semantic search → PDF viewer)
needs the property types before the widget is worth building.

## Parity gaps, found and not yet argued

**AIP Analyst** — *"an interface for agentic workflows that lets you use natural
language to perform ad-hoc analyses across your Ontology... the agent will answer
by autonomously searching your Ontology, creating object sets, and transforming
data before generating summaries and visualizations"*
(`mirror/aip-analyst/overview.md`).

Our copilot answers questions with tools; it does not autonomously build object
sets and return visualizations. `selectObjectSet`, `searchAround` and the Chart XY
widget exist, so the pieces are there. Not queued — recorded so it is not
rediscovered.

**Shared property metadata beyond the basics.** `shared_properties` carries name,
description, base type and visibility. Foundry also has value formatting, type
classes and render hints (`mirror/object-link-types/create-shared-property.md`).
None has a consumer here yet.

**Property-level status.** Foundry gives every property its own status with bulk
edit. Ours are jsonb on the object type and carry the type's status. Blocked on
properties becoming rows, which is a large migration touching every reader of
`object_types.properties` and needs its own argument.

---

## Compass, demand-gated

The filesystem layer, from `mirror/compass/`. Projects and roles are built. These
are not, and none has been asked for:

- **Tags** (`compass/tags.md`) — cheap once wanted, meaningless before.
- **Folders** — nesting inside a project. Their role-grant capability is disabled
  by default on Foundry's own recommendation, so a folder here would be
  containment with no permission consequence.
- **Data catalog** (`compass/data-catalog.md`) — overlaps the Ontology page's
  vocabulary section. Audit before building.

---

## Workshop widgets

Eleven of Foundry's ~40 are built. The rest are demand-gated individually — each
is one entry in `builder/specs.ts` plus a renderer branch, and a widget nobody
asked for is the dead vocabulary the guards keep removing.
