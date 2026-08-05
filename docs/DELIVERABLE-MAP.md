# What is left to build

The only planning document. Rewritten 2026-08-04 when twenty-nine other docs were
deleted — they had drifted far enough that twelve separate stale claims sent work
in the wrong direction in one week.

**Rules for this file.** It says what is NOT built. The moment something ships,
its entry is deleted rather than annotated — a file that accumulates "✅ SHIPPED"
lines becomes a history, and history is what git is for. Anything describing how
the system works belongs in `CLAUDE.md` or a guard, not here.

---

## The teardown — in progress, and the current priority

**Decided 2026-08-05.** The end goal is a **Foundry clone built from Palantir's
public documentation**. Everything not in that documentation is deleted, whatever
its row count and whether or not it works today. Packaging the hospitality
ontology for reinstallation is the documented path
(`mirror/object-link-types/marketplace-ontology-types.md`) and is deliberately
**not** taken yet: it belongs after the framework works end to end and there is a
proven install workflow. Until then a packaged copy would be an unverified
artifact pretending to be a migration path.

Two standing rules for the work, both requested explicitly:

- **Every ontology change cites its page**, inline, e.g. *"the property that acts
  as a display name for objects of this type"* — `create-object-type.md`. It
  exists so a plausible shape cannot become structure.
- **Never hardcode.** The live example is `rebuild_relationship_edges_view()`,
  which excludes `sourced_from` from its link_types loop and appends a
  hand-written `SELECT` over `product_variants JOIN products`.

Done through migration 357: the ontology is empty — 43 object types, 37 link
types, 2 cohorts, 5 tools and 13 records removed — and so is everything built on
it. The five Workshop applications went in 357 with the six e2e specs that drove
them; `module-builder.spec.ts` stays, because it builds an application in the UI
and passes against an empty ontology. The framework is untouched and asserted:
tables, grammar, drift and status guards, projection, 30 RLS contracts.

**1. Empty the `EdgeType` union.** 28 files, 175 references, 3 test files. Start
at `packages/types/src/index.ts`; the exhaustive `Record`s (`EDGE_TYPES`,
`EDGE_LABELS`, the GraphConnections colour map) then fail one at a time until
every consumer is found. **Delete the surfaces rather than repairing them** —
`useHotelEdges`, `FlowGraph`, `GraphConnections` and `edgesForAction`'s
provenance writes are domain UI over a domain vocabulary and none survives.

This clears **both currently-red guards at once**, since they share a root: the
ontology is empty while the vocabulary and domain tables remain.
- `db:contracts` — `approved_by` and `rejected_by` exist as columns and edge
  types with nothing backing them.
- `check:shape` — domain tables like `variant_cost_history` the ontology no
  longer reaches.

Both are left red on purpose. A guard edited to pass is worth nothing.

One caution learned the hard way in 356: `check:vocabulary` builds its corpus
from git, not from a directory walk, because the edge bundle is a generated copy
of `packages/` that lands inside a scanned root and silently defeats every
`@vocabulary-declaration` marker in it. If this guard ever disagrees between a
laptop and CI, suspect generated files in the corpus before suspecting the
database.

**2. De-hardcode `sourced_from`** so `relationship_edges` is genuinely derived
from `link_types`, as migration 260 claimed it already was.

**3. The 158 domain RPCs and ~40 hand-written computed functions** in
`reality-graph/src/nodes` — the largest remaining hospitality mass. Replace with
ontology reads, then delete in the same change: `check:rpcs` and `check:shape`
report an orphaned caller immediately, and delete-first turns both red at once
and removes the instrument that proves the cleanup correct.

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

Three of Foundry's advanced types have a consumer here and shipped with it:
`media_reference` and `vector` (339, 340), `geopoint` (342). The remaining six —
Geoshape, Attachment, Time series, Geotemporal series, Cipher text, Struct — have
none. Adding one before something stores it produces the dead vocabulary the
guards exist to delete, so each waits for its consumer.

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
