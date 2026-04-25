# ARCHITECTURE-STATE.md

**Generated:** 2026-04-23
**Purpose:** Pre-restructure snapshot. Temporary working doc — delete after Phase R1 lands.
**Scope:** What Beacon is *today* vs what the revised end product demands (Foundry + AIP + Gallatin).

---

## 1. Headline Numbers

| Dimension | Count | Notes |
|---|---:|---|
| Migrations applied/written | 109 | Last: `109_contract_intelligence.sql` |
| Tables (public schema) | 29 | All `hotel_id`-scoped; none `organization_id`-aware |
| RLS policies using `auth_hotel_id()` | 326 | Every one needs org-aware extension |
| SQL RPCs | 40+ | Mix of Tier 1 deterministic + agent-like + CRUD helpers + triggers |
| Cron jobs | 4 | `beacon-intelligence-cycle` (15min), PAR (weekly), price drift (weekly), POS variance (daily) |
| Edge functions | 12 | 3 LLM-powered (`ai-brief`, `copilot-chat`, `parse-shelf-photo`), 7 ingest/webhook, 2 utility |
| Frontend pages | 79 | 4 workspaces (Floor/Flow/Eye/Mind) + object detail pages + utilities |
| Feature modules | 22 | 224 exported hooks; all use `useActiveHotelId()` |
| Zustand stores | 2 | Clean separation: auth (derived) + UI (persisted) |
| Reality Graph nodes | 5 | `variant`, `restock_request`, `purchase_order`, `supplier`, + edge definitions |
| `BeaconAction` types | 15 | Flow (5), Floor (3), Mind (6), + revert |
| Raw `.from()` calls in pages/components | 14 files | Action-registry violations — must migrate to feature API |
| Files with `// Layer:` comment | 163/180 | Excellent coverage |
| Agent-like workflows (any shape) | 21 | Cron (7), event trigger (5), LLM edge (3), keyword router (1), user-action wrappers (5) |
| `*.eval.ts` files | 0 | **Critical gap** — no agent has an eval suite |

---

## 2. What We Have (Current State Snapshot)

### 2.1 Database — strengths
- Clean hotel-scoped RLS pattern (`hotel_id = auth_hotel_id()`) repeated consistently.
- Immutable audit tables (`stock_logs`, `action_history`, `webhook_deliveries`, `proposal_outcomes`).
- `relationship_edges` table exists with typed edge vocabulary (migration 018).
- Reality Graph infrastructure is materialized, not just aspirational.
- Autonomy guardrails are per-hotel config: `auto_approve_threshold`, `auto_invoice_tolerance_pct`, escalation timeouts.
- Feedback loop in place: `proposal_outcomes` + `variant_learned_thresholds` (migration 104).
- Demand sensing is fully wired (occupancy_logs → booking_forecasts → get_occupancy_adjusted_forecast → generate_preemptive_restocks).

### 2.2 Database — gaps
- **No `organizations` table.** Every hotel is currently its own island.
- **Edge type CHECK constraint in migration 018 is stale:** declares 8 types, code uses 14. Seven edges (`approved_by`, `rejected_by`, `fulfills`, `sourced_from`, `linked_to_po`, `invoiced_by`, `discarded_via`) will violate the constraint if written. Must be fixed.
- **No agent registry table.** Agents are implicit in cron jobs, triggers, and edge functions.
- **No `action_proposals` table.** LLM outputs from `copilot-chat` are structured blobs returned inline, not persisted as typed proposals.
- **No `stock_transfers` table.** `TRANSFER_STOCK` action is declared in reality-graph but has no DB-level transfer record with from/to hotels.

### 2.3 Frontend — strengths
- Layer comments (`// Layer: Floor|Flow|Eye|Mind`) on 163/180 files.
- Action registry works end-to-end for the 15 declared actions.
- `useActiveHotelId()` scoping is the boundary pattern — honored consistently in feature hooks.
- Zustand is UI-only; TanStack Query owns server state. No duplication.
- 22 feature modules cleanly follow the `api/` + `hooks/` + (sometimes) `components/` split.
- 4-workspace routing pattern (Floor/Flow/Eye/Mind with `?panel=X`) is a strong shape for multi-tenant expansion.

### 2.4 Frontend — gaps
- **14 files in `apps/web/src/pages/` and `components/` make raw `.from()` calls.** Biggest violators: `VariantObjectPage`, `SupplierObjectPage`, `POObjectPage`, `AlertObjectPage`, `CausalTracePanel`, `EyeCopilotPage`.
- **AI transparency UI is ad-hoc per page.** `SmartProposalsPage` has the richest pattern; `EyeCopilotPage` has tool traces; `CausalTracePanel` does graph walks. No shared `AgentProposalCard` / `TransparencyPanel` / `ConfidenceGauge` / `ReasoningTrace` component library.
- **No portfolio switcher in Topbar.** `activeHotelId` exists in the store but only surfaces as a settings-level selector.
- **No org-scope or role tier above `hotel_admin`.** Role union: `owner | admin | team_member | limited_access`.
- **Navigation is layer-first, not cycle-first.** There's no Briefing-as-home for directors, no "decision window" framing on agent output pages.

### 2.5 Agent stack — strengths
- ~70% of current agents are already proposal-driven (they create notifications or `is_auto_proposed=true` restocks, not direct mutations).
- Cron coverage is tight: intelligence cycle every 15min, PAR Sunday, price drift Monday, POS variance daily.
- Critical stockouts have an instant event-trigger path (`trg_critical_stockout`).
- Guardrails are layered: cost thresholds, confidence ≥0.5, ≥3-sample data requirements, opt-in auto sources (`par_source='auto'`, `lead_time_source != 'manual'`).
- Three LLM edge functions exist: daily brief (Claude Haiku), copilot chat (Sonnet w/ tool use), photo shelf parser (GPT-4o Vision).

### 2.6 Agent stack — gaps
- **No agents are formally named as agents.** They're SQL functions with `auto_*`, `detect_*`, `run_*` prefixes.
- **No `agents` registry table** declaring purpose/scope/cadence/tool_set/approval_boundary/eval_path.
- **Zero eval suites.** No `*.eval.ts` exists anywhere.
- **LLM proposals aren't typed `BeaconAction`s.** `copilot-chat` returns JSON blocks with `type="action_proposal"` but these are rendered ad-hoc in the UI, not dispatched through the action registry.
- **Feedback loop is partially wired.** `proposal_outcomes` + `variant_learned_thresholds` exist, but `notifications.dismissed_reason` is collected and not yet consumed into threshold learning for most alert types.

---

## 3. Classification Table

Every significant artifact gets one of: **KEEP** / **RENAME** / **ABSORB** / **DEPRECATE** / **NEW**.

### 3.1 Database tables

| Table | Disposition | Notes |
|---|---|---|
| `hotels` | **KEEP** + extend | Add `organization_id` FK |
| `organizations` | **NEW** | Phase R1 migration 110 |
| `user_hotel_memberships` | **KEEP** + extend | Add `user_org_memberships` companion for org-level roles |
| `profiles` | **KEEP** + extend | Role union gets `org_director`, `regional_manager` |
| Core inventory (products, product_variants, categories, locations, stock_logs, etc.) | **KEEP** | No schema change; RLS policies extended to allow org-level reads |
| `restock_requests`, `restock_receives` | **KEEP** | |
| `suppliers`, `supplier_contracts` | **KEEP** + extend | Contracts gain optional `organization_id`; resolution order hotel-overrides-org |
| `purchase_orders`, `purchase_order_lines`, `po_invoices`, `po_discrepancies` | **KEEP** | |
| `delivery_events` | **KEEP** | |
| `occupancy_logs`, `booking_forecasts`, `events` | **KEEP** | |
| `notifications` | **KEEP** | Type constraint needs audit (see §4.1) |
| `relationship_edges` | **KEEP** + **FIX** | CHECK constraint must be expanded to include all 14 edge types actually used in code |
| `stock_transfers` | **NEW** | Phase R1 migration 112 (inter-property lateral movement) |
| `action_proposals` | **NEW** | Phase R2 migration 113 (typed LLM/agent outputs) |
| `agents` (registry) | **NEW** | Phase R2 migration 114 (declared purpose/scope/cadence/tools/approval/eval) |
| `variant_embeddings` | **KEEP** | Possibly retrain at org-corpus scope later |
| `webhook_endpoints`, `webhook_deliveries` | **KEEP** | |
| `proposal_outcomes`, `variant_learned_thresholds` | **KEEP** | Excellent feedback-loop primitives |
| `alert_preferences` | **KEEP** + extend | Per-hotel today; optionally per-org defaults |
| `pms_connections` | **KEEP** | |
| `saved_reports`, `product_custom_field_defs`, `stocktake_sessions`, `stocktake_lines`, `variant_cost_history`, `gdpr_erasure_requests`, `action_history` | **KEEP** | |

### 3.2 SQL RPCs (representative classification — full list in audit output)

| Current name | Category | Disposition | Target name (if rename) |
|---|---|---|---|
| `run_intelligence_cycle` | Agent orchestrator | **RENAME** | `run_portfolio_agent_cycle` |
| `auto_create_alerts` | Tier 1 detector + fan-out | **RENAME** | `anomaly_detection_agent` |
| `auto_propose_restocks` | Agent (proposes) | **RENAME** | `weekly_restock_agent` (output → `action_proposals`) |
| `generate_preemptive_restocks` | Agent (proposes) | **ABSORB** | Merge into `weekly_restock_agent` as a demand-spike branch |
| `detect_expiring_contracts` | Agent (alerts) | **RENAME** | `contract_renewal_agent` |
| `detect_po_discrepancies` | Agent (flags) | **RENAME** | `three_way_match_agent` |
| `escalate_stale_approvals` | Tier 1 state machine | **RENAME** | `approval_timeout_agent` |
| `auto_approve_eligible_restocks` | Agent (executes) | **RENAME** | `restock_auto_approval_agent` |
| `auto_approve_matched_invoices` | Agent (executes) | **RENAME** | `invoice_auto_approval_agent` |
| `apply_optimal_par` | Agent (learner + writer) | **RENAME** | `par_learning_agent` |
| `learn_supplier_lead_times` | Agent (learner + writer) | **RENAME** | `lead_time_learning_agent` |
| `detect_and_alert_price_drift` | Agent (alerts) | **RENAME** | `price_drift_agent` |
| `detect_and_alert_pos_variance` | Agent (alerts) | **RENAME** | `pos_variance_agent` |
| `detect_consumption_spike` (trigger) | Event-driven agent | **RENAME** | `consumption_spike_agent` |
| `sync_event_to_booking_forecast` (trigger) | Tier 1 signal bridge | **KEEP** | Not agent-shaped; pure data sync |
| `trg_critical_stockout` | Event-driven agent | **RENAME** | `critical_stockout_agent` |
| `trg_auto_close_po` | Tier 1 state machine | **KEEP** | Pure state logic, not agent-shaped |
| `classify_restock_tier` (trigger) | Tier 1 router | **KEEP** | |
| `compute_proposal_outcomes` | Agent (learner input) | **RENAME** | `proposal_scoring_agent` |
| `update_learned_thresholds` | Agent (learner writer) | **RENAME** | `threshold_learning_agent` |
| `get_smart_proposals` | Tier 1 deterministic | **KEEP** | Already the right shape |
| `compute_optimal_par` | Tier 1 deterministic | **KEEP** | |
| `get_contract_price` | Tier 1 deterministic | **KEEP** | |
| `get_occupancy_adjusted_forecast` | Tier 1 deterministic | **KEEP** | |
| `adjust_stock`, `receive_restock`, `batch_stocktake`, `transfer_stock`, `begin_stocktake`, `commit_stocktake`, `cancel_stocktake`, `undo_stock_adjustment` | CRUD helpers (action dispatch targets) | **KEEP** | |
| `update_hotel_profile`, `update_member_role`, `remove_team_member` | CRUD helpers | **KEEP** + extend for org scope |
| `create_relationship_edge`, `get_variant_flow` | Graph operators | **KEEP** | |
| `auto_create_restock_po` | User action executor | **KEEP** | Rename later to fit `BeaconAction` dispatcher pattern |
| `get_chain_benchmarks` | Deterministic (currently hotel-pair) | **ABSORB** | Fold into broader org-scoped benchmark RPCs in Phase R4 |

### 3.3 Edge functions

| Function | Disposition | Notes |
|---|---|---|
| `ai-brief` | **RENAME** to `daily_brief_agent` | Becomes Tier 3 agent; output typed |
| `copilot-chat` | **RENAME** to `operations_copilot_agent` | Tool-calling agent; proposals become `action_proposals` rows |
| `parse-shelf-photo` | **RENAME** to `shelf_vision_agent` | Proposals → `action_proposals` queue |
| `parse-invoice` | **RENAME** to `invoice_ocr_agent` | Same pattern |
| `smart-import` | **KEEP** | Utility, not an agent |
| `mews-webhook`, `square-webhook`, `ingest-occupancy`, `ingest-pos` | **KEEP** | Ingest adapters — stay Tier 1 |
| `fire-webhooks` | **KEEP** | Outbound infra |
| `compute-similar-variants` | **KEEP** | pgvector corpus builder |
| `invite-member` | **KEEP** | |

### 3.4 Frontend pages

| Category | Pages | Disposition |
|---|---|---|
| **Briefing entry points** | `BriefingPage`, `DashboardPage`, `MonitorPage` | **RENAME/ABSORB** → single `Briefing` at `/` with org-scope and hotel-scope variants |
| **Agent inboxes** | `SmartProposalsPage`, `AlertsPage`, `NotificationsPage`, `ContractsPage`, `WasteRadarPage`, `PredictiveRestockPage`, `POMatchPage`, `ParOptimizerPage`, `PendingScansPage` | **RENAME** to `<Agent>InboxPage`; share `AgentInbox` component with cadence/window/next-run header |
| **Workspaces** (Floor/Flow/Eye/Mind with `?panel=`) | `FloorWorkspace`, `FlowWorkspace`, `EyeWorkspace`, `MindWorkspace` + their panels | **KEEP** pattern; reshape individual panels into agent inboxes where applicable |
| **Object detail pages** | `VariantObjectPage`, `SupplierObjectPage`, `POObjectPage`, `RestockObjectPage`, `ProductObjectPage`, `StockLogObjectPage`, `AlertObjectPage`, `ShiftHandoverObjectPage` | **KEEP** + fix raw `.from()` violations |
| **Copilot** | `EyeCopilotPage` | **RENAME** to `CopilotAgentPage`; route tool calls through action registry |
| **CRUD / entity mgmt** | `SuppliersPage`, `SupplierBrowserPage`, `TeamPage`, `LabelsPage`, `PickListsPage`, `LocationInventoryPage`, `MenuMappingPage`, `SavedOrdersPage` | **KEEP** |
| **Integration / admin** | `SettingsPage`, `SetupWizardPage`, `GLExportPage` | **KEEP** |
| **Transactional** | `ReceivePage`, `PurchaseOrderPage`, `ScanPage`, `StocktakePage`, `PhotoStocktakePage`, `VoiceModePage`, `ARPreviewPage`, `InvoicingPage` | **KEEP** |
| **Audit / history** | `AuditPage`, `FlowTimelinePage`, `CausalChainPage` | **KEEP** |
| **Analytics** | `CategoryIntelligencePage`, `TeamIntelligencePage`, `ProductPerformancePage`, `SupplierReliabilityPage`, `CPORDashboard`, `BudgetTrackerPage`, `OccupancyForecastPage`, `EventDemandPage`, `FBIntelligencePage`, `StocktakeIntelligencePage`, `IncidentCorrelationPage`, `SimulationCockpitPage`, `UnifiedSignalsPage`, `NegotiationPrepPage`, `ProcurementLeveragePage`, `AdaptivePARPage` | **KEEP** — these are the Mind/Eye analytical surfaces |
| **Chain/portfolio** | `ChainPage` | **ABSORB** → reshape into org-scope Briefing in Phase R1 |
| **Deprecated redirects** | 20+ legacy routes currently redirect to `/floor?panel=`, `/flow?panel=`, etc. | **DEPRECATE** | Remove after navigation rework |
| **Graph explorer (experimental)** | `GraphPage` | **KEEP** as dev tool |
| **Login** | `LoginPage` | **KEEP** |
| **Setup** | `SetupWizardPage` | **KEEP** + extend for org creation |
| **Portfolio switcher** (Topbar) | — | **NEW** component in Phase R1 |
| **Transfer inbox / action page** | — | **NEW** for `TRANSFER_STOCK` approvals in Phase R1 |

### 3.5 Reality Graph nodes & actions

| Artifact | Disposition |
|---|---|
| `variantNode`, `restockRequestNode`, `purchaseOrderNode`, `supplierNode` | **KEEP** + extend with org-scope helpers |
| `organizationNode` | **NEW** — Phase R1 |
| `stockTransferNode` | **NEW** — Phase R1 |
| `actionProposalNode` | **NEW** — Phase R2 |
| `agentNode` | **NEW** — Phase R2 |
| `BeaconAction` union (15 types today) | **KEEP** + extend | Add `TRANSFER_STOCK`, `APPROVE_TRANSFER`, `APPROVE_ACTION_PROPOSAL`, `REJECT_ACTION_PROPOSAL` |
| Edge type vocabulary | **KEEP** + extend | Add `belongs_to_org`, `transfers`; fix schema constraint mismatch |

### 3.6 Frontend infrastructure

| Artifact | Disposition |
|---|---|
| `useActiveHotelId()` | **KEEP** | Boundary pattern works |
| `useActiveOrgId()` | **NEW** | Sibling hook for org-scoped queries |
| `auth.store` | **KEEP** + extend | Add `orgIds`, `primaryOrgId`, `scope: 'hotel' \| 'org'` |
| `app.store` | **KEEP** + extend | Add `activeOrgId` persisted field |
| Feature module shape (`api/` + `hooks/`) | **KEEP** | Works well; continue |
| Raw `.from()` in pages/components (14 files) | **DEPRECATE** | Migrate each call to a feature API hook as part of Phase R1 prep |
| Ad-hoc AI transparency components | **ABSORB** | Build shared `@beacon/ui` library: `AgentInbox`, `AgentProposalCard`, `ConfidenceGauge`, `ReasoningTrace`, `DecisionWindow`, `CadenceBadge`, `NetworkBenchmarkCell` |

### 3.7 Agent-like workflows (the big reshape)

All 21 cataloged workflows become formally-declared Tier 3 agents. Every one gets:
1. A row in the `agents` registry table with `name`, `scope`, `cadence`, `tool_set[]`, `approval_boundary`, `eval_path`.
2. An `*.eval.ts` with ≥10 historical cases (backfilled from production data).
3. Output shape: writes to `action_proposals` for anything non-trivial; direct mutation preserved only for state-machine agents (`approval_timeout_agent`, `po_auto_close_agent`) and append-only alert fan-out.
4. Transparency: every proposal stores `{ nodes_considered, tools_called, confidence_basis, rationale }`.

### 3.8 Cron jobs

| Job | Disposition | Notes |
|---|---|---|
| `beacon-intelligence-cycle` (15min) | **RENAME** | → `beacon-portfolio-agent-cycle`; still orchestrates sub-agents but now reads from `agents` registry |
| `beacon-weekly-par-update` (Sun 04:00) | **KEEP** | Wraps `par_learning_agent` |
| `beacon-weekly-lt-learning` (Sun 04:15) | **KEEP** | Wraps `lead_time_learning_agent` |
| `beacon-price-drift-weekly` (Mon 06:00) | **KEEP** | Wraps `price_drift_agent` |
| `beacon-pos-variance-daily` (05:00) | **KEEP** | Wraps `pos_variance_agent` |

---

## 4a. Deep Rescan (after migration 111) — additional landmines surfaced

Two back-to-back failures during 110/111 prompted a second pass. Found **five additional landmines** that would have compounded across migrations 111a/b/c (326 RLS policy rewrites). All neutralized by **migration 112 — Reality Graph Repair** before continuing.

| # | Landmine | Severity | Status |
|---|---|---|---|
| L1 | Migration 098 dropped `relationship_edges UNIQUE (source_id, edge_type, target_id)` — `create_relationship_edge() ON CONFLICT` silently allowed duplicates | CRITICAL | Fixed in 112 |
| L2 | 098's `DROP TABLE … CASCADE` killed `trg_stock_log_edges` and `trg_restock_fulfilled_edge`; trigger functions still defined but never fired since. Months of `consumes` / `reverts` / `restocks` edges missing from the Reality Graph | CRITICAL | Fixed in 112 (recreate + backfill) |
| L3 | Migration 110's edge-type CHECK missed two types actively emitted by code: `batch_of` (056), `influenced_by` (056, 077). Any caller writing them errored | CRITICAL | Fixed in 112 |
| L4 | Migrations 034, 098 RLS use `hotel_id IN (SELECT hotel_id FROM users WHERE id = auth.uid())` instead of `auth_hotel_id()` — incompatible with org-scope reads | HIGH | Fixed in 112 (realigned to `hotel_is_in_user_scope()`) |
| F1 | `supabase/functions/copilot-chat/index.ts:296` calls non-existent RPC `get_anomaly_explanation` (actual: `explain_anomaly`) plus wrong parameter `p_window_days` (actual: `p_anomaly_type`) | RUNTIME | Fixed in same commit |

### Notes on items NOT remediated in 112 (deferred — non-blocking)

- **Notifications type CHECK drift** — 5 redeclarations across migrations 025/062/065/067/109. Production state already accepts the union of all types via 109's expansion; safe to leave for the Phase R2 cleanup pass.
- **`users` table vs `profiles` divergence** — only 2 RLS policies were anti-pattern (now fixed in 112). The `users` table itself remains, kept stale; nothing critical reads from it. Address during Phase R2.
- **14 raw `.from()` calls in pages/components** — confirmed by RPC drift audit to be parameter-passing rather than RPC-call style, so no broken targets. Migrate to feature hooks during Phase R3 UX reshape.

## 4. Landmines (fix before Phase R1 migrations)

### 4.1 Stale edge-type CHECK constraint (migration 018)
**Risk:** Current code in `packages/reality-graph/src/actions/edges.ts` writes 7 edge types not declared in the constraint: `approved_by`, `rejected_by`, `fulfills`, `sourced_from`, `linked_to_po`, `invoiced_by`, `discarded_via`. Any write would fail.
**Action:** Verify actual production constraint state; write a migration to align the CHECK with reality (and add `belongs_to_org`, `transfers`, `proposed_by`, `similar_to`, `benchmarks` for future use). This migration must ship *before* 110.

### 4.2 Notification type constraint drift
**Risk:** Migration 067 redefined the constraint with types that broke `auto_create_alerts` (which emits `predicted_outage`, `waste_alert`). Migration 109 re-extended it. The *intended* current set is: `low_stock`, `expiry`, `restock_request`, `waste_spike`, `pos_variance`, `po_discrepancy`, `contract_expiry`, `approval`, `system`, `predicted_outage`, `waste_alert`, `consumption_spike`, `price_drift`.
**Action:** Verify production constraint matches; lock it as the source of truth before Phase R2 introduces `action_proposals`.

### 4.3 326 RLS policies all pinned to `auth_hotel_id()`
**Risk:** Org-tier reads (a director viewing all properties' alerts) will return empty unless every policy gains an OR-clause for org membership.
**Mitigation strategy:** Introduce a new scoping function `hotel_is_in_user_scope(hotel_id uuid)` returning boolean. It checks direct hotel membership OR org-level role. Then migrate policies to use it. One migration per domain (inventory, procurement, intelligence, etc.) — not one per table — to keep each migration reviewable.

### 4.4 14 raw-Supabase violations in pages/components
**Risk:** These will break silently when we introduce org-scoping if they bypass the feature-hook boundary where scope is injected.
**Action:** Migrate each call to a feature API hook as the very first step of Phase R1. List in `RESTRUCTURE.md`.

### 4.5 No agent eval suites
**Risk:** Renaming and reshaping agents without eval coverage means no safety net for regressions.
**Mitigation:** Backfill evals for the *five most impactful* agents first (`weekly_restock_agent`, `par_learning_agent`, `critical_stockout_agent`, `three_way_match_agent`, `contract_renewal_agent`) before renaming them. Evals use replayed production data (30-day window).

### 4.6 `transfer_stock` RPC name collision
**Risk:** Migration 019 already has a `transfer_stock(from_variant, to_variant, qty)` function for *variant-to-variant* transfers within one hotel. The new multi-echelon `TRANSFER_STOCK` is *hotel-to-hotel*.
**Action:** Rename the existing single-hotel variant-swap to `swap_variant_stock()`; reserve `transfer_stock(from_hotel, to_hotel, variant, qty)` for the org-layer action.

### 4.7 Auto-approval thresholds are per-hotel, not per-org
**Risk:** When a director makes a chain-wide policy decision, it has to be propagated to each hotel row today.
**Mitigation:** Add org-level defaults in Phase R1 with per-hotel overrides. Resolution order: hotel override > org default > global default.

### 4.8 `get_chain_benchmarks` is a stub
**Risk:** Currently treats each hotel as a standalone cross-reference target. Won't deliver real portfolio insight until Phase R4.
**Action:** Mark as ABSORB; don't extend it in Phase R1. Build proper org-scoped benchmark RPCs in R4 instead.

---

## 5. Execution Sequence (Confirmed)

Phase R0 (this document) → **R1 Step 1** begins.

### R1 migrations (in order)
- **Pre-110 hotfix** — fix edge-type CHECK constraint + rename `transfer_stock` → `swap_variant_stock`
- **110** — `organizations` table + `auth_org_id()` + roles + `user_org_memberships`
- **111** — scope-aware RLS helper (`hotel_is_in_user_scope`); roll out to all 326 policies in sub-migrations 111a/111b/111c (inventory / procurement / intelligence)
- **112** — `stock_transfers` table + `transfer_stock(from_hotel, to_hotel, ...)` + `approve_transfer()` + lateral-before-external branch in `weekly_restock_agent`
- **113** — `action_proposals` table; rewire existing `auto_propose_*` functions to emit proposals
- **114** — `agents` registry table; backfill rows for all 21 cataloged agents
- **115** — org-scoped `supplier_contracts.organization_id`; update `get_contract_price()` with resolution order
- **116** — benchmark columns added to reliability / waste / consumption RPCs when called at org scope

### R1 frontend (in parallel with migrations, lagging by one migration)
- Raw `.from()` cleanup in the 14 violating files
- `@beacon/types` extensions (`Organization`, `StockTransfer`, `ActionProposal`, `Agent`, extended role union, scope enum)
- `packages/reality-graph` new nodes: `organization`, `stockTransfer`, `actionProposal`, `agent`
- New `BeaconAction`s: `TRANSFER_STOCK`, `APPROVE_TRANSFER`, `APPROVE_ACTION_PROPOSAL`, `REJECT_ACTION_PROPOSAL`
- New hooks: `useActiveOrgId`, `useOrganizations`, `useStockTransfers`, `useTransferStock`, `useActionProposals`, `useAgents`
- Portfolio switcher in Topbar
- `/portfolio/*` route tree for org-scope surfaces
- Shared UI primitives: `AgentInbox`, `AgentProposalCard`, `ConfidenceGauge`, `ReasoningTrace`, `DecisionWindow`, `CadenceBadge`, `NetworkBenchmarkCell`

### R2 terminology sweep (deferred — mechanical rename pass after R1 lands)
All `auto_*` / `detect_*` / `run_*` functions renamed to `<domain>_agent`. UI strings follow.

---

## 6. Disposition Summary

| Disposition | Count | Effort shape |
|---|---:|---|
| **KEEP** (no change) | ~60% of artifacts | Free |
| **KEEP + extend** (add org-scope, etc.) | ~20% | Mechanical |
| **RENAME** (agent formalization) | ~15% | One sweep migration + UI string update |
| **ABSORB** (fold into a larger primitive) | ~3% | Handful of pages |
| **DEPRECATE** (remove after replacement lands) | ~2% | Route redirects, raw `.from()` violations |
| **NEW** (genuinely new primitives) | 4 tables + ~6 components | Real work, concentrated in R1 and R2 |

**The restructure is mostly additive.** The only genuinely disruptive piece is the 326-policy RLS rewrite in migration 111 — and that's mechanical once `hotel_is_in_user_scope()` is right.

---

## 7. Next Concrete Action

Begin **pre-110 hotfix**: a single migration that (a) aligns the `relationship_edges.edge_type` CHECK constraint with actual code usage and (b) renames `transfer_stock(variant, variant)` to `swap_variant_stock` to free the name for the multi-echelon action.

This is safe to ship before any structural work because it only *enables* new behavior; no current callers break.

---

**End of ARCHITECTURE-STATE.md**
