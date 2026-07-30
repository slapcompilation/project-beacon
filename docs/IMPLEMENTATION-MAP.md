# Implementation map — closing the Foundry capability gaps

Consolidates every open gap from `FOUNDRY-CAPABILITY-AUDIT.md` (all eleven
sections) plus the five ingestion defects found by running the pipeline. Ordered
by **dependency**, not by section number.

---

## The governing rule

The audit found one failure mode repeating across every section: **capability that
exists and is not in the path.**

- `nodeSet` — a query primitive nothing queried (deleted, #418)
- `model_releases` — a lifecycle nothing promoted through
- `traversableLinks` — metadata nothing traverses
- `LogicTool.version` — a field nothing pins
- monitors — a write path that bypassed the gate (fixed, #420)

One root cause: **we built the noun without the verb that needs it.**

Foundry does not have this problem because its concepts are defined by their
consumers. Object sets exist *because functions take them*. Title keys exist
*because Object Views need them*. Copy the logic and the consumer comes with it.

So the rule for everything below:

> **No concept ships without the consumer that needs it.** Foundry is the
> reference for discovering what those consumers are — not a checklist to
> replicate.

Two corollaries, both load-bearing:

1. **Copying blindly produces the same dead code from the other direction.** We
   deliberately do *not* make automations an object type (Foundry doesn't), and we
   do not build federated compute (no consumer in our domain yet).
2. **Our own inventions must survive the rule.** Calibration, the trust budget and
   honest labels have **zero** hits in 3,696 Foundry URLs. They stay, because they
   have consumers: `decideAutoExecution` and the copilot both read them.

Every item below names its consumer. An item that cannot name one does not ship.

---

## Tier 0 — correctness and honesty ✅ shipped

Nothing here was a feature. These were things that were **wrong or untrue**.

| # | Item | Consumer | Source | Status |
|---|---|---|---|---|
| 0.1 | Provenance FKs → `ON DELETE SET NULL` | the audit trail itself | D3 | ✅ mig 231 + invariant 4 |
| 0.2 | Stage-9 gate asserts **content**, not HTTP status | ingestion fail-closed posture | D2 | ✅ |
| 0.3 | Fix harmonization (exact-name matches resolve) | `entity_link_suggestions`, the doc→ontology loop | D1 | ✅ |
| 0.4 | `version` — enforce or drop the claim | the agent run trace | 5.2 | ✅ recorded per step |
| 0.5 | `traversableLinks` — enforce or amend CLAUDE.md | the LLM tool contract | 8.1 | ✅ reaches the prompt |

**0.1 was wider than the audit found.** The cascade was not specific to documents:
~14 provenance columns carried it, including `object_types.created_by_user_id`,
which cascades on into `object_records` and `link_records` — deleting the operator
who authored a type deleted the type and its data. The convention was already
correct in most of the schema (127/132/134/136/147/151/157/163 use `SET NULL`);
migration 231 derives the offenders from the catalog rather than listing them, and
security invariant 4 fails the build if one comes back.

**0.3 was two bugs, and neither was visible by reading.** Every `product_variants.name`
is literally `'Standard'` — the identifying name is on the product — so the candidate
list handed to the model was N identical rows and `variantByKey` was keyed on
`"standard"`. On top of that, harmonization sat *after* an early return taken when
the LLM produced no suggestion, so the deterministic step was a dependent of the
probabilistic one. It now runs first, because it is free and cannot fail.

**0.4/0.5 were honesty.** Both fields existed and reached nobody. Rather than delete
them, each got the consumer that makes the claim true: `version` is recorded on the
call and response steps of every trace, and `traversableLinks` is appended to the
description the model actually sees. CLAUDE.md now states what is enforced (a
contract with the model) and what is not (a runtime sandbox — that arrives with
Tier 2).

---

## Tier 1 — the object-set spine (the highest-leverage build)

**One concept, four consumers already identified by the audit.** This is the
clearest case in the map of the governing rule passing loudly.

> A rule is "a set of conditions that specify particular rows" … rules support
> categorization and **cohort creation**. — Foundry Rules

Build **a named, stored rule that produces a set of ontology objects.**

Its consumers, all already wanted:

| Consumer | Gap it closes |
|---|---|
| **Cohorts** — a named group under investigation | 6.2 |
| **Automations** — condition becomes "a set", effect becomes one consumer of it | 7.5 |
| **Authored tools** — take and return sets rather than raw filters | 5 (`api-object-sets`) |
| **Analytics** — the unit Quiver analyses | 8.1 |

Today an `automation` is a condition **welded to an effect** — we cannot name a set
without saying what to do with it. That single design choice is why we have no
cohorts.

**This is where `nodeSet` returns** — with consumers this time, not as a dormant
primitive. Deleting it was right; re-deriving it here is the point.

---

## Tier 2 — link traversal (depends on Tier 1)

**The largest functional gap measured by what an operator can ask** (8.1).

*"Count restock requests for variants supplied by Supplier X"* is not expressible.
It crosses `fulfills` and `sourced_from`. Quiver treats that as the normal case —
it is the reason typed links exist at all.

Consumers: authored tools, cohort rules (Tier 1), the copilot, agents.

Landing this is also what makes `traversableLinks` mean something (0.5) — the field
was written for a capability that never arrived.

---

## Tier 3 — the ontology as source of truth for more than data

Three faces of one idea, and the direct continuation of G1–G4.

| # | Item | Consumer | Source |
|---|---|---|---|
| 3.1 | **Impact analysis for authored artifacts** — what breaks if a type changes | operators editing types | 7.2 |
| 3.2 | **Generate types from the ontology** | `apps/web`, reality-graph | 5.4 |
| 3.3 | **Bind models to object types** — outputs as properties | every Variant surface | 3.4 |

**3.1 is live risk, not theory.** `validateUserTool` runs only in the composer, and
object types are editable, so deleting a property silently breaks every saved tool
that filtered on it — answering zero, confidently. `builtin_property_drift()` is
exactly the right mechanism, built for the *other* half of the ontology.

**3.3 is the §3 finding**: a `Variant` has no `projected_demand` property a model
fills. Bind it and forecasts appear everywhere a Variant appears, instead of only
where someone called a tool.

---

## Tier 4 — lifecycle, fleet and distribution

| # | Item | Consumer | Source |
|---|---|---|---|
| 4.1 | **Lineage-aware retention/deletion** | subsumes D3 (0.1) and D4 orphans | 10.3 |
| 4.2 | **Phased rollout — release per hotel, not per org** | multi-property chains | 9.2 |
| 4.3 | **Package / export ontology artifacts** | new customers; a hospitality starter pack | 9.1 (= 5.5, 6.6) |

**4.2 undercuts a headline feature today.** `agent_releases` is keyed on
`(organization_id, agent_name, stage)`, so a twelve-property chain cannot canary an
agent at one hotel. The echelon model is threaded through every RLS policy and then
disappears exactly where money gets spent.

**4.3's real consequence:** every new customer starts from an empty Studio. All of
P1–P5 and G1–G4 is per-tenant and non-transferable.

---

## Tier 5 — surfaces over substrate we already own

Cheap relative to value, because the hard half exists.

| # | Item | What already exists | Source |
|---|---|---|---|
| 5.1 | **Help assistant** (app-aware) | `ApprovedAnswer` store + `GLOSSARY` | 1.3 = 11.3 |
| 5.2 | **Ad-hoc document Q&A** | typed ingestion + `cited_in` + page citations | 1.5 |
| 5.3 | **Assignment** on proposals and cases | role hierarchy, echelon model | 6.2 |
| 5.4 | **Adoption metrics** | proposal/authoring event data | 11.2 |
| 5.5 | **Source registry** (connectors as config) | nine working edge functions | 2.2 |
| 5.6 | **Data-vs-dataset freshness** | `get_integration_health()` | 7.1 |
| 5.7 | **Time-series primitive** | `daily_series.ts`, discarded today | 8.3 |

**5.4 is the thesis check.** The Flywheel answers "is it getting smarter"; nothing
answers "is anyone driving". For a product about operators authoring the system,
that is the blind spot that matters most.

---

## Deliberate non-goals

Recorded so nobody re-derives them as gaps:

- **User-authored action types** — `BeaconAction` stays typed in code.
- **Automations as an object type** — Foundry doesn't; it is cargo-culting.
- **Federated compute** (virtual tables, external transforms, S3 API) — no consumer
  in our domain yet. Revisit when a customer cannot copy their data.
- **Analyst suite** (Contour, Slate, Notepad, Carbon, Fusion) — scope.
- **Container/external model serving, Spark, streaming engines** — scope.
- **Solution Designer** — design-time diagramming is a platform-vendor need.

---

## Sequencing

```
Tier 0  ──►  Tier 1  ──►  Tier 2
(fix wrong)  (object sets)  (traversal)
   │             │
   │             ├──► Tier 3  (ontology as source of truth)
   │             │
   └─────────────┴──► Tier 4  (lifecycle + fleet)
                             │
                             └──► Tier 5  (surfaces)
```

Tier 0 first because parts of it are untrue or lose data. Tier 1 before Tier 2
because traversal wants a set to traverse *from*. Tier 5 last only because it
depends on nothing — any item is pullable forward if it becomes urgent.

**Expect a meaningful share of this to be wiring rather than building.** That is the
audit's central finding and the reason the map is ordered this way: several
"features" already exist and need a consumer, not an implementation.
