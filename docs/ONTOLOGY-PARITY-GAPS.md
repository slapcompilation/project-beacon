# Ontology parity — where Beacon diverges from Foundry's core concepts

Cross-check of our ontology against `docs/foundry-reference/mirror/ontology/core-concepts.md`
and `why-ontology.md`, done 2026-07-27 after the Studio authoring arc (P1–P5) landed.

Every claim below was verified against the running system, not inferred.

---

## Where we conform

| Foundry concept | Beacon | Notes |
|---|---|---|
| Object type | `object_types` (P2) | authored, versioned, snapshot history |
| Property | `PropertyDef` | typed + validated, computed properties on top |
| Link type | `link_types` (P2.3) | authored, drawn on the System Map canvas |
| Action type | `BeaconAction` registry | submission criteria, side effects, immutable audit |
| Object Views | full page + panel (P3) | configurable; unplaced keys sweep to Details |
| Functions | Logic Tools + authored tools (P4) | partial — see gap 5 |
| Roles | org/hotel/role RLS + purpose & marking gates | partial — see gap 6 |

On `why-ontology.md`'s four pillars we are strongest exactly where most systems are weakest:
**decision data and decision lineage**. Proposals, run traces, Cases, Principles,
`influenced_by` edges and immutable StockLogs mean "which decision, on what evidence,
by whom, and what happened next" is answerable.

---

## Gap 1 — we have two ontologies; Foundry has one

**The deepest divergence.** Verified live:

```
select api_name from object_types;  →  maintenance_request, room     (2 rows)
```

The 33 built-in node types (Variant, Supplier, PurchaseOrder, Hotel, StockLog…) exist
only as a TypeScript union in `packages/reality-graph/src/types.ts`. They are not in
`object_types`. Consequences are structural:

- `link_types` FKs **both** sides to `object_types` → a Maintenance Request can never
  link to a Variant.
- `user_tools.subject_type_id` FKs to `object_types` → an authored tool can never ask
  about Variants, Suppliers or POs. The real operational domain is invisible to the
  tools operators author.
- The ontology canvas draws only the authored half, so the map understates the system.

Foundry: *"the Ontology is the digital twin of an organization, integrating the
organization's digital assets (datasets and models) into a coherent whole."* Ours is
coherent in two halves that cannot reference each other.

**Fix:** register built-in types as rows in `object_types` (code stays the source of
truth for their schema; the row is a registration). Then links, tools and the canvas
reach the whole ontology.

## Gap 2 — no interfaces — CLOSED (#414, migration 224; tools target them, migration 225)

`interfaces/interface-overview.md` names precisely what we lose:

> if new object types that implement the `Facility` interface are introduced, the
> workflow will be immediately compatible with the new object types without additional
> refactors.

Our authored tools and agents bind to **one** `subject_type_id`. Author a second similar
type and every tool and agent must be re-authored. Interfaces are the abstraction that
makes P4/P5 scale rather than multiply.

**Shipped.** `ontology_interfaces` + a conformance trigger (a type may claim an interface
only if it actually has the shape), then `user_tools.subject_interface_id`: a tool targets
one type *or* one interface, and an interface tool runs across every implementer. Two
rules carry the weight:

- **Interface properties only.** A tool over an interface may filter and aggregate on the
  shared shape and nothing else. Using a property one implementer happens to have is
  precisely what breaks on the next one.
- **Records are pooled before aggregating**, so `avg` across an interface is the real mean
  of all matching records, not the mean of each type's mean.

Still bound to one type: **authored agents** (`user_agents.subject_type_id`). Same change,
not yet made.

## Gap 3 — no shared properties

Every object type redefines `room`, `cost`, `reported_on` independently. No centralized
property metadata, no consistency guarantee across types
(`object-link-types/create-shared-property.md`).

## Gap 4 — object sets exist but are dead code

`packages/reality-graph/src/queries/nodeSet.ts` is built, exported, and explicitly
modelled on osdk's `ObjectSet` — with **zero consumers**. `runNodeSet` is imported
nowhere. It also does not cover `object_records`.

In Foundry the object set is the currency functions, actions and aggregations pass
around. Ours is an unused primitive while `evaluateUserTool` does its own ad-hoc
filtering — the same drift class as the Forecast Lab bug (#403).

**Either consume it or delete it.** A dormant abstraction is worse than none.

## Gap 5 — authored tools and authored agents do not compose

`buildAuthoredAgentTools` contains **zero** authored tools. An authored *agent* cannot
call an authored *tool*; the copilot can (#408) but agents cannot. Foundry functions are
usable *"across action types and applications."*

Related: Foundry functions take **input parameters**. Our authored tools have fixed
filters, so "count urgent requests" cannot generalise to "count requests where
urgency = X".

## Gap 6 — permissions are scope-shaped, not resource-shaped

Foundry grants Ontology roles *"on the Ontology level or the individual resource level"*.
Ours is organization + hotel + role tier. There is no per-object-type or per-action-type
grant: any org member reads every object type, any admin writes every one.

---

## Deliberate divergences — not gaps

Separated so this doesn't read as a checklist to close blindly:

- **User-authored action types.** Foundry lets users create action types in Ontology
  Manager. CLAUDE.md deliberately keeps `BeaconAction` typed in code so every write has
  compile-time guarantees, submission criteria and an audit entry.
- **Visual no-code authoring.** `docs/STUDIO-AUTHORING-PLAN.md` chooses NL-native
  authoring over a drag-and-drop canvas.

These are strategy. Gaps 1–6 are absences.

---

## Fix order

1. ~~**Unify the ontology** (gap 1)~~ — done, #413 / migration 223.
2. ~~**Interfaces** (gap 2)~~ — done, #414 / migration 224; authored **tools** target them
   (migration 225). Authored **agents** still bind to one type.
3. **Wire authored tools into agent toolsets** (gap 5) — small, closes a hole we made.
4. **Consume or delete `nodeSet`** (gap 4).
5. Shared properties (gap 3), resource-level roles (gap 6) — lower urgency.
