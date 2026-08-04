# Deliverable map

Where the work goes next, in dependency order, with what each track actually
needs rather than what its spec said when it was written.

Built 2026-08-04, after the Compass mirror settled a question we had answered
wrong. Every claim here was checked against the code or the database, not
against another doc — three of the open specs turned out to be stale, and those
corrections are noted inline.

`docs/README.md` indexes the docs. This orders the *work*.

---

## 0. The correction owed first

**`promoted` is modelled as an ontology status. It is a Compass one.**

Compass is Foundry's filesystem, and `compass/resource-status` is unambiguous:

> "Resource status allows you to indicate the importance of resources in the
> platform... **Currently, the only available status is Promoted.**"

So on the platform axis promotion is *binary* — promoted, or no status — and it
applies to any resource: projects, folders, files, datasets. Its three effects
are all about **discovery**:

> "**Search visibility:** Promoted resources are boosted in search results
> across the platform... **Visual indicator:** marked with a checkmark icon...
> **Quick filters:** appear in the **Promoted items** quick filter... providing a
> curated catalog of the most useful projects, folders, and files."

And it is gated twice: "you must have the **Editor** role or higher on that
resource, **and** you must be granted the **Resource Curator** role at the
**space** level."

The ontology page then surfaces that same idea for object types — same purple
checkmark, "prominence beyond the standard `active` status", visibility forced
to `prominent`, Ontology Owner to apply it or "submit a proposal for review".

**What we shipped in migration 321** has the enum value and none of the effect.
`object_types.visibility` is read by nothing — no search boost, because there is
no search; no curated catalog; no curator role; no proposal path. It is dead
vocabulary, the exact class this codebase keeps deleting.

**And our own guard passed it.** `check:vocabulary` counts a string literal in
any `.ts` file as consumption, so writing `ONTOLOGY_VISIBILITIES` into
`ontology/status.ts` laundered all eight new values into "consumed" without
anything acting on them. A vocabulary module can defeat the vocabulary guard.
That is a hole worth closing before it is used again by accident.
*(Closed — R1. Declaration files and test files no longer count as consumers.)*

**Half of this is now fixed.** A1 shipped the search that ranks on `visibility`
and excludes `deprecated` and `hidden`, so the column is load-bearing rather
than decorative. What remains is the modelling: `promoted` is still an ontology
enum member when it is a platform resource status. That is A2.

### What this costs to correct

| | |
|---|---|
| Keep | The four-value ontology status (`active`/`experimental`/`deprecated`/`example`), the deprecation record, the delete + rename guards, the link cascade, C29. All of that is `metadata-statuses` and all of it is load-bearing. |
| Move | `promoted` + `visibility` — out of the ontology enum and onto a resource-status axis that any artifact can carry. |
| Add | The discovery surface that makes it mean something (track A). |
| Fix | `check:vocabulary`, so a constants file is not accepted as a consumer. |

**Do not move `promoted` until track A1 exists.** Relocating it into another
table with no reader trades one dead column for another. The right order is:
build the thing promotion affects, then promote into it.

---

## 1. How the tracks depend on each other

```
                    ┌─────────────────────────────────┐
                    │ A. Resource layer (Compass)     │
                    │    the gap the mirror exposed   │
                    └────────────┬────────────────────┘
                                 │ A1 search ─┬─→ A2 promotion (0's home)
                                 │            └─→ A3 tags
                                 │ A4 projects ──→ B4 resource-level roles
                                 ▼
   ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
   │ B. Ontology  │   │ C. Operate       │   │ D. Ingestion     │
   │    parity    │   │    inline (P1+)  │   │    (doc stages)  │
   └──────┬───────┘   └────────┬─────────┘   └────────┬─────────┘
          │                    │                      │
          │ B1 shared props    │ P1 row badge         │ T1 stages past ocr
          │ B2 property status │ P2 spread            │ T2 Chunk/Entity types
          │ B3 interfaces++    │ P3 inline act        │ T3 surface + prove
          │                    │                      │
          └────────────────────┴──────────┬───────────┘
                                          ▼
                              ┌───────────────────────┐
                              │ E. Contract arc       │
                              │   blocked on real doc │
                              └───────────────────────┘
```

Reading it: **A is the only track that unblocks others.** B, C and D are
independent of each other and can go in any order. E waits on an input we do not
control.

---

## 2. Track A — the resource layer

The Compass section was never mirrored until today, which is how the `promoted`
misreading survived. Ten pages now sit in `mirror/compass/`. What they describe
is a layer we do not have at all: a filesystem over resources, with search,
tags, curation and per-resource permissions.

This is not a small track and not all of it is wanted. Ranked by whether
anything today is worse for its absence:

### A1 — Quicksearch ✅ SHIPPED (migrations 325/326)

**This entry was wrong when written.** It claimed there was no cross-artifact
search. There was: a ⌘K palette (`CommandBar`) searching nav entries, products,
variants and suppliers. I grepped for `quicksearch|CommandPalette|globalSearch|
omnibox` and it is called `CommandBar`. **Ninth for nine** on "already built,
the audit found the gap" — and the first time the map itself was the thing that
needed auditing.

The real gap was narrower and sharper: the palette searched **operational data
but not the ontology**. An operator could find "tomatoes" and could not find the
object type they authored, the Workshop app someone built, or a document.

Shipped as `quicksearch(query, limit)` — titles only, per jump-to mode — over
object types, records, applications and documents, with Foundry's ranking rule:

> "prioritized by `Active` object types with `Prominent`, then `Normal`, and then
> `Experimental` status (deprecated and hidden object types are not searched on)"

**Which is what gave `visibility` a consumer**, and closes the dead-column half
of §0 without A2: a hidden type is unfindable, and so are its records; a
deprecated one drops out of search, which is most of what deprecating something
is supposed to accomplish. `SECURITY INVOKER`, so "Quicksearch respects all
existing permissions" is RLS rather than a second permission model.

Still open from §0: `promoted` remains an ontology enum member rather than a
resource-status axis. That is A2.

### A2 — Resource status, properly

Once A1 exists: one `resource_status` row per artifact — `(resource_kind,
resource_id, status)` with `promoted` as the only value, per "currently the only
available status is Promoted". Effects: boost in A1's ranking, a checkmark in
its results, and a "Promoted" filter.

Then `object_types.visibility` and the `promoted` enum member retire into it,
and the ontology page reads promotion rather than owning it — which is how
Foundry has it.

**`app_promotions` (migration 309) is the precedent to reconcile with.** It
promotes modules into portal collections, which is Foundry's *curating apps*,
a different mechanism for a neighbouring idea. Decide deliberately whether
resource status subsumes it or sits beside it; do not let two promotion
concepts grow independently.

### A3 — Tags

`compass/tags`. Cheap once A1 exists, meaningless before. Demand-gated.

### A4 — Projects and folders

`compass/create-a-project`, `move-and-share-resources`. A real filesystem with
containment and inherited permissions. **The biggest item in this map**, and the
prerequisite for B4. Not worth starting on Foundry-fidelity grounds alone — start
it when someone cannot find their work, or when per-resource permissions are
genuinely needed.

### A5 — Data catalog

`compass/data-catalog`. Overlaps heavily with the Ontology page's vocabulary
section. Likely already served; audit before building.

---

## 3. Track B — ontology parity

From `ONTOLOGY-PARITY-GAPS.md`, **with two corrections** — that file lists as
open two gaps that are closed:

- *Gap 2 (interfaces)* — closed, #414, and the file says so.
- *Gap 4 (`nodeSet` is dead code)* — **closed and unrecorded.** `nodeSet` was
  deleted in #418 and re-derived as `selectObjectSet` + `searchAround` in
  `packages/reality-graph/src/objectSets/` once four consumers existed.
- *Gap 5* — closed, #416/#417, and the file says so.

Remaining, in order:

### B1 — Shared properties

Gap 3. Every object type redefines `room`, `cost`, `reported_on` independently
(`object-link-types/create-shared-property.md`). Centralised property metadata
with a consistency guarantee. **The highest-value ontology item left**, because
it is the one that stops drift rather than describing it.

### B2 — Property-level status

Recorded as a divergence today: properties are jsonb on their object type, so
they carry the type's status rather than one each. Foundry gives each property
its own, with bulk edit. **Blocked on properties becoming rows**, which is B1's
natural byproduct — do them together or not at all.

### B3 — Interfaces, continued

Interfaces exist (migration 224) and tools target them (225). Foundry's
`actions-on-interfaces` and interface-typed link ends are not covered. Audit
consumption first; the pattern here has been that more exists than expected.

### B4 — Resource-level roles

Gap 6. Foundry grants ontology roles "on the Ontology level or the individual
resource level"; ours are org + hotel + tier, so any admin writes every object
type. This is also where Compass's **Resource Curator** role lands. **Depends on
A4** for a resource tree to grant against.

---

## 4. Track C — Operate inline

`AIP-OPERATE-INLINE.md`. P0 (the per-item signal spine) shipped in #346,
migration 199. **P1 — the row badge on the flagship list, plus the slide-over —
is next and unblocked.** P2 is mechanical once P1 sets the pattern; P3 closes
the loop with the inline act path.

This is the track with the most operator-visible payoff per unit of work,
because the intelligence already exists and is simply not surfaced where people
work.

---

## 5. Track D — document ingestion

`DOCUMENT-INGESTION-ROADMAP.md`. Ingestion stops at `ocr`; the later stages are
unbuilt. Track 1 (Foundry-exact ingest correctness) is the non-negotiable first
step, Track 2 decides the `Chunk`/`Entity` node-type forks, Track 3 surfaces it.

Note the coupling: **track E needs this**, and E is the one with a real business
input waiting.

---

## 6. Track E — contract reconciliation

`CONTRACT-MODEL.md`. The contract shape is tested against a real Greek supply
agreement; the reconciliation half needs a real invoice or PO. **Blocked on an
input from outside the codebase**, so it is scheduled rather than sequenced.

---

## 7. Standing repairs

Small, independent, each fixing something that lets a defect through.

| | what | why now |
|---|---|---|
| **R1** | `check:vocabulary` must not accept a constants file as a consumer | It passed eight dead values today. Require a *behavioural* consumer — a comparison, a query, a branch — not a literal in an array. |
| **R2** | `docs/README.md` says prediction coherence is "Q1 onward" | Q1–Q4 shipped. Only Q5 (prove it, close the loop visibly) remains. |
| **R3** | `ONTOLOGY-PARITY-GAPS.md` gap 4 | Closed by #418 + the objectSets re-derivation; the file still lists it open. |
| **R4** | Built-in object types cannot take a status | The UPDATE policy is `kind = 'authored'`. Consistent today because Studio does not list built-ins — but if promotion is to mean anything for the 40 built-in registrations, this policy widens first. |

---

## 8. Recommended order

1. ~~**R1**~~ ✅ — declaration and test files no longer launder a vocabulary.
2. ~~**C/P1–P2**~~ ✅ — the badge was already on six surfaces; Timeline and
   Receive closed the set.
3. ~~**A1**~~ ✅ — quicksearch, migrations 325/326. `visibility` now decides
   findability.
4. **A2** — move `promoted` onto the resource axis. Closes the rest of §0. ← next
5. **B1 + B2** — shared properties, with property status falling out of it.
6. **D** — ingestion stages, which also unblocks **E** for when the contract lands.
7. **A4/B4** — the filesystem and resource-level roles, when someone needs them.

Then, by explicit instruction, the three items under *"What is deliberately not
here"* — Workshop G2–G4, the visual logic canvas editor, and user-authored
action types. The last one **contradicts `CLAUDE.md`**, which keeps
`BeaconAction` typed in code so every write carries a compile-time guarantee,
submission criteria and an audit entry. That spec has to change in the same
commit, and the audit entry and submission criteria have to survive the change.

R2 and R3 are one-line doc edits; fold them into whatever lands next.

---

## What is deliberately not here

- **Workshop G2–G4** — the remaining widgets are demand-gated by policy, one
  registry entry each. `DIVERGENCES.md` records the argument.
- **Visual logic canvas editor** — `STUDIO-AUTHORING-PLAN.md` chose NL-native
  authoring; the viewer shipped, the editor was declined.
- **User-authored action types** — a deliberate divergence, argued in
  `CLAUDE.md`: `BeaconAction` stays typed in code so every write keeps its
  compile-time guarantee and its audit entry.
