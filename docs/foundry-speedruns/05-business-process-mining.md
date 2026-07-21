# 05 · Speedrun: Mining Your First Business Process (Machinery)

Source: `source/05-business-process-mining/` (20 lesson PDFs). Use case: an insurance claims backlog —
complaints that claims take too long. Mine the claim process from its logs to find *why* claims are
stuck and *how big* the problem is. **This is the one guide that surfaces a capability Beacon does not
yet have.**

## Verbatim step-spine

1. **Data (Marketplace install):** Claims (Process Entities) + Customers + a **claim-logs** dataset.
   Machinery's two mandatory inputs:
   - **Process Entity** = an object with a **unique ID** (Claim Id) + a **current State** (categorical:
     submitted / under investigation / approved / rejected …).
   - **Process Log** = rows of **(process ID, new state, timestamp)** — the state transitions over
     time. (Timestamp must be `Timestamp` type — edit the CSV schema if it parsed as DateTime.)
2. **Ontology:** Claim + Customer object types; Machinery will **auto-create** a **Log object type** +
   a **Log→Process link type** (renameable in Ontology Manager).
3. **Mine the process (Machinery → new Process):**
   - Add Process → **Configure mining**: pick the Claim object + its State property.
   - Install a Log object type from the claim-logs dataset; **column-map** Process ID = `claim_id`,
     State = `new_state`, Timestamp = `timestamp`.
   - Index → **Ready to mine** → Machinery lays out a **directed state-machine graph**: nodes = states,
     edges = observed transitions (here 7 states, 9 transitions). Confirm/clean unexpected states.
   - Each transition can carry a **State**, an **Action** (applies the transition to objects), or an
     **Automation** (notification/logic on transition).
4. **Explore the process (embedded in a Workshop app):**
   - **Per-node metrics:** object count in state, **throughput** (avg time to exit after entering),
     **duration** (avg time spent in state).
   - **Per-edge metric:** **Average Lead Time** of the transition.
   - **Path Explorer:** every path objects took through the process; select a path → see those objects.
   - **Duration Distribution:** select states/edges → histogram of time-in-state / time-to-transition.
   - Default metric set: Historical Count, Historical Duration, Current Count, Current Duration.
   - **The finding:** Historical Count shows **266 claims entered "under investigation" but only 16 ever
     exited** — a bottleneck. Add a **High Risk filter** → 170 *non-risky* claims were wrongly routed to
     investigation (investigation should require high-risk). Root cause found.
5. **Customize + monitor:**
   - Add a **custom View** to the process graph: Label "Total Counts Alert", Metric = Current Count,
     **conditional formatting** so nodes color when counts exceed thresholds.
   - **Create an Alert (Automate):** Trigger = "Objects added to set" on Claim, **Advanced filter**
     State = `under investigation` AND not high-risk, **Live monitoring** → **Effect** = Notification to
     recipients (static or ontology-dynamic; content can be plain or AIP-generated). Attach the
     automation to the transition. "Catch claims wrongly stuck in investigation early next time."

Machinery also does **process authoring** (create states/transitions/actions/automations from scratch)
— deferred to a later course.

## Beacon mapping — the one real net-new capability, and we hold the substrate

Beacon already has the **state-machine layer** and the **alerting layer**. What it does **not** have is
the **process-mining analytics layer** in between. Precisely:

| Machinery piece | Beacon today | Verdict |
|---|---|---|
| Process Entity = object with unique ID + State | ✅ typed nodes with `status` | have |
| State machine = states + legal transitions | ✅ **`LIFECYCLES`** (restock/PO/case/proposal) + `lifecycle_transitions` table + `enforce_lifecycle` trigger + `legalNext()` | have — this is exactly Machinery's state graph, authored in code |
| Process Log = (process ID, new state, timestamp) event stream | ⚠️ **partial** — StockLog logs stock events; proposals carry `decided_at`; but there is **no unified per-object status-transition event log**. `enforce_lifecycle` is **validate-only** — it checks legality and returns, recording nothing | **gap (substrate-adjacent)** |
| Mine → directed graph with per-state count/throughput/duration + per-edge lead time | ❌ not built | **gap** |
| Path Explorer / Duration Distribution / bottleneck detection | ❌ not built | **gap** |
| Conditional formatting on state counts (threshold colors) | ✅ objectPresentation intent rules (would need to target a process view) | have (pattern) |
| Alert automation on a bad transition (trigger + filter + notify) | ✅ **monitors (metric+trigger) + intelligence cycle + alerts** | have |

So the mandatory *ends* — the state machine (guide's step 3) and the alert (step 5) — Beacon already
owns. The **middle** — turning the transition log into per-state/per-transition **metrics + a process
explorer + bottleneck discovery** — is genuinely missing, and it is the richest single finding of the
speedrun set.

**The forward path is small because we hold the substrate.** We already author the state machines
(`LIFECYCLES`) and enforce them at the trigger. Two additions unlock Machinery-parity:

1. **Transition event log** — have `enforce_lifecycle` (the natural choke point) **append** each lawful
   transition as `(node_type, node_id, from_status, to_status, at, actor)` to a
   `lifecycle_transition_events` table. It already sees every transition; today it just doesn't record
   them. Cheap, and self-apply-clean (immutable audit).
2. **Process-mining metrics + explorer** — a `logic`-category tool that aggregates the event log into
   per-state count/duration/throughput + per-transition lead-time + path counts, surfaced as a process
   view (reuse the `SearchAroundGraph` SVG substrate for the directed state graph). Bottleneck = a
   monitor over "entered ≫ exited" (the 266-vs-16 signal), which plugs straight into our existing
   alert/cycle path.

This is the same pattern the optimization backlog kept hitting: **the substrate already exists; the
audit finds the thin missing layer.** Machinery is a concrete, high-value backlog item — call it **P11:
Process Mining** — not a rearchitecture.

## Mandatory-step ledger

| # | Mandatory step | Beacon | Where |
|---|---|---|---|
| 1 | Process Entity: unique ID + categorical State | ✅ | typed nodes with `status` |
| 2 | Define/enforce the state machine | ✅ | LIFECYCLES + lifecycle_transitions + enforce_lifecycle |
| 3 | Transition **event log** (id, from→to, timestamp) | ⚠️ | validate-only trigger; no unified event log yet |
| 4 | Mine → directed state graph | ❌ | not built (have SearchAroundGraph substrate to reuse) |
| 5 | Per-state metrics (count/throughput/duration) | ❌ | not built |
| 6 | Per-transition metric (lead time) | ❌ | not built |
| 7 | Path explorer / duration distribution | ❌ | not built |
| 8 | Bottleneck discovery (entered ≫ exited) | ❌ | not built (fits monitor pattern) |
| 9 | Filter to root-cause (non-risky in investigation) | ✅ | Object View filters / Insights |
| 10 | Threshold conditional formatting on states | ✅ | objectPresentation intent rules |
| 11 | Alert automation on a bad transition | ✅ | monitors (metric+trigger) + intelligence cycle |

**Verdict: 6 ✅ / 1 ⚠️ / 4 ❌.** The 4 ❌ + 1 ⚠️ are one coherent capability — **process mining** — and
Beacon already holds both bookends (state machines, alerting) plus reusable UI (SearchAroundGraph). Net
finding: **new backlog item P11 (Process Mining over the lifecycle transition log).**
