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

Authored **agents** need no equivalent change: `user_agents` has no subject column at all —
an agent reaches the ontology through its toolset. Giving agents authored tools (below) is
therefore what makes agents interface-aware.

## Gap 3 — no shared properties — CLOSED (#, migration 329)

Every object type redefines `room`, `cost`, `reported_on` independently. No centralized
property metadata, no consistency guarantee across types
(`object-link-types/create-shared-property.md`).

**The gap was real; the drift it predicted was not.** Measured before building:
`created_at` is defined on **30** object types, `notes` on 13, `status` on 11,
`name` on 9 — 84 duplicated definitions in all. Every one agrees on base type
*and* label. `distinct_types = 1` across the board.

The reason is that all 84 sit on **built-in** registrations, which are code-owned
and already held to their backing tables by `ontology_drift.sql`. So the guard
that would have caught drift exists — for the half of the ontology that cannot
drift. Authored types are the half with no guarantee, and they are where shared
properties apply.

**Which means this landed ahead of its consumer, deliberately.** The stage
directive allows exactly that: *"Shape that mirrors Foundry may land ahead of its
consumer... ours needs a consumer today. Theirs needs a citation."* This is
theirs, cited. Seeding the built-ins to use it would have been the wrong move —
it would fight the drift test that already governs them.

## Gap 4 — object sets exist but are dead code — CLOSED (#418, then re-derived)

`packages/reality-graph/src/queries/nodeSet.ts` is built, exported, and explicitly
modelled on osdk's `ObjectSet` — with **zero consumers**. `runNodeSet` is imported
nowhere. It also does not cover `object_records`.

In Foundry the object set is the currency functions, actions and aggregations pass
around. Ours is an unused primitive while `evaluateUserTool` does its own ad-hoc
filtering — the same drift class as the Forecast Lab bug (#403).

**Either consume it or delete it.** A dormant abstraction is worse than none.

**Resolved the hard way, and the right way.** `nodeSet` was deleted in #418 —
it had no Foundry counterpart *and* no consumer. It came back as
`selectObjectSet` + `searchAround` in `packages/reality-graph/src/objectSets/`
once four consumers existed to shape it. The deletion is the precedent, not the
re-derivation.

## Gap 5 — authored tools and authored agents do not compose — CLOSED (#416, #417)

`buildAuthoredAgentTools` contained **zero** authored tools. An authored *agent* could not
call an authored *tool*; the copilot could (#408) but agents could not — while
`RunAuthoredAgentArgs` documented its registry as "code tools and authored ones alike".
Foundry functions are usable *"across action types and applications."*

**Shipped.** `authoredToolAsLogicTool` wraps a `UserToolDef` as a real `LogicTool` — same
`value` + `basis` + `confidence` contract, so a caller cannot tell it wasn't shipped in
code. `buildAuthoredAgentTools(reader, authored)` merges them, and **a shipped tool always
wins a name collision**: an org must not be able to redefine what `forecast_consumption`
means to an agent by authoring one. The collision is also rejected at authoring time, so
it surfaces instead of silently losing.

Because authored tools target interfaces (#415), an agent calling one asks about a *shape*,
not a table — that is how agents became interface-aware without a subject column.

**Input parameters shipped too (#417, migration 226).** A filter may take its comparison
value from a named parameter supplied at call time, so one tool answers a family of
questions instead of one. The parameter list *is* the tool's typed input schema — what the
LLM sees, and what the agent runtime validates a call against before it runs.

Two rules: a **missing required argument is an error, never the authored fallback** (a
wrong answer that looks right is worse than no answer), and a **parameter no filter reads
is rejected** — it would make the caller supply something that changes nothing.

## Gap 6 — permissions are scope-shaped, not resource-shaped — CLOSED (migration 330)

Foundry grants Ontology roles *"on the Ontology level or the individual resource level"*.
Ours is organization + hotel + role tier. There is no per-object-type or per-action-type
grant: any org member reads every object type, any admin writes every one.

**Closed with projects, which is where Foundry actually puts the grant.** Not
per-resource: *"Role grants on folders and files are disabled by default... We
recommend keeping role grants on folders and files disabled."* A project is
*"the primary security boundary"*, grants attach to it, and they inherit to
everything it contains. So `projects` + `project_resources` +
`project_role_grants`, four roles (owner/editor/viewer/discoverer), and a
resource's role is its project's.

**The sentence that made it safe to turn on live data:** *"mandatory controls,
Organizations and Markings, will ALWAYS prevent an ineligible user from accessing
a resource, regardless of the user's role."* Roles are discretionary and sit
inside the mandatory boundary — ours is org/hotel scope, and every policy keeps
its `organization_id = auth_org_id()` term.

Which means it **only ever widens**. The admin/owner terms are untouched, so
nobody lost a capability; what is new is that an admin can grant a non-admin
Editor on a project and they may write that project's resources. Delegation is
the point of a discretionary role, and it is the half of gap 6 that actually
hurt.

Proven under a real role in `rls_contracts.sql` C30 — the grant inherits to the
resource, does not confer more than was granted, and the same grant row read from
another organization confers nothing.

**Resource Curator** (Compass's promotion gate, `DIVERGENCES.md`) is the obvious
next role to define on this spine.

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
   (migration 225). Agents inherit that reach through their toolset, not a subject column.
3. ~~**Wire authored tools into agent toolsets** (gap 5)~~ — done, #416; input parameters
   done, #417. **Gap 5 fully closed.**
4. ~~**Consume or delete `nodeSet`** (gap 4)~~ — deleted in #418, re-derived as
   `selectObjectSet`/`searchAround` once it had consumers.
5. Shared properties (gap 3), resource-level roles (gap 6) — see
   `docs/DELIVERABLE-MAP.md` §3, which sequences these against everything else.
   Resource-level roles now also carry Compass's **Resource Curator**, and depend
   on a resource tree existing first.
