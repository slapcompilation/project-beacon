# Optimization roadmap — already-shipped capabilities

Status: **proposed** (2026-06-21). This is not a feature backlog. It takes the
capabilities we've already shipped and asks, of each: *is it as AIP-native as it
could be?* The lens is the standing directive — **revolutionary by default,
stable by construction** — applied through five questions:

1. **Config-as-data?** Is any number/rule a human might tune still a code constant?
2. **Closes the loop?** Sense → typed Action → gate → Decisions → outcome retunes it.
3. **Proactive?** Does it come to the operator, or wait to be opened?
4. **Predictive?** Does it forecast the condition or just report current state?
5. **Operator-authorable?** Can behavior change in NL, without a deploy?

Slice 8 (expiry → tunable trigger, PR #204) is the template. This roadmap
generalizes that move and sweeps the rest. It complements — does not duplicate —
the pure tech-debt backlog in memory (`project_corrections_needed`).

---

## Priorities at a glance

| # | Capability | Optimization | Lens | Effort | Priority |
|---|---|---|---|---|---|
| 1 | Heuristic categorizers | Plug the real LLM behind `categorizeConstraint` + `parseExpiryTuning` (same signature) | Intelligent / authorable | M | **P0** |
| 2 | Calibration → Policy | Let proven agents *earn* autonomy automatically (calibration tunes floors) | Full automation / loop | M | **P0** |
| 3 | Monitors | Generalize the metric/trigger split to stockout-band, waste, supplier, expiry-batch | Config-as-data | M each | **P0** |
| 4 | Unattended cycle | Compose monitor sweeps into `runIntelligenceCycle` so detection runs on cron, not just the button | Proactive / full auto | S–M | **P0** |
| 5 | Copilot tools | Register `tune_monitor` / `author_constraint` as first-class copilot tools | Authorable / proactive | M | P1 |
| 6 | Forecasting | Train a real adapter (`prophet-v1`) behind `forecast_consumption` when it beats baseline | Predictive | L | P1 |
| 7 | Signals dedup | Merge Floor Alerts ↔ Eye Signals (`UnifiedSignalsPage`) into one feed | Stability / clarity | M | P1 |
| 8 | Decision counts | `get_decision_counts` RPC — collapse 5 rail badge queries → 1 | Performance | S | P1 |
| 9 | Eval cohorts + diff | Promote the parked eval diff/cohorts (PR #142) | Quality / observability | M | P2 |
| 10 | Provenance | Enrich sparse proposal→entity links (supplier/PO beyond variantId) | Auditability | M | P2 |

S ≈ <½ day · M ≈ 1–2 days · L ≈ multi-day/needs eval gate.

---

## P0 — the highest-leverage four

### 1. Real LLM behind the heuristic categorizers
**Today:** `constraints/categorizer.ts` and `monitors/parseExpiryTuning` are regex
heuristics, each explicitly "a stop-gap until a real LLM plugs in behind the same
signature." They handle the common shapes and silently miss the rest.
**Move:** route NL → typed-rule through the copilot edge function (server-side,
already has the model + tool plumbing), returning the *same* typed shape. The UI
and tests don't change — that's the point of having pinned the signature.
**Why P0:** it's the difference between "AIP-flavored" (operator must phrase it our
way) and "AIP-native" (operator says it however they like). Unlocks #5.
**Verify first:** confirm the copilot edge fn can be called for a structured,
non-chat categorization response.

### 2. Calibration → Policy: agents earn autonomy automatically
**Today:** `decideAutoExecution` already accepts a `CalibrationReport` and *can*
veto an overconfident agent. But `require_calibration` defaults `false`, floors
are static, and only `REQUEST_RESTOCK` auto-executes (0.9). Calibration informs
the gate but never *tightens or loosens* it on its own.
**Move:** a periodic job proposes policy edits from observed calibration — a
well-calibrated agent with N resolved samples gets its floor lowered / a new
action type enabled; a drifting one gets tightened. These are **proposals into
Decisions about the policy itself** (meta, but same machinery), so a human still
signs off the autonomy change. Over time the system widens its own unattended
envelope, safely.
**Why P0:** this is "full automation" done right — autonomy is *earned and
audited*, not switched on. It's the flywheel actually turning.

### 3. Generalize the metric/trigger split (Slice 8 → all detectors)
**Today:** expiry is tunable data; stockout/waste/supplier bands are still
hardcoded (`UnifiedSignalsPage`, the Eye hooks, SQL detectors).
**Move:** add `monitors.{stockout,waste,supplier}` configs to `OrgPolicy`,
each a pure `select*Triggers` evaluator + typed effect:
- **stockout** → already *flows* via `restock_advisor`; lift only the *surfacing
  band* (`days_until_zero` thresholds) to data, point the signal at the existing proposal.
- **waste** → anomaly threshold tunable → investigate Case / PAR-adjust proposal.
- **supplier** → risk-tier cutoffs tunable → re-rank / switch-supplier proposal.
**Why P0:** finishes the signals→Monitors convergence; every detector becomes a
listed, tunable, loop-closing monitor instead of a bespoke band.

### 4. Run monitors unattended (compose into the cycle)
**Today:** `useExpiryMonitorSweep` is operator-triggered only. The unattended
`runIntelligenceCycle` (cron edge fn) is variant/agent-centric and doesn't run
monitor sweeps.
**Move:** compose the monitor sweeps into `runIntelligenceCycle` (injected, like
the agent runner) so the daily cron fires them across every hotel, through the
same gate. The "Run scan now" button and the cron call the *same* sweep — one
loop, two callers, per CLAUDE.md.
**Why P0:** a monitor the operator must remember to click isn't proactive. This
makes detection ambient.
**Verify first:** confirm the `intelligence-cycle` edge fn + pg_cron schedule are
live and the auth-context issue (memory: `project_autonomous_loop_dead_under_cron`)
is resolved on the typed-agent path before adding monitor sweeps to it.

---

## P1

- **5. Copilot tools.** Once #1 lands, register `tune_monitor` and
  `author_constraint` as server-side copilot tools so the omnipresent copilot
  (Ctrl+J) can retune any monitor or author a constraint from anywhere — the NL
  box on the Monitors tab becomes one of several entry points, not the only one.
- **6. Predictive forecasting.** `forecast_consumption` is `rolling-30d-avg`. The
  modeling-objectives adapter framework + eval gates already exist. Train
  `prophet-v1` (or similar) behind the *same* tool signature; promote only when it
  beats baseline on the eval set per cohort. Callers don't change; `basis` flips.
- **7. Signals dedup.** Floor Alerts and Eye Signals (`UnifiedSignalsPage`)
  overlap. Merge into one ranked feed (the restructure spec's deferred
  `UnifiedSignalsPage` consolidation) — careful, both are rich surfaces.
- **8. `get_decision_counts` RPC.** The Decisions rail fires ~5 count queries.
  Collapse to one server-aggregated RPC (the `aip_signal_counts` pattern).

## P2

- **9. Eval cohorts + diff** (parked PR #142): per-hotel/region slices that flag a
  regression the overall pass rate hides; A-vs-B run diff. Promotes eval from
  "green/red" to "where did it regress."
- **10. Provenance enrichment**: proposals link reliably only by `variantId`
  (memory: `project_proposal_entity_links`). Add supplier/PO/document links at
  creation so Object-View intelligence and audit trails are complete.

---

## What's already good — don't "optimize" it

- The **gate** (`decideAutoExecution`) is the right single chokepoint. Extend it;
  never add a parallel one.
- **Cases / Object Views / Copilot / Action Chains / Constraint grammar** are
  AIP-shaped already — the restructure verified this repeatedly. The work is
  wiring and subtraction, not rebuilds.
- **`org_policy`** is the correct home for tunable knobs. Every config-as-data
  move should land *there*, not in a new table.

---

## Sequencing note
#1 unlocks #5; #2 and #4 together are the autonomy story; #3 is mechanical once
the expiry template is in hand. A sensible first sprint: **#3 (one more
detector) + #4 (cron) + #1 (real categorizer)** — that makes monitors a
complete, ambient, NL-authorable capability across more than one signal, which is
the most visible proof of the direction.
