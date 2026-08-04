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

## Property base types — partly closed

`media_reference` and `vector` shipped (migration 339) with Foundry's title-key
rule: neither may title a record. The remaining seven — Geopoint, Geoshape,
Attachment, Time series, Geotemporal series, Cipher text, Struct — have no
consumer here. Geopoint is the likeliest next, since hotels already carry
coordinates in `hotels.config` jsonb.

**The OAG chain** is chunk object → media reference property → semantic search →
PDF viewer. The first three are done: `document.storage_path` is registered as a
media reference and `chunk.embedding` as a vector (migration 340), so the
ontology now knows a document has a file and a chunk has an embedding.

**The chain is complete** (migration 341): the `source_viewer` widget renders the
source beside the thing citing it — *"source-of-truth cross-validation for the
users"*. It shows extracted text rather than PDF pixels, and the divergence says
so.

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
