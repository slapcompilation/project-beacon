# Legacy reduction audit — what's dead weight since the AIP shift

Status: **triage, 2026-07**. Companion to `AIP-RESTRUCTURE.md` (the agreed IA
target) and `AIP-UX-RESTRUCTURE.md` (visual parity). This lists modules/features
that the move to the ontology + typed-agent + eval model has left redundant,
duplicated, or stale.

**Discipline:** nothing here is "delete on sight." Each row has a **confidence**
and, where it's a real page, a **verify step** — confirm it's actually unused /
superseded against live data or usage before removing (verify-before-build). The
point of this doc is the triage, not a demolition order.

---

## A. Retired by wiring the sidebar (Phase 1)

| Item | Status | Action |
|---|---|---|
| `components/layout/CommandDock.tsx` (bottom dock) | **Unmounted** — the Foundry `GlobalNav` sidebar replaced it | Keep the file one release for rollback, then delete. Its role-aware quick-actions (Scan, +Stock, Receive) need a new home — a "+ New" affordance in the sidebar or a floating action. |
| The **6-module framing** (Floor/Flow/Eye/Operations/Mind/Briefing) | Superseded by the 4 surfaces (Home/Decisions/Insights/Studio) | Already the `AIP-RESTRUCTURE.md` plan; the sidebar makes it real. |

## B. Duplicate entry points (one surface, two routes)

Every Studio surface is reachable **both** standalone **and** as a `/mind?aip=<tab>`
tab (the `AIPShell` is the canonical container). Two doors to the same room = drift
+ confusion.

| Standalone route | Canonical tab | Action |
|---|---|---|
| `/agent-studio` | `/mind?aip=agents` | Keep standalone only for the **detail** pages (`/agent-studio/:agentName`); redirect the index to the tab. |
| `/tools` | `/mind?aip=tools` | Redirect index → tab; keep `/tools/:toolName`. |
| `/modeling-objectives` | `/mind?aip=objectives` | Redirect index → tab; keep `/:objectiveName`. |
| `/system-map` | `/mind?aip=system-map` | Redirect → tab. |
| `/review-queue` | `/mind?aip=queue` | Redirect → tab. |
| `/pending-approvals` | `/mind?aip=approvals` | Redirect → tab. |
| `/approved-answers` | `/mind?aip=answers` | Redirect → tab. |
| `/entity-link-suggestions` | `/mind?aip=entity-links` | Redirect → tab. |
| `/copilot-config` | `/mind?aip=copilot` | Redirect → tab. |

**Confidence: high** — these are mechanical duplicates. Collapsing to redirects is
safe (deep links keep working).

## C. Pre-AIP bespoke pages — verify, then reduce or retire

Built before the ontology / occupancy-forecast / agent model. Each **needs a
live-data + usage check** before action.

| Route | Why suspect | Verify | Likely |
|---|---|---|---|
| `/graph` (GraphPage) | Superseded by `/system-map` (the AIP System Map) | Is anything still linking to `/graph`? Does it render live? | Redirect → `/system-map` or delete |
| `/causal-chain` + `/chain` | Causality now lives on the object-view revert/trace + the agent `AgentRunTrace` | Are these linked from any object view? | Fold into object-view trace, or retire |
| `/events` (EventDemandPage) | Event-demand predates the occupancy-adjusted forecast + Forecast Lab | Is it wired to live bookings/occupancy, or static? | Reduce into Forecast Lab / Insights, or retire |
| `/fb-intelligence` (FBIntelligencePage) | Bespoke F&B analytics; not an object view or lens | Live data? Used? | Reduce to object-views/lenses under Insights |
| `/menu-mapping` (MenuMappingPage) | Niche mapping tool | Still part of a live workflow? | Keep as an action, or retire |
| `/pending-scans` (PendingScansPage) | Scan reconciliation | Is scanning live in the deployment? | Keep if scanning is active; else stale |

**Confidence: medium** — plausible dead weight, but do NOT delete without the
verify step; some may still be in a live workflow.

## D. Operational utilities — keep, reframe (not modules)

`/stocktake`, `/labels`, `/reminders`, `/pick-lists` — real floor tools. They're
**actions / lenses**, not modules; keep them, surface them as lenses + typed
Actions rather than top-level destinations.

## E. Backend features tied to the old model

| Feature | State | Action |
|---|---|---|
| Legacy SQL detectors `auto_propose_restocks`, `auto_create_alerts`, `generate_preemptive_restocks` | Removed from cron (no-op under pg_cron — `auth_hotel_id()` NULL); still in-app callable, web uses two | The AIP path is `runIntelligenceCycle` + the typed agents. Retire the SQL detectors once the agent path demonstrably covers their cases (eval-backed), not before. |

---

## Suggested order

1. **Delete `CommandDock`** once the sidebar is confirmed in the deployment.
2. **Collapse the Section-B duplicates** into redirects (mechanical, safe).
3. **Triage Section C** with live-data checks; reduce/retire per findings.
4. **Section E** — retire the SQL detectors after the agents' evals cover the gap.

Sections B + A are safe now; C + E are verify-first.
