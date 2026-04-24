# Beacon AIP Roadmap — Palantir-Grade Hotel Intelligence Platform

## Current State Assessment

Beacon today is a **strong ontology-first platform** with a Reality Graph, four-layer architecture (Floor/Flow/Eye/Mind), immutable audit trails, multi-modal input (barcode, voice, camera, NLP), and substantial intelligence (waste radar, consumption forecasting, anomaly detection, causal tracing, procurement proposals, pgvector embeddings).

**But it's not yet an AIP.** It's an intelligent app with AI features bolted onto a solid ontology. The gap between "intelligent app" and "AIP" is the difference between:

- **Intelligent app:** Human asks question → system answers with data + context
- **AIP:** System continuously observes → detects what matters → proposes action → executes within guardrails → learns from feedback → gets better

The core Palantir AIP primitives that Beacon is missing:

| AIP Primitive | Beacon Status | Gap |
|---|---|---|
| **Ontology** (unified data model) | Reality Graph, relationship_edges, typed nodes | Solid foundation |
| **AIP Logic** (rules on ontology) | Node computed properties, action registry | Good but thin — needs richer constraint/rule engine |
| **AIP Agents** (autonomous actors) | RPCs exist but require manual trigger | No autonomous loop, no event-driven agents |
| **AIP Copilot** (NL interface) | Keyword-based routing, no LLM | Needs LLM-powered conversational copilot |
| **AIP Workflows** (multi-step automation) | Individual RPCs, no chaining | No workflow orchestration, no conditional branching |
| **Decision Provenance** | Causal trace, immutable logs | Strong |
| **Feedback Loop** (learn from decisions) | dismissed_reason captured, unused | No closed-loop learning |
| **Real-time Reactivity** | Supabase Realtime, cache invalidation | Good for UI — missing for agent triggers |

---

## The Roadmap

### Phase A: The Autonomous Loop (The single most important missing piece)

**What Palantir has:** Agents that run continuously, observe state changes, and act within guardrails without human trigger.

**What Beacon has:** `auto_propose_restocks()`, `auto_create_alerts()`, `detect_po_discrepancies()`, `detect_and_alert_price_drift()`, `escalate_stale_approvals()` — all exist as RPCs but are **only triggered manually** or by the `useSilentAutoAlerts` hook (client-side, unreliable).

**What to build:**

#### A1. Scheduled Agent Runner (pg_cron or Supabase Cron)
Enable `pg_cron` on Supabase and schedule the existing intelligence RPCs:

| Schedule | RPC | Purpose |
|---|---|---|
| Every 15 min | `auto_create_alerts()` | Detect depletion risk, waste spikes, consumption anomalies |
| Every hour | `auto_propose_restocks()` | Generate restock proposals for items approaching zero |
| Every hour | `detect_po_discrepancies()` | Flag 3-way match exceptions |
| Every hour | `escalate_stale_approvals()` | Auto-escalate pending approvals past timeout |
| Daily 6am | `detect_and_alert_price_drift()` | Catch supplier price creep |
| Daily 6am | `detect_and_alert_pos_variance()` | Catch POS vs physical stock gaps |
| Nightly 2am | `compute-similar-variants` edge fn | Refresh semantic embeddings |

**Impact:** The system starts working while humans sleep. Managers arrive to a prioritized inbox of what changed overnight — not a static dashboard they have to scan themselves.

**Who benefits:**
- **Managers:** Open app in the morning → everything that needs attention is already flagged and prioritized
- **Warehouse workers:** Arrive to a pre-generated pick list based on overnight proposals that auto-approved within guardrails

#### A2. Event-Driven Agent Triggers (Reactive Intelligence)
Instead of just polling on a schedule, agents should fire in response to events:

| Trigger Event | Agent Action |
|---|---|
| `stock_logs` INSERT where balance_after = 0 | Immediately create critical stockout alert + auto-propose emergency restock |
| `stock_logs` INSERT where `removal_category = 'Theft'` | Alert security + flag variant for photo-required policy |
| `restock_receives` INSERT | Check if PO is now fully received → auto-close PO → trigger 3-way match |
| `occupancy_logs` INSERT where pct > 85% | Re-run PAR calculations for high-demand variants → push task list to floor staff |
| `pos_sales` batch INSERT | Re-compute days_until_zero for affected variants → alert if depletion accelerated |
| Approval timeout elapsed | Auto-escalate to next tier, or auto-approve if within budget guardrail |

**Implementation:** Supabase Database Webhooks or pg_notify + edge function listeners.

**Who benefits:**
- **Bartenders:** Get a push notification the moment a spirit hits critical level, not 15 minutes later when the cron runs
- **Managers:** Approval escalation happens automatically — no more items stuck in queue because someone forgot

#### A3. Guardrailed Auto-Execution
The leap from "propose" to "execute within guardrails":

| Action | Guardrail | Current | AIP Target |
|---|---|---|---|
| Restock request | Cost < hotel.auto_approve_threshold | Manual approve | Auto-approve if cost < threshold AND supplier has >90% reliability AND no open PO for same variant |
| PO generation | Supplier on approved list + within budget | Manual creation | Auto-generate draft PO when 3+ approved restock requests exist for same supplier |
| Invoice approval | Discrepancy < 2% | Manual review | Auto-approve matched invoices within tolerance |
| Stock adjustment | Source = POS integration | Already auto | Already works via `ingest_pos_sale()` |
| Alert creation | Always | Client-side timer | Server-side cron (A1) |

**New DB columns needed:**
- `hotels.auto_approve_threshold` (numeric) — restocks below this cost auto-approve
- `hotels.auto_po_enabled` (boolean) — allow autonomous PO generation
- `hotels.auto_invoice_tolerance_pct` (numeric, default 2) — auto-approve invoices within tolerance

**Who benefits:**
- **Managers:** Only see exceptions. 80% of routine procurement runs on autopilot.
- **Owners:** Hotel operates at near-zero approval latency for low-risk decisions

---

### Phase B: The Conversational Copilot (The interface upgrade)

**What Palantir has:** Natural language interface that can query the ontology, explain anomalies, propose actions, and execute them — all in conversation.

**What Beacon has:** EyeCopilot with keyword routing to 4 pre-built tools. No LLM routing, no multi-turn, no action execution from chat.

**What to build:**

#### B1. LLM-Powered Copilot with Tool Calling
Replace the keyword-based router with Claude tool-calling. The existing 4 tools become the starting set, but the LLM can:

- **Route ambiguous queries:** "What's going on with towels?" → detects this spans waste + stock + supplier → calls multiple tools
- **Multi-turn conversation:** "Show me waste anomalies" → (shows data) → "Why is the soap spiking?" → calls `fetchAnomalyExplanation` with the right variant
- **Cross-domain synthesis:** "Why are we spending more this month?" → combines spend_trend + price_drift + occupancy to synthesize a real answer

**New edge function:** `copilot-chat/index.ts`
- Claude with tool definitions for every Eye/Mind RPC
- Conversation history (stored in Supabase, scoped to user + hotel)
- Tools: All existing fetch RPCs + action proposals

**Tool inventory for copilot (what it can query):**
- `getShiftIntelligence` — current signals ranked by urgency
- `getWasteRadar` — waste anomalies with attribution
- `getConsumptionForecast` — depletion predictions
- `getSupplierReliability` — supplier scorecards
- `getActiveIncidents` — cross-domain incidents
- `getAnomalyExplanation` — root cause for specific variant
- `getCausalTrace` — graph walk for any entity
- `getChainBenchmarks` — multi-hotel comparison
- `getPriceDrift` — supplier price movement
- `getPOSVariance` — expected vs actual stock
- `getTeamPerformance` — staff attribution

**Who benefits:**
- **Managers:** Ask any question in plain language instead of navigating to the right panel. "How did Sarah's shift compare to John's last week?" just works.
- **Owners:** Ask strategic questions. "Which supplier should we drop?" → system synthesizes reliability + price + waste data.

#### B2. Action Execution from Copilot
The copilot shouldn't just answer questions — it should do things:

- "Create a restock request for 50 towels from CleanCo" → proposes action → user confirms → executes `REQUEST_RESTOCK`
- "Approve all pending restocks under $100" → shows list → user confirms → batch `APPROVE_RESTOCK`
- "Write off 5 units of Soap Mini, breakage" → proposes → confirm → `WRITE_OFF`
- "Generate a PO for all approved restocks from SupplierX" → proposes PO → confirm → `CREATE_PO`

**Pattern:** Copilot proposes action as a structured card with "Confirm" / "Edit" / "Cancel" buttons. Never auto-executes from chat without explicit confirmation.

**Who benefits:**
- **All roles:** Fastest path from intent to action. No form navigation, no modal filling. Say what you want → confirm → done.

#### B3. Voice-First Copilot (Floor Layer)
Replace the regex-based VoiceAdjustButton with the copilot's LLM understanding:

**Current:** Only understands "adjust [product] by [N] [reason]" pattern
**AIP Target:** Understands any natural language:
- "We're out of the small towels on floor 3"
- "The Hendrick's gin bottle broke, write off one"
- "I just received the cleaning supplies delivery, 50 of each"
- "Check if we have enough champagne for the wedding Saturday"

**Implementation:** Pipe Web Speech API transcript → copilot-chat edge function → structured action proposal → confirm via touch.

**Who benefits:**
- **Bartenders:** Hands are busy. Say anything in natural language while working. No specific syntax to memorize.
- **Maids:** Report issues verbally while cleaning. "Room 415 minibar is empty" → system knows what was in it from POS data → auto-generates restock.
- **Warehouse workers:** Receiving a delivery? "I'm receiving the order from CleanCo, 100 towels, 50 soaps, 25 shampoos" → system matches to open PO → pre-fills receive form.

---

### Phase C: Predictive Operations (The intelligence upgrade)

**What Palantir has:** Models that predict future state and pre-position resources before problems occur.

**What Beacon has:** Statistical forecasting (avg_daily * days = days_until_zero), probabilistic PAR, consumption spike detection. All backward-looking with simple projection.

**What to build:**

#### C1. Occupancy-Driven Demand Scaling
**Gap:** Occupancy data is ingested (Mews/manual) but doesn't auto-adjust PAR or consumption forecasts.

**AIP Target:**
- When booking forecast shows 95% occupancy next Saturday (wedding), automatically:
  1. Scale PAR for high-demand items (towels, minibar, F&B)
  2. Generate pre-emptive restock proposals for the demand spike
  3. Push task lists to floor staff: "Pre-stock floors 3-5 with 2x normal minibar inventory by Friday 4pm"

**New RPC:** `get_occupancy_adjusted_forecast(p_date_range)` — multiplies base consumption by occupancy coefficient per category.

**Who benefits:**
- **Warehouse workers:** Get a predictive pick list days before the rush, not a crisis alert during it
- **Managers:** Never understocked for a high-occupancy weekend again
- **Owners:** Reduced stockout events → higher guest satisfaction scores

#### C2. Supplier Lead-Time Learning
**Gap:** Lead time comes from 3 sources (PO history / supplier stated / hotel median) but doesn't learn or predict delays.

**AIP Target:**
- Track actual vs. expected delivery dates per supplier per product category
- Detect seasonal patterns ("CleanCo is always 3 days late in December")
- Adjust restock proposal timing based on predicted (not stated) lead time
- Alert when a supplier's reliability is trending down before it becomes critical

**Who benefits:**
- **Managers:** Proposals account for the supplier's real behavior, not their promise
- **Owners:** Negotiate from data — "Your average delivery was 4.2 days late last quarter"

#### C3. Waste Pattern Intelligence
**Gap:** Waste radar detects spikes but doesn't identify root causes or predict future waste.

**AIP Target:**
- Correlate waste with: team member, shift, day-of-week, occupancy, supplier batch, expiry date
- Predict: "Based on current batch expiry dates, you'll need to write off ~$340 of dairy products by Friday unless consumed"
- Recommend: "Move 12 yogurts from storage to breakfast bar to maximize usage before expiry" (FEFO-aware)
- Detect theft patterns: "Alcohol write-offs spike every Tuesday night shift — correlates with one team member"

**Who benefits:**
- **Managers:** Actionable waste reduction recommendations, not just alerts
- **Owners:** Quantified waste reduction KPIs tied to specific interventions

#### C4. Menu Engineering Intelligence
**Gap:** COGS tracking exists but doesn't recommend menu changes.

**AIP Target:**
- Identify dishes where ingredient costs exceed sell price margin target
- Suggest substitutions: "Swap Atlantic salmon for Norwegian — similar taste profile, 18% cheaper, same supplier"
- Predict F&B cost impact of menu changes before implementation
- Track actual vs. theoretical food cost per dish (POS consumption vs. recipe)

**Who benefits:**
- **F&B Managers:** Data-driven menu optimization without spreadsheets
- **Owners:** Direct impact on profitability

---

### Phase D: Closed-Loop Learning (The feedback flywheel)

**What Palantir has:** Every human decision feeds back into the system to improve future proposals.

**What Beacon has:** `dismissed_reason` on notifications, `proposal_dismissals` table — data is captured but never used.

**What to build:**

#### D1. Proposal Quality Scoring
Track how proposals perform after execution:

| Signal | What It Tells Us |
|---|---|
| Proposal approved → received within 3 days | Good proposal, good timing |
| Proposal approved → not ordered for 2 weeks | Over-eager proposal (lower urgency score for this pattern) |
| Proposal dismissed with reason "not needed" | PAR too high for this variant → adjust |
| Proposal dismissed with reason "wrong supplier" | Supplier preference not captured → learn |
| Restock fulfilled but item wrote off >20% within 30 days | Ordered too much → reduce suggested qty |
| Auto-alert dismissed repeatedly for same variant | Threshold too sensitive → raise for this variant |

**New table:** `proposal_outcomes` — links proposal_id → restock_request_id → stock_logs → write-offs to measure end-to-end proposal quality.

**Who benefits:**
- **Everyone:** System gets smarter over time. Fewer false alarms, better quantities, better timing.

#### D2. Personalized Alert Thresholds
**Gap:** `alert_preferences` table exists but only has global thresholds (days_threshold, waste_threshold).

**AIP Target:**
- Per-variant thresholds learned from history: "Champagne has a 3-day reorder window but the system alerts at 7 days — too early"
- Per-user notification frequency: "This manager dismisses >80% of waste alerts — show them only anomaly_score > 7"
- Seasonal adjustment: "Alert thresholds should be tighter in high season (June-August)"
- Quiet intelligence: Stop alerting for items the manager has repeatedly said "I know, it's fine" about

**Who benefits:**
- **Managers:** 80% fewer noise alerts. Every notification that arrives actually matters.
- **Floor staff:** Only get alerted about things they can act on right now

#### D3. LLM-Enhanced Anomaly Explanation
**Gap:** `fetchAnomalyExplanation` is SQL-based synthesis. Good for structured causes, misses nuance.

**AIP Target:** When the operator clicks "Why?" on an anomaly, the system:
1. Gathers all structured signals (SQL-based, as today)
2. Passes them to Claude with the operator's context (role, shift, recent actions)
3. Generates a human-readable explanation: *"Soap waste spiked 45% this week. Three factors: (1) New batch from SupplierX has 12% higher breakage than previous batches — likely a quality issue. (2) Occupancy hit 92% Tuesday-Thursday. (3) Housekeeping team adjusted stock 3x more than usual, suggesting possible over-allocation per room. Recommended: contact SupplierX about batch quality, reduce per-room allocation from 3 to 2 bars."*

**Who benefits:**
- **Managers:** Don't need to be data analysts. The system tells them the story and what to do about it.

---

### Phase E: Multi-Stakeholder Intelligence (The network effect)

**What Palantir has:** Different users see different slices of the same reality, optimized for their role and current mission.

**What Beacon has:** 4 roles with progressive disclosure. Good foundation, but the views are generic — everyone with the same role sees the same thing.

**What to build:**

#### E1. Personalized Briefing Feed
**Gap:** Briefing page shows the same ranked feed for all admins/owners.

**AIP Target:**
- **Housekeeping manager:** Briefing prioritizes floor stock, expiry alerts, cleaning supply levels, team performance
- **F&B manager:** Briefing prioritizes bar/kitchen stock, menu cost alerts, POS variance, waste by dish
- **Procurement manager:** Briefing prioritizes supplier risks, PO pipeline, price drift, upcoming deliveries
- **GM/Owner:** Briefing shows exceptions only — everything running smoothly is collapsed

**Implementation:** User preference for "primary responsibility areas" (categories, locations, suppliers) → briefing query filters by those areas and ranks accordingly.

#### E2. Shift-Aware Intelligence
**Gap:** System doesn't know who's on shift or what their immediate context is.

**AIP Target:**
- Clock-in/clock-out integration (or manual shift selection)
- Shift start → push personalized task list: "Your shift priorities: restock Room Block C minibars (occupancy 100% tonight), receive CleanCo delivery (ETA 2pm), count bar spirits (weekly stocktake due)"
- Shift end → auto-generate handover with flagged items from this shift
- Cross-shift visibility: "Morning shift wrote off 8 units of X — investigate before re-ordering"

**Who benefits:**
- **Every floor worker:** Knows exactly what to do when they clock in, in priority order
- **Managers:** Shift handover is automatic, nothing falls through the cracks

#### E3. Supplier Portal (Outbound Intelligence)
**Gap:** Webhooks exist for outbound events but no supplier-facing interface.

**AIP Target:**
- Suppliers get a read-only portal showing: their open POs, delivery schedules, performance scorecard
- Auto-generated PO emails include: order lines, preferred delivery date, quality notes from previous deliveries
- Supplier can confirm/update delivery ETA → Beacon auto-adjusts PAR and alerts

**Who benefits:**
- **Managers:** No more calling suppliers for delivery updates
- **Suppliers:** Self-service reduces their support burden
- **System:** Real-time delivery intelligence for better predictions

---

### Phase F: Physical-Digital Convergence (The Floor layer endgame)

#### F1. AR Stocktake (Phase 9 completion)
Camera scaffold exists. Add:
- TensorFlow.js object detection model trained on common hotel supplies
- Real-time overlay: point camera at shelf → see item counts + status badges
- One-tap correction: tap a detected item → adjust quantity

#### F2. IoT Integration
- Smart shelf sensors (weight-based) → automatic stock level updates
- Minibar sensors → real-time consumption tracking without manual count
- Temperature sensors → cold chain compliance alerts for F&B

#### F3. Wearable Notifications
- Apple Watch / WearOS app for floor staff
- Haptic alert for critical stockouts
- Voice command via watch microphone → copilot

---

## Implementation Priority Matrix

| Phase | Effort | Impact | Who Benefits Most | Palantir Parity |
|---|---|---|---|---|
| **A1** Scheduled agents | Low (pg_cron config) | Very High | Managers, warehouse | Critical |
| **A2** Event-driven triggers | Medium | Very High | All floor staff | Critical |
| **A3** Guardrailed auto-execution | Medium | Very High | Managers, owners | Critical |
| **B1** LLM copilot | Medium-High | Very High | Managers, owners | Critical |
| **B3** Voice-first copilot | Medium | High | Bartenders, maids, warehouse | Differentiator |
| **C1** Occupancy-driven demand | Medium | Very High | Warehouse, managers | High |
| **D1** Proposal quality scoring | Low-Medium | High | System-wide (compounding) | Critical |
| **D2** Personalized thresholds | Medium | High | All staff (noise reduction) | High |
| **B2** Action from copilot | Medium | High | All roles | High |
| **C2** Lead-time learning | Low-Medium | Medium-High | Managers | High |
| **C3** Waste pattern intelligence | Medium | High | Managers, owners | High |
| **D3** LLM anomaly explanation | Low | Medium-High | Managers | High |
| **E1** Personalized briefing | Medium | Medium-High | All roles | Medium |
| **E2** Shift-aware intelligence | Medium | High | Floor staff | Differentiator |
| **C4** Menu engineering | Medium | Medium | F&B managers | Medium |
| **E3** Supplier portal | High | Medium | Managers, suppliers | Medium |
| **F1** AR stocktake | High | Medium | Warehouse | Future |
| **F2** IoT integration | Very High | High | All (removes manual work) | Future |
| **F3** Wearables | Medium | Medium | Floor staff | Future |

---

## The 90-Day Sprint Plan

### Weeks 1-3: The Autonomous Foundation (Phase A)
- [ ] Enable pg_cron, schedule all existing intelligence RPCs
- [ ] Add event-driven triggers for critical stockouts and delivery receipts
- [ ] Add `auto_approve_threshold` to hotels table
- [ ] Implement guardrailed auto-approval for low-cost restocks
- [ ] Auto-close POs when fully received → trigger 3-way match

### Weeks 4-6: The Copilot Upgrade (Phase B1 + B3)
- [ ] Build `copilot-chat` edge function with Claude tool-calling
- [ ] Define tool schemas for all Eye/Mind RPCs
- [ ] Multi-turn conversation with history persistence
- [ ] Replace keyword router in EyeCopilotPage with LLM router
- [ ] Wire Web Speech API → copilot for natural voice commands

### Weeks 7-9: Predictive Operations (Phase C1 + C2)
- [ ] Build occupancy-adjusted forecast RPC
- [ ] Auto-generate predictive task lists for high-occupancy days
- [ ] Implement lead-time learning from PO history
- [ ] Seasonal adjustment for restock timing

### Weeks 10-12: The Feedback Flywheel (Phase D)
- [ ] Build proposal_outcomes tracking
- [ ] Implement per-variant threshold learning
- [ ] LLM-enhanced anomaly explanations
- [ ] Personalized briefing feed based on responsibility areas

---

## The North Star

When this roadmap is complete, a hotel general manager will open Beacon in the morning and see:

> **Good morning. Here's what happened overnight:**
>
> - 3 routine restocks auto-approved and POs sent to suppliers ($420 total, within your $500 guardrail)
> - CleanCo delivery received at 6:12am by warehouse — all items matched PO, invoice auto-approved
> - Champagne stock flagged: Saturday wedding (140 guests) will consume ~18 bottles, you have 12. Restock proposal ready for your approval.
> - Soap breakage rate from SupplierX batch #4412 is 3x normal. Recommend: switch next order to SupplierY (same price, 98% quality rate). [Approve] [Investigate]
> - Morning shift priority list pushed to Maria (housekeeping) and James (bar). Both acknowledged.
>
> **Your only decision needed:** Approve the champagne rush order ($285) — everything else is handled.

That's AIP. The system does the work. The human makes the judgment calls.
