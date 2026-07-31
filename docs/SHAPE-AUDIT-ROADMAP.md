# Shape audit — what 285 migrations actually left, and what to do about it

**Run it yourself:** `node scripts/audit-shape.mjs` (add `--json` for the raw data).

## Method, and why not the migration files

Migrations are a **log**. Most of the 285 are superseded by later ones, so grading their text measures history rather than the system — migration 003 creating a column that migration 190 renamed tells you nothing about today. This audits **surviving artifacts**: every table, function, trigger and policy currently in the database.

The test is the stage directive's, not age:

> **Does this shape have a Foundry counterpart, and does ours match it?**

Age is not the criterion and using it would be destructive: `product_variants` and `stock_logs` are among the oldest tables and they back the ontology's core object types. What dates badly is *shape* — a mechanism built before we had the general primitive that replaces it.

## The numbers

| | |
|---|---|
| functions (excl. pgvector) | **249** — 146 called by the app, 38 triggers, **24 reachable by nothing** |
| tables | **106** — 27 back an object type, 9 back a link, **70 neither** |

*After all five phases: 246 functions, 0 undeclared unreachable; 105 tables, every one classified, 10 grandfathered and falling.*
| link types | 24 (16 FK-backed, 8 join-backed, 0 loose) |
| time series registered | 4 |

"Reachable by nothing" counts the app, triggers, other functions, policies, CHECK constraints, cron jobs, event triggers and the SQL guards. Building that list found four false positives before it found anything real — event triggers and CHECK helpers are invisible to a grep of the TypeScript.

---

# Ranked findings

Ranked by **ontology leverage** — how much reasoning capability the fix unlocks — then by risk.

## F1 · Ten capabilities shipped this week reach no surface — *highest, and self-inflicted*

Of the 24 unreachable functions, **ten were written in the last few days**:

`adoption_metrics` · `assign_proposal` · `review_queue_load` · `source_freshness` · `source_reconciliation` · `help_search` · `record_answer_served` · `time_series_first_point` · `time_series_last_point` · `install_ontology_package`

This is the exact anti-pattern the week was spent fixing, reproduced while fixing it. Tier 5 built the substrate and stopped at the database boundary. It ranks first because it is the largest single block, the cheapest to fix (the hard half exists), and the least defensible.

**CLAUDE.md already forbids it:** *no concept without its consumer.*

## F2 · The BOM chain is broken in the middle — *highest leverage per line of work*

```
pos_sale ──?──> [ menu_item ] ──?──> menu_item_ingredient ──recipe_consumes──> variant
  type          NOT A TYPE            type                   FK-backed          type
```

`recipe_consumes` exists and is FK-backed on `menu_item_ingredients.variant_id`. `menu_item_ingredient` is a registered object type. **The dish is not.** So the traversal from a sale to the stock it consumed cannot be expressed — `menu_items` (12 rows) is invisible to `searchAround`, to object views, to every typed read the copilot has.

The consequence is a question hospitality actually asks: *"which dish is driving my tomato burn?"* Today that needs a bespoke SQL function. With one object type and two link types it is a three-hop traversal — exactly Foundry's `searchAround` depth cap, which is not a coincidence.

## F3 · Three generations of connector health, all live

| gen | artifacts | shape |
|---|---|---|
| 2024 | `pms_connections`, `pos_connections`, `get_pms_health()`, `get_pos_health()` | one health function **per connector type** |
| mig. 190 | `get_integration_health()`, monitors band, `IntegrationSourceKind = 'pms'\|'pos'\|'documents'` | generic-ish — source kinds are a **TypeScript union** |
| this week | `data_sources`, `source_freshness()`, `source_reconciliation()` | config-as-data |

**Foundry's shape** (`data-integration/health-checks.md`): health checks are *one service* with check types — job-level, build-level, **freshness** — applied to datasets. `source-type-overview.md` lists dozens of connectors (S3, Oracle, SQL Server, SFTP…) all feeding the same machinery. There is no per-connector health API.

Generation 3 is Foundry's shape. The tell on generation 2 is that `IntegrationSourceKind` is a union: **adding a source requires a code change**, which is precisely what `data_sources` exists to end.

reality-graph's own comment already says the monitors band *"replaces the hardcoded 2h/24h buried inside `get_pms_health` / `get_pos_health`"*. It was built as a replacement and the originals were never retired.

## F4 · `variant_cost_history` is a time series living in a table

20 rows of cost-over-time, while the time-series primitive shipped this week with four registrations. Cost is the obvious fifth and it is **one row of config**, not a migration:

```
variant.unit_cost ← variant_cost_history (entity: variant_id, time: changed_at, value: unit_cost)
```

## F5 · `booking_forecasts` is the untyped half of a typed concept

`occupancy_log` is an object type *and* carries the `hotel.occupancy` time series. Forward-looking occupancy (60 rows) is neither — no type, no series, no links. One concept, two tables, one of them invisible to the ontology.

Compounding it: `variant.projected_demand` is a registered series over `forecast_observations`, so the system has **two unrelated forecast stores** with different typing.

## F6 · Pre-ontology graph readers still shipped

`get_node_set` and `get_node_edges` predate object sets and `searchAround`. Unreachable, superseded, still deployed.

## F7 · No declared boundary between platform and domain tables

70 of 106 tables sit outside the ontology and **most of them correctly** — `object_types`, `model_eval_runs`, `agent_releases`, `copilot_conversations` are platform metadata, and Foundry keeps its equivalents out of the ontology too.

The problem is that nothing *says so*. There is no declaration of which tables are platform and which are domain, so "a new domain table nobody typed" and "a platform table that should never be typed" are indistinguishable. That makes this whole class of drift undetectable — which is why it took an audit to find F2 and F5 rather than a build failure.

## F8 · Assorted unreachable domain helpers

`get_contract_price`, `get_cost_at`, `update_learned_thresholds`, `backfill_forecast_observations`, `notify_restock_approved`, `simulate_scenario`, `get_eval_case_runs`, `derive_object_type_properties`. Each needs a one-line verdict: consumer, or delete. Low leverage, non-zero noise.

*(The four `seed_*` functions are deliberately unreachable — dev utilities, correctly excluded from any retirement.)*

---

# Roadmap

> **STATUS — all five phases shipped (2026-07-31).** Outcomes recorded per phase
> below. `audit-shape --check` now runs in CI, so the findings this document
> describes become build failures rather than the next audit's material.
>
> | | | |
> |---|---|---|
> | A | #451 | 10 capabilities wired · **3 had never worked** |
> | B | #452 | 3 health mechanisms → 1 · **found a live stock-write abort** |
> | C | #451 | BOM chain closed · 2,548 sale→variant paths |
> | D | #453 | 2 series registered · `booking_forecast` typed |
> | E | #453 | boundary declared · ratchet in CI · **caught an orphan on run one** |


Ordered so each phase makes the next cheaper, and so the ratchet lands before the big changes.

## Phase A — consume what already exists *(no new substrate)*

Fix F1 by wiring the ten. Nothing new gets built; every one of these has a working server side.

| capability | surface |
|---|---|
| `source_freshness` + `source_reconciliation` | Monitors → replaces the per-connector health cards |
| `adoption_metrics` | Flywheel → the "is anyone driving" band |
| `review_queue_load` + `assign_proposal` | Review Queue → assignee column + assign action |
| `help_search` + `record_answer_served` | Copilot → tier-1 lookup before a fresh LLM call |
| `time_series_first/last_point` | Object views → the metric strip on Variant and Hotel |
| `install_ontology_package` | Studio → the import side of 4.3's export |

**Exit:** unreachable count drops from 24 to ≈14, and every Tier 5 item has a consumer.

## Phase B — one health mechanism *(fixes F3)*

1. Register PMS, POS and documents as `data_sources` rows.
2. Point Monitors and the Insights health card at `source_freshness()`.
3. Delete `IntegrationSourceKind` — a source becomes a row.
4. Drop `pms_connections`, `pos_connections`, `get_pms_health`, `get_pos_health`, `get_integration_health`.

**Exit:** adding a connector is config. Three tables and three functions retire.

## Phase C — close the BOM chain *(fixes F2, the leverage phase)*

1. Register `menu_item` as an object type over `menu_items`.
2. Add `pos_sale ──sold──> menu_item`, FK-backed on `pos_sales.menu_item_id`.
3. Add `menu_item_ingredient ──ingredient_of──> menu_item`, FK-backed on `menu_item_ingredients.menu_item_id`.

**Exit:** `pos_sale → menu_item → menu_item_ingredient → variant` traverses in three hops. "Which dish is driving this burn" becomes a question the ontology answers, and the recipe becomes something the copilot can reason over instead of something only SQL knows.

## Phase D — finish the typing gaps *(fixes F4, F5)*

1. Register `variant.unit_cost` over `variant_cost_history` — one row.
2. Decide `booking_forecasts`: register as an object type, **or** fold into `forecast_observations` as a forward horizon. One concept, one home.
3. Same one-line verdict for F8's eight helpers.

## Phase E — the ratchet *(fixes F7, and is the point)*

Make the audit a build gate rather than an exercise:

1. Add a **declared boundary** — each table is `platform`, `domain` or `dev`, recorded as data next to the object-type registry rather than in a comment.
2. `audit-shape.mjs --check` fails when a table marked `domain` backs no object type, or an unreachable function appears that is not on the allowlist.
3. Wire it into CI beside `check:rpcs` and `check:edge` — the same family of gate, for the same reason: **turbo cannot see a string, and it cannot see an absence either.**

**Exit:** the next capability from Foundry's list cannot land half-typed or half-consumed without the build saying so. That is the future-proofing — not this document, which goes stale, but the gate, which does not.

---

## Why this ordering

Phase A is first because it is pure debt from this week and the cheapest thing on the list. Phase E is last only because it needs the earlier phases to pass — but **it is the deliverable that matters**. Everything above it is a one-off cleanup; the ratchet is what stops the next 285 migrations accumulating the same drift.

The three defects found this week — harmonization blind (#446), `ON CONFLICT` on a view (#448), four RPCs that never existed (#449) — were all found by pushing **real data** through the system, never by a test. Phase E is the attempt to make the next one fail in CI instead.


---

# What each phase actually cost and found

Recorded because the estimates were wrong in both directions, and the pattern is
worth keeping.

**A — consume what exists.** The cheapest phase by code and the most productive
by defects. Three of the ten had never worked: `review_queue_load` returned 403
for every real user (SECURITY INVOKER joining `auth.users`), `adoption_metrics`
reported a false 0%, and the curated answers had never been consulted. All three
were invisible until something called them.

**B — one health mechanism.** Nearly deleted the operator's tunable SLA by
accident: `source_freshness` has hardcoded thresholds and the band it was
replacing read org policy. Caught before merging; the registry supplies the
metric, policy still supplies the trigger. Then the POS probe hit
`trg_stock_log_occupancy_edge` still writing the **pre-split** edge name, which
aborts every `stock_logs` write on a day with occupancy data. Latent for months
because occupancy was stale; reachable the moment a real event landed.

**C — the BOM chain.** Three registrations, no new code, and the highest value
per line in the whole roadmap. `pos_sale → menu_item → menu_item_ingredient →
variant` now traverses in three hops.

**D — typing gaps.** The roadmap's own suggestion (fold `booking_forecasts` into
`forecast_observations`) turned out to be wrong once the data was checked —
per-variant demand versus per-hotel occupancy. Recorded rather than followed.

**E — the ratchet.** Found `raise_integration_health_alert` orphaned by Phase B
on its first run, in a PR that was already merged and green. That is the entire
argument for the gate: it caught in CI exactly the class of thing that had
needed a full audit to find.

## The through-line

Every defect in this arc came from **real data**, never from a test — a Greek
invoice, a source registration, a webhook, a POS probe. The guards were correct;
the coverage was the gap. Phase E exists to make the next one fail in CI instead
of waiting for someone to look.
