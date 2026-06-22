# Authoring strategy — how operators shape Beacon's behavior

Status: **agreed** (2026-06-22). The product question this settles: *how do
non-engineers change what the system does — and how far do we take "no-code"?*

## Thesis

**Operator-authorability is the moat.** A customer who has authored their own
monitors, rules, and automations on their ontology doesn't churn — the switching
cost is the behavior *they* built. It's also the most visible thing separating an
AIP-grade product from a dashboard, and it's our standing directive made literal:
*config-as-data, behavior changes without a deploy.*

But **"no-code" is a ladder, not a single product.** The expensive top rung (a
Foundry-style visual Logic canvas) is the wrong *first* bet for hospitality:
our authors are GMs and floor staff, not the forward-deployed engineers
Palantir's canvas is built for. We win by treating **natural language as the
builder** and climbing the ladder only as a real author persona and real demand
appear.

The discipline: **authoring widens *what can be expressed*; it never bypasses the
gate.** Every rung routes proposals through `decideAutoExecution` + the audit
trail, and prefers a **bounded typed grammar** (pick-from-ontology) over
free-form so the result stays auditable — the same reason Constraints are typed
buckets, not arbitrary predicates.

---

## The authoring ladder

Cheapest + highest-ROI at the bottom; most expensive + narrowest-audience at the
top. We are deliberately heavy at the bottom and demand-gated at the top.

### Rung 0 — Code (engineers / us). *Foundation; always exists.*
Typed Logic Tools, Agents (blocks + numbered prompts + evals), Actions, Adapters
in `packages/reality-graph`. Everything above composes these primitives. Authors:
us. This never goes away — it's the substrate the higher rungs assemble.

### Rung 1 — Config-as-data (operator, no deploy). **Shipped.**
Tune existing behavior by changing typed values the operator owns:
`org_policy` (auto-exec floors, caps, agent overrides — Policy tab), **Monitor**
thresholds (sliders), calibration→policy autonomy. No new capability is created;
existing capability is retuned. Author: hotel admin/owner.

### Rung 2 — Natural-language tuning (operator, plain English). **Shipped (heuristic; LLM upgrade in flight).**
Retune the same surfaces in plain English: the Monitors NL box + copilot
`tune_monitor`/`get_monitor_config`, Constraints/Principles authored in NL and
categorized into typed buckets. The operator says it however they like; we map it
to the typed config. Author: hotel admin/owner from anywhere (Ctrl+J).
*Open work:* the real LLM behind the heuristic categorizers
(`OPTIMIZATION-ROADMAP.md` #1) — turns "phrase it our way" into truly NL-native.

### Rung 3 — Automate composer (operator authors NEW automations). **Not built — the next visual step.**
Author a brand-new sense→act loop without code:
> **when** ‹condition over the ontology› **→** ‹effect: a typed tool / action› **→** ‹gate: review, or auto above confidence›

Authored with **NL + a few typed dropdowns**, reusing the existing tool/action
registries and the one gate. This is the AIP **Automate** model — *not* the AIP
**Logic** canvas. It captures most of the "no-code builder" value (operators
create their own monitors/automations, not just retune ours) **without** a
general interpreter or Turing-complete graph. Bounded by construction: conditions
are typed object/threshold predicates (the Monitor grammar), effects are
registered tools/actions, the gate is `decideAutoExecution`. Estimated weeks, not
quarters; every authored automation is safe + audited the day it's created.

### Rung 4 — Full no-code Logic canvas (analyst / power-user). **Demand-gated — future, deliberately not scheduled.**
The Foundry-style visual builder: a block graph (Use LLM · Apply action · Execute
function · Conditionals · Loops · Create variable), a typed variable/data-flow
canvas, a runtime that **interprets the authored graph**, a debugger, versioning
+ releases, eval gates, and cost/loop/permission guardrails. This is a *platform*,
not a feature — a second execution engine alongside the agent runtime, plus the
guardrails to contain user-authored logic. High value for the right customer;
high cost and high blast radius for the wrong one.

---

## Advancement triggers (the part that prevents premature building)

Don't climb a rung because it's impressive. Climb when a trigger fires:

**→ Build Rung 3 (Automate composer) when** *either*:
- operators repeatedly ask "can it also watch ‹X› and do ‹Y›" beyond the fixed
  monitor set (the catalog can't keep up with demand for new automations), **or**
- we're shipping new monitors/detectors via code-deploy faster than ~quarterly
  (i.e., "add an automation" has become a recurring engineering ticket).

**→ Build Rung 4 (full Logic canvas) when** *either*:
- a customer with dedicated ops-engineering / analyst staff explicitly asks to
  author their own multi-step logic (the FDE-style author persona has shown up), **or**
- branching/looping logic the Automate composer *can't* express becomes a
  recurring, named need (not a hypothetical), **or**
- the measured bottleneck becomes "every new automation needs a code deploy" even
  *after* Rung 3 — i.e., Rung 3's bounded grammar is provably too small.

Until a trigger fires, the investment goes **down** the ladder (deepen NL + config),
not up. "Verify before build": don't build a platform for an author who hasn't
arrived.

---

## Non-goals (today)
- Turing-complete user-authored logic / arbitrary code execution.
- A second runtime / graph interpreter — until Rung 4 is demand-triggered.
- Free-form (non-typed) conditions or effects — they break auditability and the gate.
- A visual canvas as a sales demo before a real author persona exists for it.

## Why this wins the market
Palantir's no-code Logic canvas fits customers who staff engineers to use it. Our
buyers don't — so our edge is making **natural language the builder** for a
non-technical operator, on a typed ontology, with every authored change gated and
audited. We climb to Automate-composer and (eventually) a visual canvas as the
author persona matures — pulled by demand, not pushed by speculation. Same moat
Palantir has (authoring on the ontology), reached by the path that fits
hospitality.

## Where each rung lives / related
- Rung 1–2 surfaces: `features/monitors`, `features/constraints`, `features/principles`, `features/mind/PolicyTab`, `features/copilot`; `OrgPolicy` in `packages/reality-graph/src/policy`.
- Rung 0 substrate: `packages/reality-graph/src/{tools,agents,actions,objectives}`; the gate in `constraints/decideAutoExecution`.
- See also: `OPTIMIZATION-ROADMAP.md` (the NL/LLM-categorizer + monitor work that *is* climbing rungs 1–2) and `AIP-RESTRUCTURE.md` (the surface model these author into).
