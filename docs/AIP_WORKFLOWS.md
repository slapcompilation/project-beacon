# AIP Workflows — how Beacon runs, end to end

> **Stale 2026-08-04.** Written 2026-06-08, before the ontology split, the
> intelligence cycle's current gate, the Studio IA and the whole Workshop arc.
> It describes how workflows ran then, not now.
> **Do not plan from this.** See [`CAPABILITY-CHAIN.md`](./CAPABILITY-CHAIN.md)
> for how the layers actually connect today.


This walks the core Palantir-AIP workflows as they actually run in Beacon, grounded in
the live demo org (`My Hotel`, two F&B properties). It is not aspirational — every number
below is real seeded data flowing through production code paths (`seed_demo_world`,
migration 159): 90 days of POS-derived consumption, recipe ontology, supplier reliability.

## The world the AIP reasons over

**Two F&B properties in one org** — `Valinor` and `Rivendell` — each with the same
10-item catalogue, ~16 cocktails/day across 6 recipes, 90 days of POS history. They are
stocked **complementarily**: Rivendell holds surplus of exactly what Valinor is short on,
which is what makes the network workflows (transfers, lateral-before-external,
benchmarking) live rather than theoretical.

Valinor, as of the last cycle:

| Item | On hand | Par | ~Daily use | Supplier | Supplier on-time |
|---|--:|--:|--:|---|--:|
| Soda Water | **1** | 22 | 3.3 | Bar Essentials | 50% |
| Cola | **3** | 36 | 6.0 | Bar Essentials | 50% |
| Orange Juice | 6 | 16 | 2.4 | Bar Essentials | 50% |
| White Rum 700ml | 8 | 20 | 3.8 | Premium Spirits | **25%** |
| Tequila Blanco | 10 | 16 | 2.5 | Premium Spirits | **25%** |
| Gin 700ml | 18 | 24 | 5.0 | Premium Spirits | **25%** |
| Vodka 700ml | 22 | 30 | 5.9 | Premium Spirits | **25%** |
| Tonic Water | 28 | 28 | 4.9 | Bar Essentials | 50% |
| Lime | 30 | 60 | 12.5 | Bar Essentials | 50% |
| Bourbon 700ml | 18 | 16 | 2.3 | Premium Spirits | ok |

Two things the AIP should *notice on its own*: Soda Water and Cola are hours from stockout,
and **Premium Spirits Co delivers on time only 25%** of the time — it supplies the four
core spirits.

And the network angle: **Rivendell holds the surplus** — Soda Water 70, Cola 95, Orange
Juice 45, White Rum 55 — exactly what Valinor is starved of. Conversely Rivendell is short
on Bourbon (2) and Tonic (1) where Valinor has cover. So the right first move for several of
Valinor's gaps is a **transfer from Rivendell**, not a purchase order — and vice versa.

The four AIP layers each appear in every workflow below:

- **Data** — typed nodes + computed properties (`packages/reality-graph/src/nodes`)
- **Compute** — Logic Tools, deterministic + versioned (`.../tools`)
- **Mutation** — typed `BeaconAction`s through the audited registry (`.../actions`)
- **Agents** — sub-LLM blocks that read via tools and propose actions (`.../agents`)

---

## Workflow 1 — The autonomous restock cycle (the heartbeat)

**Trigger:** pg_cron fires `intelligence-cycle` daily at 07:00 UTC (or the operator clicks
**Run cycle** on Command home). Both call the same `runIntelligenceCycle()`.

**What happens, step by step — using Soda Water (1 on hand, par 22):**

1. **Scan (data).** The cycle lists at-risk variants: `current_stock ≤ par`. Soda Water,
   Cola, Gin, … — 9 of 10 qualify today.
2. **Run the agent (agent).** `restock_advisor` runs per variant. Its numbered prompt:
   - `query_open_restock_requests` — is a request already covering the gap? (no)
   - `forecast_consumption(7d)` — rolling-30d avg = 3.3/day → ~23 units needed for a week
   - `query_sister_property_inventory` — any sister hotel with ≥40% of the gap to transfer? **Rivendell holds 70 Soda Water → covers the whole gap.** The agent prefers `TRANSFER_STOCK` over a purchase.
   - `rank_alternative_suppliers` — only consulted for the remainder; Bar Essentials (50% on-time, 7-day lead) is the external source
   - emits a typed `REQUEST_RESTOCK` proposal with **confidence + basis + provenance**
3. **Gate (mutation + constraints).** `decideAutoExecution` composes:
   - the per-action floor (`REQUEST_RESTOCK ≥ 0.9`, operator-tunable in Mind → Policy)
   - any per-agent override (Phase E3)
   - hard constraint violations (none here)
   - the release gate — `restock_advisor` is in `production` in the release ledger
4. **Dispatch or queue.**
   - Confidence ≥ floor + no hard violation + agent in production → **auto-executes** as
     `triggered_by: 'ai_auto_approved'`, creating the restock request unattended.
   - Otherwise → **queued** for the operator with the full reasoning attached.
5. **Audit.** Every outcome writes an immutable `StockLog`/proposal row + a
   `system_health_events` cycle summary, so "ran but did nothing" is visible.

**Operator surface:** Command home shows the cycle summary ("9 scanned, N auto-executed,
M queued, next run in 22h"). The empty state explains what was scanned, against what
thresholds, and when the next run is — never just "all clear".

**Why it's AIP, not a cron job:** the agent *reasons* per item (transfer vs reorder, which
supplier, how much), the decision passes a governed gate, and the whole chain is auditable.

---

## Workflow 2 — Operator review queue (human-in-the-loop)

**Trigger:** a proposal lands `queued` (confidence below the floor, or a soft constraint, or
a non-production agent).

**Workflow:**
1. Mind → **Review Queue** shows proposals **confidence-coded**: green ≥0.85, yellow
   0.6–0.85, red <0.6.
2. Each card carries **confidence + reasoning + provenance** — the exact tool chain
   (`forecast_consumption → rank_alternative_suppliers`) and any cited documents.
3. The operator opens the **trace slide-over**: numbered steps (AIP-debugger style) showing
   each block, tool, input args, return value, and token usage.
4. Decision:
   - **Approve** → the `BeaconAction` dispatches through the registry (same path as a human
     action), writing the immutable audit entry.
   - **Edit-and-approve** → per-field correction for terminal fixes.
   - **Refine via NL** → "order two weeks not one" → the agent regenerates; the new proposal
     **supersedes** the old one with a diff against the parent (`parent_version_id`).
   - **Reject** → captured as outcome signal for the flywheel (Workflow 7).

**Why it's AIP:** the operator reviews *the delta and the reasoning*, not raw data; the
proposal is a typed action, not free text; every path is audited identically to a human's.

---

## Workflow 3 — Supplier-aware sourcing (the network reasons)

**Trigger:** a restock needs a source. Premium Spirits Co supplies Gin/Vodka/Rum/Tequila —
and delivers on time **25%** of the time (computed by `compute_supplier_reliability` from
8 closed POs + invoices).

**Workflow:**
1. **Lateral before external** — `query_sister_property_inventory` runs first. For Valinor's
   short spirits, **Rivendell's surplus** (Rum 55, etc.) covers the gap, so the agent proposes
   `TRANSFER_STOCK` Rivendell → Valinor instead of a purchase order. Cheaper, faster, and it
   draws down the sister's overstock at the same time.
2. Only the *remainder* (or items no sister can cover) goes external. `rank_alternative_suppliers`
   ranks by reliability × lead-time-fit, every result carrying `basis` + `confidence`.
3. The agent picks the highest-reliability supplier whose lead time covers the gap, and
   **cites the reliability number in its rationale** — so the operator sees *why* Premium
   Spirits (25% on-time) was flagged, not just that it was chosen.
4. The org overstock sweep runs the mirror image from Rivendell's side: it sees Soda/Cola/OJ/Rum
   overstocked there and a sister (Valinor) short → proposes the same transfers proactively.
5. The reliability signal also surfaces on the Supplier Object View, where the operator can
   author a constraint ("never auto-approve Premium Spirits POs over $500") in NL.

**Why it's AIP:** benchmarking + lateral sourcing are properties of the network, not reports
the operator runs; the surplus-to-shortfall match across Valinor and Rivendell is *surfaced by
the data*, and the unreliable supplier is flagged automatically rather than discovered by hand.

---

## Workflow 4 — Scenario: a what-if sandbox (operator + LLM co-driven)

**Trigger:** the operator wants to test a policy change without touching production —
"if I tightened auto-execution, how much would still go through unattended?"

**Workflow (Mind → Scenarios → New scenario):**
1. **Edit the overlay.** Either by hand (the policy-overlay editor) or by talking to the
   copilot: *"tighten the restock auto-exec floor to 0.95 for this scenario."* The LLM calls
   `apply_overlay_edit(['policy','auto_execution','thresholds','REQUEST_RESTOCK'], 0.95)`.
   Every edit is logged with provenance (**llm** vs **operator**).
2. **Simulate.** Click **Simulate** → `simulateCycleWithOverlay` runs the *exact* cycle from
   Workflow 1 against the merged overlay, with **no-op persistence** — nothing reaches real
   state. Result: scanned / proposed / auto-executed / queued + per-variant outcomes.
3. **Read the delta.** Ask the copilot *"what changed?"* → `query_simulation_result`
   summarizes: e.g. "at 0.95, 3 of the 9 that would auto-execute now queue instead."
4. **Promote or discard.** Promote turns the overlay into real changes (e.g. saves the
   policy threshold); discard throws the branch away. Scenarios are exploratory and
   uncommitted — distinct from versions.

**Other scenarios the same machinery covers:**
- *"Weekend occupancy surge"* — overlay variant stock/consumption down, simulate, see which
  items stock out first.
- *"Drop the unreliable supplier"* — overlay a constraint disabling Premium Spirits, see how
  sourcing re-routes.

**Why it's AIP:** the operator explores consequences against a live model through natural
language, the LLM manipulates the sandbox only through typed tools, and a promote is a
governed, audited change — never a raw edit.

---

## Workflow 5 — Copilot: grounded conversation + action

**Trigger:** operator opens the selection-aware copilot anywhere in the app.

**Workflow:**
1. *"What's about to run out?"* → the copilot calls `get_stock_pressure` and answers from
   data: "Soda Water (1 left, ~0.3 days) and Cola (3 left, ~0.5 days) are critical."
2. *"Order enough Soda Water for a week."* → it returns a **structured proposal**
   (`REQUEST_RESTOCK`, qty sized from the 30-day average) rendered as Confirm / Edit / Cancel —
   it never auto-executes.
3. **Selection-aware:** on a Variant page it defaults tool inputs to that variant; on a
   Scenario it gains the overlay tools (Workflow 4). One contextually-scoped slide-over, not
   a global drawer.

**Why it's AIP:** the copilot is glue — it decides *which* typed tool to call, grounds every
answer in tool results, and proposes typed actions; it never does math, retrieval, or writes
directly.

---

## Workflow 6 — Constraints + auto-execution governance

**Trigger:** the operator writes a rule in natural language: *"Never auto-approve restocks
over $500"* or *"No unattended orders after 6pm."*

**Workflow:**
1. The LLM categorizes the NL rule into a typed `Constraint` bucket (`threshold`,
   `time-window`, `actor-role`, `scope`) and stores it.
2. At action submission, `evaluateConstraints` checks every applicable constraint:
   - **hard violation** → action rejected, the constraint cited
   - **soft violation** → action bumped to a higher approval tier
   - **clean + confidence above the auto-execution threshold** → unattended execution
3. Thresholds are **per-action-type, per-organization, operator-tunable** in Mind → Policy —
   no code change to retune the autonomy envelope.

**Why it's AIP:** the autonomy boundary is operator-authored in plain language and enforced
deterministically at the mutation layer — guardrails are configuration, not code.

---

## Workflow 7 — The learning flywheel

**Trigger:** the operator corrects or rejects a proposal.

**Workflow:**
- **Principle:** *"We never stock more than 3 weeks of spirits"* → stored as a typed
  `Principle`, injected into `restock_advisor`'s prompt as a soft constraint on the next run.
  The operator sees their feedback honored (provenance shows the principle that shaped the
  result).
- **Approved Answer:** a curated Q&A is served as a Tier-1 lookup *before* any fresh LLM call
  when a question matches — cheaper, consistent, auditable.
- **Proposal outcome:** approve / edit / reject is recorded against the proposal, feeding the
  eval cohorts that gate the next agent promotion (Agent Studio → Evaluation).

**Why it's AIP:** feedback is captured as typed nodes and flows back into agent behavior and
the promotion gate — the system gets measurably better, and you can see why.

---

## Where each workflow lives

| Workflow | Surface | Core code |
|---|---|---|
| 1 Autonomous cycle | Command home · cron | `cycles/intelligenceCycle.ts`, edge fn `intelligence-cycle` |
| 2 Review queue | Mind → Review Queue | `agents/restock_advisor`, `features/agents` |
| 3 Supplier sourcing | Supplier Object View | `tools/logic/rank_alternative_suppliers`, `compute_supplier_reliability` |
| 4 Scenarios | Mind → Scenarios | `scenarios/`, `tools/scenarios/*`, `features/scenarios` |
| 5 Copilot | Selection slide-over | edge fn `copilot-chat` |
| 6 Constraints | Mind → Constraints / Policy | `constraints/index.ts`, `features/mind/PolicyTab` |
| 7 Flywheel | Mind → Principles / Answers · Agent Studio | `agents/principles.ts`, `model_eval_runs` |

The throughline: **observe → propose → govern → execute → learn**, every step typed and
audited. That loop, running on real data, is what makes Beacon an AIP rather than an
inventory app with AI features.
