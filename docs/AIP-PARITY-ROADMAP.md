# AIP Parity Roadmap — closing the stress-test gaps

> North star unchanged: **replicate Palantir AIP for hospitality.** This roadmap
> takes the gaps surfaced in the 2026-06-30 stress test and turns each into a
> sequenced, reviewable phase. It complements — does not replace —
> `ROADMAP.md` (surfacing the AIP) and `OPTIMIZATION-ROADMAP.md` (making shipped
> capabilities AIP-native). Where those ask *"is what we shipped native enough?"*,
> this asks *"what did we never build, and how do we know when it's truly done?"*

Status: **proposed** (2026-06-30).

---

## The gaps this roadmap closes

From the stress test, ranked by threat to the thesis:

| # | Gap | Threat |
|---|---|---|
| **G1** | Agents are deterministic — reasoning blocks never call the LLM; "Ontology-Augmented *Generation*" is ~30% true | Thesis-critical: judgment-under-ambiguity is the whole value prop |
| **G2** | Forecast is autoregressive-only + demand-censored — no exogenous drivers, no intervals, no lead-time, no live accuracy | Accuracy-critical: systematically under-orders |
| **G3** | Half-closed loops — sense/act work, *learn* is thin (auto-promote ignored, provenance sparse, learning unmeasured) | Flywheel doesn't turn |
| **G4** | Palantir parity — no AIP Logic, Automate composer, branching, object explorer, Workshop, lineage, purpose-based security; one toy modeling objective | Capability ceiling: operators can't extend the system |
| **G5** | UI/UX — no global object search, no saved views/bulk actions, 130 sprawling pages, generic empty states | Discoverability + Foundry-faithfulness |
| **G6** | Self-apply & scale — contract-test CI dormant, portfolio scale unproven, one cross-tenant leak already shipped | Safety + credibility of the "we meet our own bar" claim |

---

## How to read this

The work is six phases. **Order is dependency-driven, not gap-number order:** we
harden the guardrails first (so every later change is safe to ship and *measurable*),
fix the predictive spine, then make the agents reason, close the loops, build the
parity capabilities, and finish on UX + scale.

Every **step** ends with a **Review** — not "run the tests" but an exhaustive,
adversarial audit against the standing **Beacon Review Gate** below, plus
step-specific probes. A step is not "done" until its review passes *with evidence
recorded in the PR*. The discipline borrowed from self-apply: **prove the guard
catches a planted instance of the exact failure class** — a green test suite that
has never been shown to fail is not evidence.

### Master sequence

| Phase | Theme | Closes | Depends on |
|---|---|---|---|
| **P0** | Harden the guardrails | G6 (+ enables all) | — |
| **P1** | Make the forecast see reality | G2 | P0 (accuracy instrumentation) |
| **P2** | Make the agents actually reason | G1 | P0 (evals/CI), P1 (good tools to reason over) |
| **P3** | Close the loops | G3 | P1 (auto-promote), P2 (rich proposals) |
| **P4** | Palantir parity capabilities | G4 | P2 (real agents to author), P3 (loops to wire) |
| **P5** | Foundry-faithful UX | G5 | continuous; lands across P1–P4 |
| **P6** | Scale & GA hardening | G6 (scale half) | everything |

---

## The Beacon Review Gate (applied after EVERY step)

A step is done only when **all twelve** hold, each with linked evidence. This is
the "very thorough review phase" generalized; per-step reviews below add specifics
and call out which points carry the most risk for that step.

1. **Correctness with a failing-first test.** The new behavior has a test that
   *fails without the change and passes with it*. Unit + integration green.
2. **Self-apply security.** Every new RPC / trigger / RLS helper is exercised
   under **anon · authenticated · cross-org · cross-hotel** contexts
   (`supabase/tests/rls_contracts.sql`). New SECURITY DEFINER fns: `REVOKE FROM
   PUBLIC` verified (not just `anon`), `search_path` pinned, scope-gated or
   service-role-only. `get_advisors` clean on any auth/RLS/graph migration.
3. **Typed-contract integrity.** No raw `.insert()/.update()` in `apps/web`
   (Action Registry only). No predictive/derived math in `apps/web` (Logic Tool
   only). New compute = Logic Tool with `category·kind·version·basis·confidence·
   traversableLinks`. New write = `BeaconAction` with submission criteria, side
   effects, immutable audit entry, and exactly one invocation mode.
4. **Eval gate.** No agent/tool/adapter advances a release stage without a green
   eval at the prior stage. **Cohorts checked** (per-hotel / per-region slices)
   so an overall pass rate can't hide a regression. A↔B diff vs the prior version
   recorded.
5. **Loop closure.** The full arc — sense → typed Action → gate → Decisions →
   outcome → *retune* — is wired, not just the first hop. The retune step has
   before/after evidence.
6. **Config-as-data.** Every number/rule a human might tune lives in `org_policy`
   or a `Constraint` node, not a code constant. Hotel-overrides-org honored.
7. **Observability.** The step emits metrics. Failures carry derived context
   (call chain, input nodes, tool results). Litmus: a *planted* failure is
   root-caused in under a minute from logs/trace alone.
8. **Provenance & trace.** Every proposal has a viewable `AgentRunTrace` with
   confidence + cited tools/documents (page-level for documents). Calibration is
   not polluted — `outcomeLabel` handling correct (expired = neutral, etc.).
9. **UX completeness.** Empty state explains the cycle (what was scanned, against
   what thresholds, next run, last result). Object View anatomy uniform; right
   rail carries the node's audit log. Numeric cells tabular; confidence-coded
   queues (green ≥0.85 / yellow 0.6–0.85 / red <0.6).
10. **Regression proof.** A deliberately planted instance of the exact failure
    class is caught by an automated guard now in CI. (The lesson from the
    cross-tenant leak: write the guard *and watch it fail*.)
11. **Docs & memory.** CLAUDE.md adding-features checklist answered in a
    top-of-file comment. Relevant memory file updated. PR body records the
    verification evidence, not just "tests pass."
12. **Rollback.** The change is reversible — compensating transaction, release
    rollback, or feature flag — and the rollback path is *tested*, not assumed.

> **Phase-exit review** = every step's gate green **+** the phase-specific
> end-to-end probe **+** a deliberate attempt to break the phase's central
> invariant (red-team the thing we just built before declaring it done).

---

## Phase 0 — Harden the guardrails

**Why first.** Everything after this is either a security-sensitive write, a model
change whose accuracy we must measure, or both. We refuse to build on instruments
we can't trust. P0 makes the rest *safe to ship* and *measurable*.

### Step 0.1 — Activate contract-test CI for real
- Add the `SUPABASE_DB_URL` repo secret (operator action) so
  `.github/workflows/db-contracts.yml` runs `security_invariants.sql` +
  `rls_contracts.sql` on every PR, not just on a dormant schedule.
- Make a *failing* contract run block merge (branch protection rule).
- Add `get_advisors` to the same workflow as a gate on migrations touching
  auth/RLS/graph helpers.

**Review 0.1 (exhaustive):**
- Open a throwaway PR that **plants** each failure class and confirm CI goes red:
  (a) a SECURITY DEFINER fn with a default PUBLIC grant, (b) a fn missing
  `search_path`, (c) a definer fn taking `p_hotel_id` with no scope gate
  (the exact `get_overstock_candidates` leak). All three must fail CI. Revert.
- Confirm a *passing* PR still merges (no false positives blocking work).
- Confirm advisors output is surfaced in the PR check, readable, actionable.
- Gate points stressed: **#2, #10.** Evidence: links to the red CI runs + the
  green one.

### Step 0.2 — Live forecast-accuracy instrumentation (the measuring stick)
- New nodes/table: `forecast_observation` — at scan time, persist
  `(variant, asOf, horizon, projectedUnits, basis, confidence)`; a daily job
  later joins the *realized* consumption and computes signed error.
- New Logic Tool `score_forecast_accuracy` (category `logic`) → rolling MAPE,
  bias (mean signed error), coverage (for intervals, later). Per variant, per
  cohort, per basis.
- Surface on `ModelingObjectiveDetailPage` + a portfolio strip.

**Review 0.2:**
- Backfill against the last 30 days of real logs; confirm MAPE/bias are non-trivial
  and match a hand-computed spot check on 3 variants.
- Prove the bias sign is *negative* on censored series (sets up P1.4's case).
- Confirm the observation write is a `BeaconAction`/audited, not a raw insert.
- Gate points stressed: **#3, #5, #7.** This instrument is referenced by *every*
  P1 review — if it's wrong, all of P1's evidence is wrong, so over-verify here.

### Step 0.3 — Portfolio-scale test rig
- Seed a synthetic 12-hotel org (beyond Valinor/Rivendell) with realistic log
  volume; script it (repeatable), don't hand-seed.
- Run `runIntelligenceCycle` across all 12 via the cron path; capture wall-clock,
  query counts, p95 RPC latency, proposal volume, dedup hit-rate.

**Review 0.3:**
- Confirm the cron sweep completes within the edge-fn timeout at 12 hotels and
  extrapolate to 50; record the curve.
- Confirm RLS still isolates: a 12-hotel org user sees only their hotel; cross-hotel
  reads denied under the scaled data.
- Confirm no N+1 explosion (the dedup `openProposalKeys` fetch is one query/hotel,
  not one/variant).
- Gate points stressed: **#2, #7.** Evidence: the scale table; the isolation proof.

**Phase 0 exit review:** CI red-on-planted-regression proven; the accuracy
instrument validated against hand math; scale numbers recorded; advisors clean.
Red-team: try to merge a cross-tenant-leaking migration and confirm it's blocked.

---

## Phase 1 — Make the forecast see reality

**Why.** The predictive spine is blind to demand drivers and to its own censoring.
We fix *what the number is blind to* before *sharpening the number*. Each sub-step
is gated by the P0.2 instrument: ship it only if live MAPE/bias improves (or
interval coverage hits target) **without** a cohort regression.

> Architecture invariant for all of P1: changes live behind the
> `consumption_forecast` adapters and the `forecast_consumption` Logic Tool. The
> input contract (`ConsumptionForecastInput`) grows; **callers do not change** —
> that's the AIP modeling-objective promise, and the review must prove it.

### Step 1.1 — Prediction intervals → safety stock
- Adapters emit `intervalLow/intervalHigh` (or σ) alongside `projectedUnits`.
- New Logic Tool `compute_reorder_point` derives safety stock from the demand
  **prediction interval over lead time**, not a hand-tuned `p_factor`.
- Reorder/overstock sizing consumes the interval; `p_factor` becomes a fallback.

**Review 1.1:**
- Coverage test: on backtest holdouts, the realized value falls inside the stated
  interval ≈ the nominal rate (e.g. ~80% inside an 80% interval) — over/under-coverage
  is a fail.
- Confirm safety stock rises for high-variance variants and shrinks for steady
  ones (compare two real variants).
- Confirm overstock + restock both read the new sizing; `get_overstock_candidates`
  still service-role-only (don't regress the leak fix).
- Gate points stressed: **#1, #3, #4.** Evidence: coverage chart, the two-variant
  comparison.

### Step 1.2 — Day-of-week + occupancy / event drivers
- Extend `ConsumptionForecastInput` with `calendar` (dow/holiday) and an optional
  `occupancy`/`eventLoad` series; wire `OccupancyForecastPage` / `EventDemandPage`
  data into the tool's reader.
- New adapter `seasonal-regression-v1`: day-of-week factors × occupancy elasticity
  over the baseline rate. Registered behind the same `api()`; backtested.

**Review 1.2:**
- Backtest the new adapter vs baseline **per cohort**; it must win on F&B/weekend-heavy
  cohorts and *not lose* elsewhere (cohort-regression guard, gate #4).
- Ablation: drop occupancy → confirm error rises (proves the driver is real signal,
  not noise the model overfit).
- Confirm `asOf` discipline holds (no wall-clock reads; backtest passes the cutoff).
- Confirm graceful degradation when occupancy is absent (falls back to dow-only,
  then baseline) — and that the `basis` string reflects which path ran.
- Gate points stressed: **#3, #4, #7.** Evidence: per-cohort backtest, ablation.

### Step 1.3 — Lead-time-aware (s, S) reorder policy
- Combine forecast-over-lead-time (from `rank_alternative_suppliers` lead times) +
  safety stock (1.1) into a proper reorder point/quantity. Lead-time *variance*
  widens safety stock.
- Restock proposals size to `S − on-hand`, citing the lead time used.

**Review 1.3:**
- Replay 10 historical stockouts: confirm the policy would have ordered earlier/more
  for the ones driven by lead-time variance.
- Confirm the rationale cites the specific supplier + lead time (provenance, gate #8).
- Gate points stressed: **#1, #8.**

### Step 1.4 — Demand-censoring correction
- Detect stockout windows (stock = 0) per variant; treat consumption in those
  windows as **censored** (a lower bound), not observed demand.
- Adapter uplift: estimate unconstrained demand on censored days (e.g. impute from
  uncensored same-dow/occupancy days). New `basis` reflects the correction.

**Review 1.4:**
- Confirm the P0.2 **bias turns from negative toward zero** on previously-censored
  variants — this is the headline evidence the whole step exists for.
- Guard against over-correction: uncensored variants' forecasts must be ~unchanged.
- Synthetic test: inject a known stockout into a known-demand series; confirm the
  corrected estimate recovers the true rate within tolerance.
- Gate points stressed: **#3, #7.** Evidence: the bias-before/after chart.

### Step 1.5 — Refinements: EWMA, trend, per-cohort selection, auto-promote
- EWMA recency weighting + a linear-trend adapter (both behind the same `api()`).
- **Per-cohort adapter selection**: `backtest.ts` already scores `byCohort`; deploy
  the per-cohort winner, not one global winner.
- **Auto-promote the backtest winner**: wire the computed `winner` to *propose* an
  adapter release into Decisions (meta-proposal, human signs off) — closes the
  modeling loop the way the agent release gate closes the agent loop.

**Review 1.5:**
- Confirm a planted "obviously better" adapter generates a promotion *proposal*
  (not an unattended swap) and that promoting it flips `basis` with **no caller
  change** (gate #3 — grep callers, confirm zero diffs).
- Confirm per-cohort selection actually routes (seasonal cohort → seasonal adapter)
  and is visible on the objective page.
- Variance-aware confidence: steady vs spiky same-active-days series now differ in
  confidence.
- Gate points stressed: **#3, #4, #5.**

**Phase 1 exit review:** portfolio MAPE down and bias→0 vs the P0.2 baseline, **no
cohort regressions**, intervals well-calibrated, callers unchanged across all five
steps, every adapter eval-green at its stage. Red-team: feed a brand-new variant
(cold start) and a long-dead variant and confirm neither blows up (sets up P3 cold-start
pooling if a gap remains).

---

## Phase 2 — Make the agents actually reason

**Why.** This is the thesis. Today the reasoning blocks are a hardcoded numbered
procedure; the LLM only does entity extraction. We make the LLM *orchestrate the
tool loop* — choose tools, read results, decide the next call, stop on confidence —
behind the **same agent interface**, with the deterministic procedure demoted to the
**eval baseline + fallback**.

### Step 2.1 — Real LLM tool-loop runtime
- Extend the agent runtime so a reasoning block can run an **agentic loop**: the
  model sees the tool registry (the bounded set), emits `toolCalls`, the runtime
  executes them through the *existing* typed tools, feeds results back, and loops
  until the model emits a typed `BeaconAction` proposal or calls
  `request_clarification`.
- The model **may only call registered tools** and **may only traverse declared
  `traversableLinks`** — ad-hoc traversal rejected (CLAUDE.md invariant).
- Output is still a typed `BeaconAction` validated by zod — never raw text to a
  writer.
- Keep the deterministic procedure as `--baseline` for evals and as the **fallback
  when the LLM errors / times out / exceeds cost** (gate #12).

**Review 2.1:**
- Trace completeness: every loop iteration appears in `AgentRunTrace` (block, tool,
  args, return, thought, tokens) — a proposal without a full viewable trace is a
  defect (gate #8).
- Containment: attempt a prompt-injected request to call an unregistered tool /
  traverse an undeclared edge / write outside the Action Registry — all must be
  rejected, logged, and surfaced in the trace.
- Determinism of safety: the gate (`decideAutoExecution`) sits *after* the agent
  unchanged — confirm an LLM proposal still cannot auto-execute without a production
  release + passing constraints + calibration (gate #5).
- Cost/latency ceiling enforced; on breach, fallback to deterministic + trace notes
  the fallback.
- Gate points stressed: **#1, #7, #8, #12.**

### Step 2.2 — Evals that can tell LLM from baseline
- Expand each agent's `*.eval.ts` to ≥10 historical cases with rubric graders, run
  **LLM vs deterministic baseline** as an A/B diff on the same cases.
- Add adversarial cases: ambiguous prompts (should pause), conflicting principles,
  missing data (should request clarification not hallucinate).

**Review 2.2:**
- The LLM agent must **beat or match** the baseline on the rubric and **strictly
  win** on the ambiguous/judgment cases (else the thesis isn't paying for itself).
- Cohort check: no per-hotel pass-rate regression (gate #4).
- Confirm `request_clarification` fires below the 0.6 confidence threshold rather
  than emitting a low-confidence proposal.
- Gate points stressed: **#4, #8.** Evidence: the A/B diff table.

### Step 2.3 — Roll out to overstock + waste agents
- Apply the loop runtime to `overstock_rebalancer` and `waste_triage`; each keeps
  its numbered prompt as the procedure the LLM *follows*, now with judgment.

**Review 2.3:** repeat 2.1+2.2 reviews per agent; plus confirm the cron path can run
the LLM agents within budget *or* deliberately stays on the deterministic baseline
for unattended sweeps (a documented, intentional choice — cost vs judgment — not an
accident). Gate points: **#4, #7, #12.**

**Phase 2 exit review:** all three agents run the LLM loop on the operator path,
beat baseline on evals incl. judgment cohorts, traces are complete and tamper-evident,
the safety gate is provably unchanged, and the deterministic fallback is exercised
(kill the LLM mid-run, confirm graceful degradation). Red-team: a full prompt-injection
suite against every block.

---

## Phase 3 — Close the loops

**Why.** Sense and act work; *learn* is thin. Make the flywheel measurably turn.

### Step 3.1 — Auto-promote forecast winner (finish if not in P1.5) + adapter release-gate parity
- Ensure adapter promotion mirrors the agent release gate: server-verified eval at
  the prior stage before production, staging-before-production, fail-closed.

**Review 3.1:** mirror the agent release-gate contract tests (the `promote_agent`
C5 staging check) for adapters; plant an unevaluated adapter and confirm promotion
is refused. Gate points: **#2, #4, #5.**

### Step 3.2 — Provenance enrichment
- Add supplier-/PO-targeting proposals (e.g. `SWITCH_SUPPLIER`, PO-level actions)
  so `proposed_by` / `describes_entity` / `cited_in` edges to Supplier/PO actually
  populate (today ~0%, per `project_proposal_entity_links`).
- `ObjectAgentActivity` on Supplier/PO pages shows real linked proposals.

**Review 3.2:** confirm the edges populate end-to-end (propose → persist → render on
the Supplier Object View); confirm document citations are page-level (gate #8). No
vague "per the contract" without `cited_in → page N`. Gate points: **#8.**

### Step 3.3 — Measure the learning
- Instrument Principle / Approved-Answer / Constraint *impact*: did injecting
  principle X reduce rejection rate / improve calibration for the affected action
  type? Surface as a metric on each node's Object View.

**Review 3.3:** show a before/after for at least one principle (rejection rate or
calibration delta). Learning you can't measure isn't a flywheel — the review fails
if the number can't be produced. Gate points: **#5, #7.**

**Phase 3 exit review:** every loop — forecast, agent, principle, constraint — has a
visible retune step with evidence. Red-team: disable the retune and confirm a
metric *regresses*, proving the loop was load-bearing, not decorative.

---

## Phase 4 — Palantir parity capabilities

**Why.** The capability ceiling. Today operators consume the system; in Foundry
they *extend* it. Ordered by leverage. Each is large — treat sub-steps as their own
gated deliverables.

### Step 4.1 — AIP Logic (visual function/agent builder)
- NL-first per `AUTHORING-STRATEGY.md`: operator describes a function/agent; the
  system assembles typed tool + LLM + branch blocks; then a read-only canvas to
  inspect, then editable.
- Output is a *registered Logic Tool / agent*, versioned, eval-gated — not a script.

**Review 4.1:** a non-engineer authors a working tool end-to-end in NL; it lands in
the registry with `category·basis·confidence`, runs identically from UI and agent
(dual-callable, gate #3), and ships with an auto-generated eval stub the author must
green before promotion (gate #4). Red-team: author a tool that tries to write
outside the Action Registry — refused.

### Step 4.2 — Automate composer (event → condition → action)
- Build the `AUTOMATE-COMPOSER-SPEC.md` composer: visual binding of a trigger
  (monitor/event) → condition (constraint) → typed Action, through the same gate.

**Review 4.2:** an operator composes an automation in the UI that fires on a real
monitor, routes through `decideAutoExecution` (no second gate — extend, don't
duplicate, per CLAUDE.md), and is fully audited. Plant a malformed automation and
confirm it can't bypass the gate. Gate points: **#3, #5, #6.**

### Step 4.3 — Object-set Explorer (Quiver-style)
- Free-form: pick an object type, filter/pivot/aggregate/chart without a bespoke
  page. Backed by the typed `data` tools, scope-checked.

**Review 4.3:** an operator answers a question no existing page answers; every query
is RLS-scoped (cross-hotel attempt denied, gate #2); results are exportable and
link back to Object Views. Performance acceptable at the P0.3 scale.

### Step 4.4 — Branching (ontology/data branch + merge review)
- Extend Scenarios from graph-overlay sandbox toward a true branch: propose changes
  on a branch, diff, review, merge — for ontology/config, not just simulated cycles.

**Review 4.4:** a branch with a config change is diffed against main, reviewed, and
merged through an audited path; an unmerged branch leaves main untouched; RLS holds
on branch data. Gate points: **#2, #12.**

### Step 4.5 — More modeling objectives
- Stand up real objectives beyond consumption: **occupancy forecast**, **waste
  prediction**, **supplier-reliability**, **price/cost**. Each: adapter + eval +
  release lifecycle. (Occupancy feeds P1.2 — close that dependency loop.)

**Review 4.5:** each objective beats its baseline on a real eval before any
production release; each is consumed by a Logic Tool with `basis/confidence`; the
modeling layer is no longer "a demo of itself." Gate points: **#4.**

### Step 4.6 — Security depth (purpose-based access + classification)
- Field-level classification on sensitive columns; purpose-based access (why is this
  user reading this) layered on RLS.

**Review 4.6:** contract tests extended for classification (a user without purpose
can't read a classified field even within their hotel); advisors clean. Gate points:
**#2, #10.**

### Step 4.7 — Pipeline & lineage visualization
- End-to-end lineage: raw source (ingestion edge fns) → transform → object →
  proposal → decision, rendered (extend `SystemMapPage`/`GraphPage`).

**Review 4.7:** pick one real decision and trace it visually back to the source
document/log that justified it; broken/missing links are flagged, not hidden.

### Step 4.8 — Workshop (operator app builder) — last, biggest
- Operators assemble their own views from widgets bound to the ontology.

**Review 4.8:** an operator builds a usable view without engineering; widgets are
scope-checked; built views can't bypass the Action Registry or the gate. Full
self-apply pass.

**Phase 4 exit review:** an operator can author a tool, an automation, an
exploration, and a view — all typed, scoped, eval-gated, audited — without a deploy.
Red-team each authoring surface for Action-Registry / gate bypass and RLS escape.

---

## Phase 5 — Foundry-faithful UX

**Why.** We use Blueprint (Palantir's own design system) so the *look* is right; the
*primitives* lag. Lands incrementally across P1–P4, consolidated here.

### Step 5.1 — Global object search
- Omnibox: type any object's name → jump to its Object View from anywhere. Confirm
  whether the existing palette (`useKeyboardNav.ts`) searches *objects* or only
  *routes*; close the gap to objects.

**Review 5.1:** search returns across all node types, RLS-scoped (no cross-hotel
leakage in results, gate #2), keyboard-first, fast at P0.3 scale.

### Step 5.2 — Table/object-set affordances
- Saved views/filters (persisted), bulk actions on object sets (through the Action
  Registry, gate #3), open-in-new-tab, breadcrumb back-stack.

**Review 5.2:** a bulk action on N objects produces N audited writes (not one
untyped batch); saved views persist per user; cross-hotel objects never appear in a
hotel-scoped set.

### Step 5.3 — Empty-state audit + page consolidation
- Sweep all ~130 pages: every empty state explains the cycle (gate #9). Consolidate
  sprawl under the Applications portal + global search; demote rarely-used pages.

**Review 5.3:** spot-check 20 pages for cycle-explaining empties; confirm navigation
depth dropped (measure clicks-to-task before/after); no orphaned routes.

**Phase 5 exit review:** a new operator finds any object and completes a task without
training; the 130-page sprawl is navigable; every surface honors the Object View
anatomy + confidence coding.

---

## Phase 6 — Scale & GA hardening

**Why.** Close the scale half of G6 — the "12-property group" claim must be true.

### Step 6.1 — Scale & load
- Run P0.3's rig at 50 hotels under concurrent operator load + the cron sweep;
  profile and fix the worst offenders.

### Step 6.2 — Security & chaos
- Full `get_advisors` sweep; an RLS penetration pass (every node type, every
  cross-tenant axis); chaos test (kill LLM, kill edge fn mid-cycle, partial
  failures) — confirm graceful degradation + no partial-write corruption.

**Phase 6 / GA exit review:** scale numbers meet target with headroom; zero
cross-tenant findings; every loop degrades gracefully under failure; the full
contract-test + eval + advisors suite is green in CI and has each been **shown to
fail** on a planted defect. Only then is the AIP-parity claim defensible.

---

## Definition of "fully done" (the whole roadmap)

The thesis holds — *Ontology-Augmented Generation for hospitality* — when:

1. Agents **reason with the LLM** over typed tools, gated and audited (G1).
2. The forecast **sees demand drivers**, reports **intervals**, corrects
   **censoring**, and **knows its own live accuracy** (G2).
3. Every loop — forecast, agent, principle, constraint — **measurably retunes**
   (G3).
4. Operators **author** tools, automations, explorations, and views in NL/no-code,
   all typed and gated (G4).
5. Any object is **findable and explorable** in a Foundry-faithful UI (G5).
6. The whole thing is **safe at portfolio scale**, with every guard **proven to
   catch its failure class** in CI (G6).

Each of the above is only "done" when its phase-exit review passed **with recorded
evidence** — and when a deliberate attempt to break its central invariant was made
and defeated.
