# Automate composer (Rung 3) — spec + trigger watch

Status: **spec only — demand-gated.** Not scheduled. This records (1) the signals
we're watching that would justify building it ("let it bake"), and (2) a
shovel-ready design so that when a trigger fires we build, not re-debate.

See `AUTHORING-STRATEGY.md` for the ladder. Rungs 1–2 (config-as-data + NL
tuning) are shipped and LLM-backed. Rung 3 is the first time operators author a
**new** sense→act loop, not just retune an existing one. Rung 4 (full visual
Logic canvas) stays far out.

---

## Part 1 — Let it bake: the signals that trigger this build

We don't build on a hunch; we build when one of these is observably true. Each
notes where the signal lives today so "baking" has success criteria, not vibes.

| Trigger | What we'd see | Where the signal is |
|---|---|---|
| **Catalog can't keep up** | operators repeatedly want "watch ‹X›, do ‹Y›" beyond the 4 fixed monitors | qualitative (sales/support notes); add a one-click "request an automation" capture if it recurs |
| **Automation = code deploy** | we ship new detectors/monitors via PR more than ~quarterly | `git log` over `packages/reality-graph/src/monitors` + `supabase/functions/intelligence-cycle` |
| **NL authoring is actually used** | constraints/monitors authored per active org trending up; LLM-fallback hit-rate non-trivial | `select count(*) … from constraints` / `org_policy` deltas; add a counter to `aiCategorizer`/`aiTune` fallback if we want the rate |
| **Operators tune, don't just accept** | high edit/refine rate on monitor thresholds + constraints | `org_policy` update frequency; constraint create/deactivate churn |

**What "baked" looks like:** rungs 1–2 are *used* (operators tune monitors +
author constraints in NL without us), and the catalog-can't-keep-up or
code-deploy-bottleneck trigger has fired. Until then, invest *down* the ladder
(deepen NL: the real-LLM categorizers shipped in #207/#219 are exactly this).

If none of these fires, **that is a valid outcome** — it means rungs 1–2 cover
the real authoring need, and Rung 3 would have been over-build. Don't force it.

---

## Part 2 — The design (when a trigger fires)

The Automate composer lets an operator author:

> **when** ‹condition over the ontology› **→** ‹effect: a typed tool/action› **→** ‹gate: review, or auto above confidence›

in **NL + a few typed dropdowns** — the AIP **Automate** model, *not* the AIP
Logic canvas. Bounded by construction: it composes things that already exist.

### Data model — `Automation`
A typed config row (new `automations` table; richer than a monitor, so not folded
into `org_policy`):

```ts
interface Automation {
  id: string
  hotelId | organizationId        // scope, RLS-checked
  name: string
  enabled: boolean
  cadence: 'on-event' | 'daily'   // rides runIntelligenceCycle for 'daily'
  condition: AutomationCondition   // typed predicate (the Monitor/Constraint grammar)
  effect:    AutomationEffect      // a registered tool or BeaconAction type + bound params
  gate:      'review' | 'auto'     // 'auto' still passes decideAutoExecution
  createdBy: string                // audit
}
```
- **condition** reuses the bounded typed grammar we already have (metric + threshold from monitors; `field/op/value` from the constraint typed-rule). No free-form predicates — that's what keeps it auditable.
- **effect** is a pick from the **Action Registry** (`BeaconAction` types) or the **tool registry** — never arbitrary code.

### Reuse map — ~80% already exists
| Need | Reuse |
|---|---|
| Condition grammar | `monitors` metric/trigger + `constraints` typed-rule (reality-graph) |
| Effects | `BeaconAction` registry + dispatch; Logic Tool registry |
| The gate | `decideAutoExecution` (one gate, no second one) |
| Unattended run | `runIntelligenceCycle` — compose automations as sweeps, exactly like the expiry monitor sweep (#208) |
| NL → typed | the `agent-llm` categorizer pattern (`aiTune.ts` / `aiCategorizer.ts`) |
| Where effects land | Decisions inbox / Cases |
| Validation | the tool-I/O validator (#217) + clamp-on-parse |

### New surface (the ~20%)
- `automations` table + RLS + the typed model + a small **automation runner**: condition → candidates → typed proposal → `decideAutoExecution` → Decisions. Structurally identical to `runExpiryMonitorCycle`.
- **Composer UI** (Studio → Automations): list + "New automation" → NL box ("when a supplier's reliability drops below 5, open a review case") → LLM parses to a typed `{condition, effect, gate}` → operator reviews/adjusts via dropdowns → save. Mirrors the Monitors/Constraints authoring flow.
- Compose the runner into `runIntelligenceCycle` for `cadence:'daily'` (unattended), gated by `enabled`.

### Safety
- Typed conditions + registry effects only; no free-form, no arbitrary execution.
- Every effect routes through `decideAutoExecution`; a new effect type can't auto-execute unless its action type is in the auto-exec policy (default → review).
- Full audit (`createdBy`) + trace; automations are listable/toggleable; an authored automation is safe + observable the day it's created.

### Build slices (when triggered)
- **S1** — reality-graph: `Automation` types + the pure runner (condition→effect→gate) + tests. Migration: `automations` table + RLS.
- **S2** — NL composer (`agent-llm` → typed `Automation`, clamped) + Studio Automations tab (list/create/typed-preview, admin/owner).
- **S3** — compose into `runIntelligenceCycle` (unattended), one loop two callers.
- **S4** — per-automation observability (last-fired, fired/proposed/auto counts) + an eval hook.

### Non-goals (still Rung 4, not here)
- Branching / loops / variables / multi-step graphs (that's the visual Logic canvas).
- Arbitrary effects beyond the registry; free-form conditions.
- Multi-step action chains — `Action Chains` already exist as a separate primitive.

---

## One-line summary
Rung 3 is "the monitor pattern, but the operator picks the condition *and* the
effect." It's mostly wiring existing primitives behind an NL+dropdown composer —
deliberately *not* a programming environment. Build it when operators outgrow the
fixed catalog; until then, baking rungs 1–2 is the correct investment.
