# AIP-native OPERATE surfaces — the fabric, not the destination

Status: **scoped, 2026-07 — awaiting go on Phase P0.**

> North star (ROADMAP §"The AIP is a destination, not a fabric"): to see what an
> agent concluded about an item, you should not have to *leave the surface where
> that item lives*. The agent's take shows up **on the object** — in the list, on
> the row, in the slide-over — not only in the owner-only Mind tab.

This is ROADMAP **L1 extended from Object Views to the OPERATE list surfaces**
(Floor · Flow). It is deliberately scoped as *reach*, not *rebuild*: the panels
work; what's missing is the agent's intelligence appearing *beside the item*.

## What already exists (the beachheads — do not rebuild)

| Primitive | Where | Gap it leaves |
|---|---|---|
| `ObjectAgentActivity` — agent's recent decisions + open Case on an object | all 4 Object Views (Variant/PO/Supplier/Restock) | **Object views only.** The list surfaces don't show it. |
| `RowIntelStrip` — forecast/waste/par/lead-time inline on a row | Floor → Live Stock only | Shows *computed* intel, **not the agent's proposals**; one surface only. |
| `aip_signal_counts()` RPC — per-**hotel** signal totals | Home tiles | Hotel-level, not **per-item** — can't say "this row has a proposal". |
| ContextPanel copilot (⌘J), selection-aware | omnipresent slide-over | Not yet the landing for a row's inline intelligence. |

So the object-view half of L1 is done. This arc builds the **list-surface half**.

## Definition — a surface is "AIP-native" when, for any item on it:

1. the operator sees **the agent's current take** (open proposals / pending
   decision / open Case) without navigating away;
2. the applicable **rules** (principles / constraints) that shaped it are visible;
3. the operator can **act** — approve / refine / dispatch — in place;
4. the empty state **explains the cycle** ("no open proposals on these items;
   next sweep 07:00 UTC"), never a blank.

## Phases (leverage order — each shippable, each e2e-gated per handbook §2)

### P0 — the per-item signal spine *(foundation; everything consumes it)*
One batched round-trip per list: `aip_signals_for_variants(ids[])` RPC →
`useVariantSignals(variantIds)` returning per-variant
`{ openProposals, pendingDecision, openCaseId, wasteAnomaly }`. Hotel-scoped by
RLS. This is the data all the row affordances read; without it every badge is an
N+1 query.

### P1 — the row badge, on the flagship list first
`AipRowBadge` — the uniform inline affordance (e.g. `◆ 2 proposals`, `⏳ awaiting
you`, `● case open`). Lands on Floor → Live Stock rows (extends the existing
`RowIntelStrip`). Click **opens the item's `ObjectAgentActivity` in the
ContextPanel slide-over** — inline, no navigation. Prove the pattern on the
busiest surface before spreading.

### P2 — spread to every OPERATE list *(mechanical once P0/P1 land)*
Each list maps its rows → variant ids and drops `AipRowBadge` + the slide-over:
- **Floor:** Alerts, Expiry, Locations
- **Flow:** Timeline, Receive, Deliveries, Pick Lists
Supplier/PO rows resolve via *their variants* (the link that has data — same
approach `ObjectAgentActivity` already uses; payload links are 0% populated).

### P3 — the inline act path *(closes the loop on the surface)*
From the slide-over: approve / reject / refine the proposal in place, reusing
`ActionFormModal` + dispatch + the copilot refine flow. The operator sees the
agent's take **and acts on it** without ever leaving Floor/Flow. This is the
moment "destination → fabric" becomes literally true.

### P4 — the ambient copilot binds to the row selection
Ensure the ContextPanel copilot is scoped to the item the operator is looking at
(passes that node id into its tools) — the "selection-aware copilot" the UX
non-negotiables call for, realised on the OPERATE surfaces.

## Explicitly out of scope (kept honest)

- No visual rebuild of the panels (that's a separate, sign-off-gated arc).
- No change to the copilot's model or the agents themselves.
- No supplier/PO payload-link backfill — the variant-link workaround suffices.
- Not touching Decisions/Studio — those are already AIP-native.

## Sequencing & risk

P0 → P1 first (foundation + one proof). Reassess after P1: if the row badge +
slide-over feels right on Live Stock, P2 is a fast mechanical spread; if not, we
adjust the primitive once, cheaply, before it's on nine surfaces. P3/P4 follow.
Each phase is its own PR with an e2e that asserts the badge renders and the
slide-over opens — the surface-verification rule that caught the map regressions.
