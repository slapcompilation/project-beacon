# Operations restructure — from a two-row tab maze to a guided workflow

Status: **spec for review, not yet built.** Pilot for the guided "create/run a
workflow" direction (see the sidebar-IA discussion). Companion to
[AIP-UX-RESTRUCTURE.md](AIP-UX-RESTRUCTURE.md).

## The problem

`/operations` is a workspace inside a workspace. A top row of 4 groups (Triage /
Suppliers / Finance / Strategy), each opening its own second row — ~17 surfaces
two clicks deep:

| Group | Sub-tabs |
|---|---|
| Triage | operations · categories · proposals |
| Suppliers | Suppliers · Reliability · Contracts · PO Builder · PO Dispatch · Leverage · Quote Parser |
| Finance | CPOR · Budget · GL · F&B Intel |
| Strategy | Chain · Team · Events |

Two rows of tabs is the symptom of cramming too much into one place. And the
Suppliers row isn't a set of destinations — it's a **procurement workflow in
order** presented as tabs you must already know the sequence of.

## Two principles driving the redesign

1. **Guided > grouped for a sequence.** If steps have a natural order, walk the
   user through them; don't make them memorise which tab comes first.
2. **Decision support > data display.** A passive dashboard nobody acts on is the
   anti-pattern. Surface the *signal that needs a decision* where the operator
   already looks; keep the deep view as a drill-down, not a standing tab.

## The reframe: Operations = one guided procurement flow

```
Triage (home / inbox)
   └─ Procurement workflow:  Find supplier → Vet reliability → Review contract → Build PO → Dispatch
```

- **Triage becomes the landing**, not a peer tab — it's already "what needs
  attention now," i.e. the workflow's inbox. You arrive here.
- **The Suppliers group becomes the guided spine** — five ordered steps, progress
  carried along, the top row gone. Leverage + Quote Parser are *tools within* the
  relevant step (Leverage informs "Review contract"; Quote Parser feeds "Build
  PO"), not peers.
- **Event Demand folds in** — "event → forecast → auto-PO" is itself a procurement
  path; it enters the same spine (a demand-driven variant of Build PO).

The spine is a **map with progress, not a locked wizard**: start at any step, jump
back, it remembers what's done. Real procurement loops (you re-open a contract
after a bad delivery), so nothing is gated on "finishing" a prior step.

## Finance & Strategy: promote the signals, retire the tabs

None of these are procurement steps. They're under Operations only because there
was nowhere else. Per-surface disposition:

| Surface | What it is | Disposition |
|---|---|---|
| **CPOR** | Cost per occupied room — GM P&L KPI | **Signal → Home briefing.** "CPOR €X, +8% vs last week." Click → CPOR detail (kept as a drill-down, not a tab). |
| **Budget Tracker** | Over/under budget with runway | **Signal → Home briefing + Insights.** "18% over F&B budget, 12 days left." Drill-down retained. |
| **F&B Intelligence** | Dish COGS + theft/variance | **Move to Insights** (it's already tagged Eye). A margin/variance lens, reachable from the signal feed. |
| **GL Export** | Month-end accounting export | **Keep as a utility**, reachable from Finance settings / a briefing "period ending" nudge — not a top-level tab (bookkeeper, monthly). |
| **Chain Overview** | "Which property needs me?" | **Move to Home at portfolio scope.** It *is* the chain briefing; it belongs on the scope-aware Home, not buried in Operations. |
| **Team Intelligence** | Per-staff waste attribution | **Move to Insights** (a performance lens) — occasional, not a standing tab. |
| **Event Demand** | Event → forecast → PO | **Fold into the procurement spine** (demand-driven Build PO). |

Net: **no Finance/Strategy tabs.** Their value (the alerts) surfaces where the
operator already looks; their depth stays as drill-downs. Nothing is deleted —
the pages remain as detail views, reached by acting on a signal rather than by
remembering to visit a tab.

## After

- **Operations** = Triage inbox + the 5-step guided procurement spine. One row of
  context, no top-row group menu.
- **Home briefing** gains CPOR / budget / GL-period signals (it already carries
  restock + discrepancy actions — same pattern).
- **Insights** gains F&B margin/variance + Team performance as lenses.
- **Home (portfolio scope)** absorbs Chain Overview.

## Phasing

1. **P1 — Guided procurement spine.** Convert the Suppliers group (+ Event Demand)
   into the guided flow with Triage as the landing. Removes the top row. *This is
   the pilot; everything else can follow.*
2. **P2 — Signal promotion.** Emit CPOR / budget / GL-period signals into the Home
   briefing (reuse the existing briefing-action pattern); wire each to its
   drill-down.
3. **P3 — Lens relocation.** Move F&B Intelligence + Team Intelligence to Insights;
   move Chain Overview to portfolio-scope Home. Retire the Operations Finance/
   Strategy groups.

Each phase stands alone and ships independently. P1 is the highest-leverage — it
kills the two-row menu and proves the guided pattern on live, high-value surfaces.

## Open questions for review

- **CPOR/Budget as signals** — thresholds tunable per org (a monitor), or fixed
  bands to start? (Leans monitor, per the metric/trigger pattern.)
- **Guided spine navigation** — does the operator scrub steps freely (tabs-that-
  remember-order), or is there a "next suggested step" nudge? (Leans: free scrub +
  a soft "next" hint.)
- **Event Demand** — a distinct entry point into the spine, or a mode of Build PO?
