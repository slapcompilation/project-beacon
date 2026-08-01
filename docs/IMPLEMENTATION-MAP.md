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

## Tier 1 — the object-set spine ✅ shipped

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

## Tier 2 — link traversal ✅ shipped

**The largest functional gap measured by what an operator can ask** (8.1).

*"Count restock requests for variants supplied by Supplier X"* is not expressible.
It crosses `fulfills` and `sourced_from`. Quiver treats that as the normal case —
it is the reason typed links exist at all.

Consumers: authored tools, cohort rules (Tier 1), the copilot, agents.

Landing this is also what makes `traversableLinks` mean something (0.5) — the field
was written for a capability that never arrived.

---

## Tier 3 — the ontology as source of truth for more than data ✅ shipped

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

## Tier 4 — lifecycle, fleet and distribution ✅ shipped

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

## Tier 5 — surfaces over substrate we already own ✅ shipped

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

**5.2 needed no build — it needed a document.** `search_documents` was already a
first-class copilot tool over `match_document_chunks`, returning title + page and
instructed to cite both, with an empty state that says *"do not invent document
contents"*. `documents` was 0, so none of it had ever run. Verified 2026-07-31 by
ingesting a real Greek invoice and asking in English: one `search_documents` call
returned **€1,200.00, due 30 January 2026, cited `(Τιμολόγιο INV11122, p. 1)`**.
Cross-lingual retrieval was not designed for; it falls out of embedding summaries.

That ingest is also what caught the regressions fixed in #446 — the Tier 0 stage
gate refused the document because harmonization had gone blind when
`relationship_edges` became a view. **Nine tiers of guards were worth one real file.**

---

## Deliberate non-goals

Recorded so nobody re-derives them as gaps:

- **User-authored action types** — `BeaconAction` stays typed in code.
- **Automations as an object type** — Foundry doesn't; it is cargo-culting.
- **Federated compute** (virtual tables, external transforms, S3 API) — no consumer
  in our domain yet. Revisit when a customer cannot copy their data.
- **SQL-learned per-variant thresholds** — `update_learned_thresholds` wrote
  per-variant alert days, restock multipliers and a confidence, derived from
  operator dismissals and approvals. That is a **model**, and Foundry's shape for
  a model is objective → deployment → function, reached *"in the context of the
  Ontology by using functions that invoke models"* (`functions-on-models`). Ours
  is the same: `objectives/<name>/adapter.ts` behind `runInference()`, an eval
  suite, release stages, and *"no code anywhere talks to a model directly"*. The
  function had no objective, no adapter, no eval, no release stage, and nothing
  read its confidence. It also **competed with a decision already made**: the
  monitors pattern is a deterministic metric plus a trigger the operator owns in
  `org_policy`, and a learned per-variant threshold is a second source of truth
  for the same number with no rule about which wins. CLAUDE.md admits a model only
  *"when a deterministic baseline gets beaten by a trained model on the eval set"*
  — no such evidence exists, so building it would have been adopting a model
  because the table was already there. Dropped in 299; if per-variant thresholds
  are ever justified they arrive as a modelling objective behind the adapter seam.
  `variant_learned_thresholds` stays — the proposal-quality briefing counts it,
  and that count is honestly zero rather than broken.
- **Analyst suite** (Contour, Slate, Notepad, Carbon, Fusion) — scope.
- **Container/external model serving, Spark, streaming engines** — scope.
- **Solution Designer** — design-time diagramming is a platform-vendor need.

---

## Status — the map is closed

**All six tiers shipped, verified 2026-08-01 against the live database rather
than against memory.** Spot-checks that mattered:

| item | evidence |
|---|---|
| 1 object sets | `object_sets` + `selectObjectSet` + Cohorts, traversals capped at 3 |
| 2 traversal | `searchAround`, `MAX_TRAVERSAL_DEPTH = 3` |
| 3.1 impact analysis | `authored_artifact_drift()` runs in the contract suite |
| 3.2 generated types | `gen:ontology:check` gates CI; fired twice and was right both times |
| **3.3 models as properties** | `variant.projected_demand`, `forecast_basis`, `forecast_confidence`, `forecast_horizon_days`, `forecast_as_of` — plus four registered time series |
| 4.1 lineage | `ontology_orphans()` / `reap_ontology_orphans()` |
| 4.2 per-hotel release | contract C27 — *a canary release stays at its property* |
| 4.3 packaging | export + install, Portability card |
| 5.1–5.7 | all wired in Phase A of the shape audit; see `SHAPE-AUDIT-ROADMAP.md` |

`model_releases` and `model_deployments` are both **empty**, and that is the
correct state: a model is admitted only when it beats a baseline on the eval set,
and none has. See the SQL-learned-thresholds non-goal below for the one time that
rule was nearly broken.

Work continues in `docs/SHAPE-AUDIT-ROADMAP.md` (drift the map did not cover) and
`docs/CONTRACT-MODEL.md` (what real documents taught us).

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
