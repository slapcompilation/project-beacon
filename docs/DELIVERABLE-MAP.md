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

**CLOSED — A1 and A2.** A1 shipped the search that ranks on `visibility` and
excludes `deprecated` and `hidden`; A2 moved `promoted` onto `resource_status`,
where it is a separate binary axis rather than a fifth developmental state. The
enum no longer accepts it, and all three Compass effects are live. The rest of
this section stands as the record of how it went wrong.

### What this costs to correct

| | |
|---|---|
| Keep | The four-value ontology status (`active`/`experimental`/`deprecated`/`example`), the deprecation record, the delete + rename guards, the link cascade, C29. All of that is `metadata-statuses` and all of it is load-bearing. |
| Move | ✅ `promoted` out of the ontology enum, onto `resource_status`. `visibility` stayed on the object type — it is ontology metadata in Foundry too, and quicksearch ranks on it. |
| Add | ✅ The discovery surface that makes it mean something (A1). |
| Fix | ✅ `check:vocabulary`, so a constants file is not accepted as a consumer. |

**The order mattered.** Moving `promoted` before A1 existed would have traded one
dead column for another — a promotion that boosts nothing. Build the thing
promotion affects, then promote into it.

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

### A2 — Resource status ✅ SHIPPED (migrations 327/328)

`resource_status (resource_kind, resource_id, status)`, `promoted` its only
value, per "currently the only available status is Promoted". Absence is the
default state, so un-promoting **deletes the row** rather than storing a `none`.

The enum no longer accepts `promoted`, and that was the substance of the fix: as
a fifth status it was exclusive with `active`, so promoting a type meant giving
up saying it was in use. The two axes now compose.

All three effects are live and were verified against real data — promoting the
`Supplier` type moved it from rank 10 to −5, above its unpromoted peer, marked
it, and put it in the empty-query catalog. The bridge is theirs too: promoting
sets `visibility` to `prominent`, and un-promoting returns it to `normal`.

**`app_promotions` (migration 309) is the precedent to reconcile with.** It
promotes modules into portal collections, which is Foundry's *curating apps*,
a different mechanism for a neighbouring idea. Decide deliberately whether
resource status subsumes it or sits beside it; do not let two promotion
concepts grow independently.

### A3 — Tags

`compass/tags`. Cheap once A1 exists, meaningless before. Demand-gated.

### A4 — Projects ✅ SHIPPED (migration 330), folders deliberately not

`projects` is the security boundary and the container: a resource belongs to at
most one, per *"work and its output live in the same Project"*. That is the half
B4 needed.

**Folders are not built**, and that is a choice rather than an omission. Their
job in Foundry is nesting inside a project, and their role-grant capability is
*disabled by default* on Foundry's own recommendation — so a folder here would be
containment with no permission consequence, for a resource count that fits on one
screen. Add them when a project outgrows a flat list.

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

### B1 — Shared properties ✅ SHIPPED (migration 329)

`shared_properties`, one definition reused across object types. Metadata is
shared, data is not — "while property metadata is shared across object types, the
underlying object data is not". A property's **api name never changes** when
attached, because downstream workflows are bound to it, and inherited fields go
read-only, which is the entire point: an editable copy is the drift.

**The gap was real; the drift it predicted was not.** Measured first: 84
duplicated property definitions, and every one agrees on type and label. They all
sit on built-in registrations, which `ontology_drift.sql` already holds to their
backing tables — so the guard exists for the half that cannot drift, and authored
types are the half with no guarantee. Landed ahead of its consumer under the
stage directive's rule for Foundry's shapes, cited.

### B2 — Property-level status — NOT unblocked by B1, contrary to this map

This entry claimed properties becoming rows was "B1's natural byproduct". It is
not. `shared_properties` is its own table; object-type properties stay jsonb, and
a shared property is a *reference* from inside that jsonb. Nothing about B1 moved
properties into rows.

So per-property status stays blocked on the same thing it was blocked on, and the
divergence in `DIVERGENCES.md` stands: properties carry their object type's
status. Making them rows is a large migration touching every reader of
`object_types.properties`, and it needs its own argument rather than being
smuggled in as a byproduct.

### B3 — Interfaces, continued

Interfaces exist (migration 224) and tools target them (225). Foundry's
`actions-on-interfaces` and interface-typed link ends are not covered. Audit
consumption first; the pattern here has been that more exists than expected.

### B4 — Resource-level roles ✅ SHIPPED (migration 330)

Four roles — owner, editor, viewer, discoverer — granted **on the project**, not
the resource, which is Foundry's own recommendation and much simpler. A role may
only assign the same or a lesser role, enforced in a trigger.

Additive by construction: the existing admin/owner terms are untouched, so the
change can only widen. An admin can now delegate Editor on a project to a
non-admin. Contract C30 proves both halves — it inherits inside the org, and it
is worth nothing outside it.

**Resource Curator** is the next role to define here, and it is what
`DIVERGENCES.md` points at for Compass promotion.

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

## 5. Track D — document ingestion ✅ Tracks 1–2 SHIPPED and RUN

**This entry was wrong too.** It said ingestion stops at `ocr`. Measured: two
real documents — the Greek ΗΛΙΑΚΤΙΔΑ supply contract and invoice INV11122 — both
at `contextualized`, 37 chunks with full text and embeddings, 37 `cited_in`
edges, 87 entities, 76 `mentions` edges. **Tenth for ten.**

The real run exposed one defect and cleared two false alarms:

- **Fixed:** extraction produced `supplier`, `food product`, `Item 1` as
  entities. An Entity's name is its primary key, so those become high-degree
  nodes meaning nothing. Prompt tightened *and* `checkEntityName` refuses them
  deterministically. Verified against the 87 real names: 7 junk rejected, 0 false
  positives.
- **Not a bug:** stage 9 resolving nothing is correct — the contract is with a
  supplier we do not stock, against a hotel-bar inventory. Declining to invent a
  link is the behaviour we want.
- **Not a bug:** 21 orphaned entities are re-ingest residue that
  `ontology_drift.sql` already reports and `reap_ontology_orphans()` already
  removes, deliberately as an explicit decision.

Remaining: Track 3 — the document copilot (P9) and the Search-Around graph (P10).

**Track E is unblocked.** The contract *and* an invoice are both ingested.

---

## 6. Track E — contract reconciliation — STILL BLOCKED

**I said this was unblocked one commit ago. It is not, and the correction
matters because it changes what to build.** INV11122 is a **blank template**:

```
Από:                          Περιγραφή | Ποσότητα | Τιμή μονάδας | Ποσό
Όνομα                         Είδος 1   | 1        | €200.00      | €200.00
Επωνυμία                      Είδος 2   | 2        | €500.00      | €1,000.00
Διεύθυνση
Πόλη
```

"From:" is five empty field labels. The lines are *Item 1* and *Item 2* — which
is where four of the junk entities in track D came from. There is **no supplier
name and no real line item**, so the resolution path this doc already specifies —
*supplier name on the invoice → supplier entity → the agreement in force* — has
nothing to resolve.

The other half is blocked on the same class of gap: `supplier_contracts = 0`, and
that table is **per-variant** (`variant_id NOT NULL`, a contracted price per
variant). Typing the ΗΛΙΑΚΤΙΔΑ contract needs ΗΛΙΑΚΤΙΔΑ to be one of Valinor's
suppliers and its bakery goods to be variants Valinor stocks. Neither is true —
Valinor is a hotel bar.

`CONTRACT-MODEL.md` reached this conclusion twice already, for quotes: *"the
shape is legible, the data is not there."* This is the third time, which is why
it became a check rather than a note — see below.

### What would unblock it

One invoice that is **filled in**, from a supplier the system stocks, for
variants it carries. Specifically it must carry: a supplier name in the From
block, line descriptions that name real products, and quantities and unit prices
that are not specimen values. Everything downstream is then ordinary work.

### What shipped instead

`detectBlankTemplate` — ingestion now says so when a document is an unfilled
form. INV11122 passed every stage gate, because gates ask "did this stage produce
output" and forms produce output fine. It cost an LLM pass, five junk entities,
and a reconciliation cycle that could not be verified. A signal rather than a
gate: storing a template is legitimate, looking like evidence is not.

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
4. ~~**A2**~~ ✅ — `resource_status`, migrations 327/328. Promotion is its own
   axis, with the search boost, the checkmark and the catalog.
5. ~~**B1**~~ ✅ — shared properties, migration 329. **B2 did not fall out of it**
   and is still blocked on properties becoming rows — see §3.
6. ~~**D**~~ ✅ Tracks 1–2 — already run on real documents; the fix was extraction
   quality. Track 3 (doc copilot, graph) remains.
7. **E** — contract reconciliation. **Still blocked**: the sample invoice is a
   blank form. Needs one filled-in invoice from a stocked supplier. Ingestion now
   detects the blank-form case rather than treating it as evidence.
8. ~~**A4/B4**~~ ✅ — projects as the security boundary, roles granted on them.
   Folders deliberately skipped.

**The map is now clear.** What remains is the three tracks recorded below as
deliberately-not-here, which the operator has since asked for. ← next

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
