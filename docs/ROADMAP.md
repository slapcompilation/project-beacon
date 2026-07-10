# Beacon Roadmap — connecting the AIP to the rest of the product

> North star: replicate Palantir AIP for hospitality. The reality-graph
> (ontology + tools + actions + agents) is the substrate; everything operators
> touch should sit *on top of* it, not beside it.

## The problem this roadmap solves

The engine is right but the surfacing isn't. Today the app has **five dock
surfaces** (`apps/web/src/components/layout/CommandDock.tsx`):

| Surface | Audience | Role |
|---|---|---|
| Canvas (Briefing) | manager+ | act-now home |
| Floor | everyone | stock / alerts / expiry |
| Flow | manager+ | restocks / receiving / approvals |
| Eye | manager+ | waste / occupancy / performance |
| **Mind** | owner/admin | the **entire** AIP (18-tab rail) |

Two consequences, both felt as "the AIP is chaotic and disconnected":

1. **The AIP is a destination, not a fabric.** Intelligence is walled into a
   5th, owner-only tab. To see what an agent concluded about an item you leave
   the surface where that item lives. In AIP the agent's take shows up *on the
   object*. (Partially done already — `VariantObjectPage` shows "Recent Agent
   Decisions" inline — but not on Supplier / PO / Restock.)
2. **The Mind rail mixes audiences + a whole second app.** Its 18 tabs span a
   daily-driver inbox (Queue / Approvals / Cases), an infrequent builder studio
   (Agents / Tools / Objectives / Scenarios / Policy / Copilot), the flywheel
   (Documents / Entity Links / Approved Answers / Principles / Constraints), and
   *all of hospitality procurement/finance* demoted to one "Operations" entry.

## The model to hold

One operational app with an intelligence fabric woven through it, plus a
builder's studio:

```
OPERATE  (Floor · Flow · Eye · Canvas)      where work happens; AIP surfaces HERE
   │  emits triggers (low stock, surplus, expiry)
   ▼
[ reality-graph fabric: tools → agents → actions ]   the engine, ambient
   │  produces typed proposals + traces
   ▼
DECIDE   (Review Queue · Approvals · Cases)  the ONE inbox where verdicts converge
   │  operator approves / edits / rejects / teaches
   ▼
BUILD    (Agents · Tools · Objectives · Policy · Knowledge)   tunes the fabric
   └────────────────── feeds back into the fabric ───────────────┘
```

The "connection" operators can't see *is* this loop. **Cases** is the node that
makes it legible — it ties trigger → trace → proposals → outcome — and it is the
spine the current UI is missing.

## Phases

### Phase L — Make the connection visible *(highest leverage)*
- **L1 · Inline intelligence on every Object View.** Extend the Variant page
  pattern to Supplier / PO / Restock: open proposals touching the node, the
  agent's last take, applicable principles/constraints in the right rail.
- **L2 · Wire Cases.** Every cycle run that *queues* a proposal opens or reuses a
  per-variant Case (trigger → proposals → outcome). Surface the Case link on the
  proposal and the object. Auto-executed actions stay audited via StockLog, not
  Cases. *(Done — verified live: cron queues → one Case per variant-situation,
  system-authored, deduped; surfaced on the variant + proposal pages.)*
- **L3 · One home.** Kill the Canvas-vs-Command overlap; a single "N decisions
  waiting" cockpit.

### Phase M — Tame the Mind rail *(the "chaotic" complaint)*
- **M1** · Split Mind into **Decisions** (Queue/Approvals/Cases) vs **Studio**
  (everything builder-y). Stop interleaving daily triage with monthly config.
- **M2** · Promote **Operations** out of Mind — a whole app shouldn't be a
  sub-tab of the AI tab. Its panels belong in Flow (procurement) and Eye (gl /
  invoicing), or its own dock surface.
- **M3** · Collapse thin Shape tabs (Scenarios, Action Chains, Objectives,
  Copilot) under one Studio landing with cards, not five rail entries.

### Phase N — Feed the empty surfaces honestly *(the data wall)*
- **N1** · Documents + Entity Links need the real OCR/embed ingest, or an empty
  state that explains the cycle. Bare rows read as broken.
- **N2** · Gate Modeling Objectives behind ≥1 objective — it's an empty showroom
  until a baseline is beaten.

### Phase O — Close the flywheel loop *(polish what works)*
- **O1** · Show principle citations in the operator slide-over ("this followed
  your principle: …") so the operator feels the system learned.
- **O2** · Auto-suggest TeachRule on reject — route rejections back as candidate
  Principles / Approved Answers.

## Sequencing

L1 + L2 first (they dissolve "disconnected" and Cases is the missing spine),
then M (reorganize once the loop is visible), then N + O as cleanup.

---

# Beyond AIP parity — the durable moats

L–O made the AIP legible. The next arc is what makes Beacon *defensible for years*:
the model is a commodity; the moat is the **learned ontology + the compounding
outcome flywheel + the network**. Framed as three pillars. The reframe:
Beacon isn't "AI for hospitality" — it's the **system of record for operational
decisions** a business can safely delegate to and that gets measurably better.

## Pillar 1 — Calibrated autonomy (the trust budget)
Autonomy you can *prove* is safe to delegate. *(PR #166)*
- **P1 · Decision calibration** — does a stated confidence match reality?
  Per-band hit-rate, ECE, Brier, verdict; honest about thin / single-class data.
  Surfaced under Studio → Calibration. *(done)*
- **Copilot honors the Mind rules** — the Canvas copilot now injects active
  Principles + Constraints and has a calibration tool, so it advises within the
  same rules the agents obey. *(done — needs edge-fn deploy)*
- **P2 · Trust budget** — `decideAutoExecution` extended (no second gate): a
  proven-overconfident agent is queued even above the static floor;
  `require_calibration` demands proven calibration. Policy toggle + Run-cycle +
  cron wired. *(done — cron needs edge-fn deploy)*

## Pillar 2 — Self-evolving ontology
The graph proposes its own growth, under review — never a runtime schema mutation. *(PR #167)*
- **Q1 · Gap detection** — `detect_ontology_gaps` finds typed concepts the data
  carries but the ontology doesn't (free-text `removal_category`), with evidence
  + confidence. *(done)*
- **Q2 · Approve → grow** — operator approval persists in `ontology_proposals`
  (migration 163, audited, hotel-scoped RLS); approved values become recognized
  types the detector stops re-proposing. *(done)*
- **Q3 (next)** — consume approved categories in the WRITE_OFF action (typed
  dropdown); add detectors for untyped *edges* and missing *computed properties*.

## Pillar 3 — Federated network *(not started)*
Benchmarking is a property of the network, not a feature.
- **R1** — intra-org cross-property benchmarks (topology already exists).
- **R2** — privacy-preserving cross-customer signal (supplier reliability,
  demand patterns, price) via differential privacy / federation. The compounding
  data-network moat. *Design the privacy boundary before the first cross-tenant read.*

---

# Optimization backlog (harden what shipped)

Ranked by leverage.

| # | Item | Why |
|---|---|---|
| A1 | **CI auto-deploy of edge functions** — regen bundle from source + `supabase functions deploy` on merge to main | Kills the recurring manual deploy + stale-bundle pain. *(in progress)* |
| A2 | **Bundle as a build step** — `pnpm build:edge-bundle` + a PR drift check | No hand-typed esbuild; no silent source↔deployed drift |
| A3 | **Consume the grown ontology** — wire approved `removal_category` into WRITE_OFF | *(shipped 2026-07)* both write-off surfaces consume approved categories; loop exercised live + gated by `e2e/ontology-loop.spec.ts` |
| A4 | **Calibration label fidelity** — partial credit for edited-then-approved; time-decay | *(shipped 2026-07)* HONEST_LABEL_OPTIONS consumed by BOTH gates (web cycle + cron) + copilot tool + Studio display — one label reality everywhere |
| A5 | **Copilot: enforce, not just inform** — server-side constraint eval on copilot proposals | *(shipped 2026-07)* per-item paths were already guarded (hardViolationsFor + annotateProposals backstop + guardrail eval); the batch-approval path — where spend/time rules bite — now evaluates each request and drops hard violators with reasons |
| A6 | **Flywheel observability** — ECE trend, ontology-growth, copilot rule-citation events + a dashboard | Can't manage (or sell the proof of) what you can't see |
| A7 | **Behavior evals** — calibration-veto agent eval; rubric that the copilot refuses a violating ask | Unit tests exist; behavior evals are the AIP "production" bar |
| A8 | **Typed lifecycles** — stateful nodes declare legal transitions; action submission rejects illegal ones | *(shipped 2026-07)* LIFECYCLES in reality-graph + enforce_lifecycle trigger on 4 tables (migration 197/198); illegal transitions refused with derived context at the DB boundary |
| A9 | **Surface verification in CI** — Playwright smoke on decision-critical pages + post-deploy bundle check | *(shipped 2026-07)* `web-smoke.yml` (regression-proven against #314) + `deploy-verify.yml` (beacon-build meta vs HEAD) |
| A10 | **Ontology presentation metadata** — per-type icon/title property, per-property tooltip descriptions | Onboarding becomes a property of the graph (§3) |

---

# Directional bets (trigger-gated — watch, don't grind)

Recommendation: keep these on the roadmap but **gate each behind a trigger**, not a
date. Build the moat work (Pillars) + the optimization backlog on a schedule;
pull a bet forward only when its trigger fires. Re-rank quarterly using the
product's own outcome data — let the flywheel tell you which bet to fund.

| Bet | Build when (trigger) | Note |
|---|---|---|
| **Provable / auditable autonomy** (export audit, "explain this action", compliance attestations) | A regulated or enterprise prospect asks "prove why it acted" | You're already 80% here (decision ledger + calibration). Formalize on first ask. **Commit-leaning.** |
| **Outcome-based pricing / ROI accounting** (waste prevented, stockouts avoided, hours saved) | Before the next pricing conversation | Both a feature and a GTM wedge; the ledger already has the data. **Commit-leaning.** |
| **Federated network (Pillar 3 R2)** | ≥ ~3 paying multi-property customers | Premature before density; design privacy now, build later |
| **Decision digital-twin / simulation** | Operators trust the core loop + ask "what if" | Scenarios are the seed; extend once autonomy is trusted |
| **Multimodal ingestion → ontology** (invoices, contracts, shelf-cam, cold-storage IoT) | A customer's value hinges on a non-text source | The gap-detector is the on-ramp for auto-typing the flood |

**How to follow it:** treat *Pillars + Optimization backlog* as the committed plan
(sequence: finish Pillar 1 deploy → A1/A3 → Q3 → Pillar 3 when its trigger fires).
Treat *Directional bets* as a watchlist reviewed each quarter. The two
commit-leaning bets (auditable autonomy, ROI accounting) are cheap given what's
built and double as sales leverage — promote them the moment a customer
conversation calls for either.
