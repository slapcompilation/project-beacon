# Prediction Coherence — how the objects and models cowork to produce accurate predictions

> The question this answers: *"We have the core, but it's unclear how all the objects and models
> cowork to produce accurate predictions."* This is not a "we need a better model" problem — Beacon
> already has EWMA / Holt / per-variant auto-select / reorder-point (s,S) / occupancy / an accuracy
> instrument / decision calibration. It's a **coherence** problem: those pieces don't yet compose into
> *one* observable, self-grading pipeline. This doc names the pipeline, the breaks, and the fix.

---

## 1. How a senior team tackles "it's unclear how it all coworks"

The instinct of a junior team is to add another model. The senior move is the opposite — **make the
pipeline a single observable object before touching any model.** The playbook:

1. **Draw the lineage end to end.** Raw node → feature → model → prediction → decision → outcome →
   error → back to model. If you can't draw it with a *measured error at each hop*, that gap is the bug.
2. **Pick one north-star metric that is the decision, not the model.** The product goal isn't a good
   forecast — it's a good *restock decision*. Measure fill-rate / stockout-days / waste, and treat a
   forecast as valuable only insofar as it moves that number. A model with great MAPE feeding a
   decision nobody trusts is worth nothing.
3. **Have exactly one number per concept.** One "expected demand" with one basis and one confidence,
   flowing into every consumer. Parallel estimators that disagree are how trust dies.
4. **Record predictions, then grade them against reality.** Reconstruction ("what would the model have
   said?") is a bootstrap. The durable system writes down what it predicted and scores itself when the
   future arrives — this is the only thing that survives non-deterministic inputs.
5. **Make lineage structured, not prose.** Any prediction/decision must be traversable to its inputs
   and its realized outcome as a graph — the whole point of an ontology. "Per the forecast" in a text
   rationale is not lineage.
6. **Let accuracy govern autonomy.** A basis running hot should automatically tighten the auto-exec
   floor; a proven-calibrated one should earn a lower floor. Accuracy → trust → autonomy, audited.

This is precisely what Palantir's ontology + data-lineage exists to deliver. We have the ontology; we
haven't yet drawn the prediction lineage across it.

---

## 2. Beacon's actual prediction pipeline today (grounded)

### The estimators — there are three, and they don't reconcile

| Estimator | Basis | Method | Who consumes it | Accuracy (live, Valinor) |
|---|---|---|---|---|
| `compute_reorder_point` | `reorder-point-normal-v1` | **Flat 30-day mean** + variance → (s,S) | **restock_advisor — sizes real proposals** | ~flat-baseline (worse) |
| `forecast_consumption` → `auto-select-v1` | `auto:ewma-v1` etc. | EWMA/Holt/seasonal, backtested per variant | waste_triage; **registered-but-unused** by restock_advisor's deterministic reasoning | EWMA **13.9% MAPE** vs baseline 18.5% |
| `occupancy_adjusted_forecast` | `occupancy-adjusted-v1` | Base rate × occupancy uplift | Web UI directly, via its own RPC | data-gated (needs occ. variance) |

**The load-bearing break:** the most consequential decision — *how much to reorder* — runs on the
**least accurate** estimator (a flat mean), while the recency-weighted model the team invested in
(and measured ~30% more accurate) feeds only the waste path. PR #253 wired reorder-point into sizing
with `series.reduce(...)/n` (a flat mean over the daily series) — it shares the *censoring-corrected
series* with the adapters but applies none of the EWMA/auto-select weighting. The accuracy win exists
in the objective and never reaches the decision.

### The two accuracy systems — two islands

- **Forecast accuracy** (`objectives/consumption_forecast/accuracy.ts`, `backtest.ts`): MAPE / signed
  bias / censoring, per basis, per cohort. Grades the *adapters*. Reconstruction-based today.
- **Decision calibration** (`calibration/index.ts`): ECE / Brier on proposal *confidence* vs operator
  approve/reject. Grades the *agent's self-confidence*; feeds `recommendAutonomy` → auto-exec floors.

They never meet. Nothing composes "the forecast was X% off" with "the operator approved Y% of the
time" into a single trust signal. The forecast's own confidence (`reorder-point.confidence`, a
`0.4 + activeDays/30·0.5` heuristic) is never checked against realized forecast accuracy.

### Ground truth — built, then parked

`forecast_observations` (migration 183) + the definer RPCs `record_current_forecasts` /
`score_due_forecast_observations` exist — a real forward-record → score-when-window-closes loop. But
the recorder cron was **unscheduled** (PR #250): deterministic adapters can be reconstructed on the
fly, so the table was parked "for the future non-deterministic path." Consequence: the *live decision
path does not record what it predicted*, so we cannot ask "was the forecast that drove this proposal
right?" — only "what would today's model say about the past?" That gap becomes load-bearing the moment
occupancy (a non-reconstructable external input) enters sizing.

### Lineage — textual, not traversable

A `Proposal` carries `provenance: [{kind, ref, detail}]` — prose strings like
`reorderPoint=131, safety=19`. There is no structured `basis / confidence / sampleSize` on the
proposal and no edge from the proposal to the `forecast_observation` it relied on. You cannot query
"proposals whose forecast was >30% off" or "reverted actions by forecast basis." The ontology's
promise — traverse prediction → inputs → outcome — isn't yet realised for predictions.

### What already coheres (don't rebuild)

Backtest + cohorts; the accuracy instrument + surface; EWMA/Holt/auto-select; reorder-point (s,S);
censoring correction; `recommendAdapterPromotion` (dormant — no adapter evals recorded);
decision-calibration → autonomy recommendations. The machinery is strong. The wiring between the
pieces is the deliverable.

---

## 3. The roadmap — Phase Q (Prediction Coherence)

Sequenced by value ÷ effort. Each phase is independently shippable and eval-gated. This is
complementary to the model-accuracy backlog in `AIP-PARITY-ROADMAP.md` — that makes one model better;
this makes the models *cowork*.

### Q0 — See it (observability first, zero model change)  ✅ SHIPPED
- The **lineage diagram** (this doc's §2) names every estimator, its basis, its consumer, its accuracy hook.
- The **decision-quality north-star is instrumented**: `compute_decision_quality` Logic Tool +
  `scoreDecisionQuality` pure fn (`tools/logic/compute_decision_quality.ts`) — stock-out days +
  availability (under-order cost) and waste units + rate (over-order cost), the real-world face of the
  forecast's signed bias. Waste counts through the *one* shared `isWasteLog` classifier
  (`waste_classification.ts`, extracted from `query_recent_waste_logs` so the two can't drift).
  Surfaced as **"Decision quality (live)"** on the consumption-forecast objective page, above the MAPE
  accuracy card — so "the model's error" and "the decision's outcome" sit side by side. This is the
  number Q1+ must move. *"Build the measuring stick first" — the lesson that produced the accuracy instrument.*

### Q1 — One demand number reaches the decision  ✅ SHIPPED
- `compute_reorder_point` now takes an optional forecast **adapter**: when bound, the demand level
  (μ_d) — and therefore demand-over-lead-time — comes from the recency-weighted auto-select adapter
  (forecast straight over the lead time), not a flat mean. σ_d stays the empirical daily std (the
  adapter gives a level, not a spread). `basis` becomes `reorder-point-normal-v1/auto:ewma-v1` so the
  demand source is visible in the trace — a first taste of structured lineage (Q2).
- Wired on **every live path**: restock_advisor passes its adapter to the reorder tool (web already
  injects `useActiveForecastAdapter`); the cron `intelligence-cycle` injects `autoSelectV1Adapter`.
  Evals inject none → flat-mean fallback → deterministic fixtures unchanged (20 restock-eval cases stay green).
- Gated by the standing backtest evidence: auto-select beats the flat mean on live Valinor data
  (13.9% vs 18.5% MAPE). The Q0 decision-quality metric now measures whether it moves the *outcome*.
- Kills the "most consequential decision runs on the least accurate estimator" break.

### Q2 — Record ground truth + structured lineage  ✅ SHIPPED
- `AgentProposal` now carries the structured `forecast` that sized it (basis, projectedUnits,
  horizonDays, confidence). Both persist paths (web `createProposal`, cron `intelligence-cycle`) call
  the new `record_decision_forecast` RPC (migration 200) — recording the **actual** adapter forecast at
  decision time, not a SQL re-derivation like `record_current_forecasts` — with `source='decision'`
  and a `proposal_id` link.
- A typed `proposal —derived_from→ forecast_observation` edge is written best-effort alongside the
  existing `influenced_by` / `cited_in` edges. Prediction → decision → outcome is now one queryable chain.
- The dormant `score_due_forecast_observations` scorer is rescheduled (`beacon-forecast-score`, daily) —
  model-agnostic, it fills realized + error once each horizon closes. Recorded truth now survives
  non-deterministic inputs (occupancy) where reconstruction can't.
- Self-apply caught a real hole: the RPC's `REVOKE … FROM anon` left the default `PUBLIC` grant, so
  anon (NULL `auth_hotel_id()` → passes the scope gate) could write arbitrary rows. `get_advisors`
  flagged it; fixed to `REVOKE … FROM PUBLIC`. Verified live (anon can't execute; the row links correctly).
- *Deferred to a Q2 follow-up:* switching the accuracy surface from reconstruction to reading the
  recorded rows, and a proposal-view "forecast vs realized" display. The spine (record + link + score)
  lands here; the read-surface swap is additive.

### Q3 — One trust signal governs autonomy  ✅ SHIPPED
- `decideAutoExecution` now consumes **forecast-accuracy-by-basis** alongside decision calibration.
  The two accuracy islands are one gate: a well-calibrated agent whose *sizing forecast* has been
  running hot is **queued** — a confident, correct decision on a bad number is still a bad order.
  BLOCK-only (it never loosens), mirroring the calibration budget. Fires only with enough scored
  windows (default ≥3), so it activates as evidence accrues rather than vetoing prematurely.
- `max_forecast_mape` is a tunable org-policy knob (default 0.4), not a constant — and because the
  scenario sandbox merges a `DeepPartial<OrgPolicy>`, operators can simulate tightening it for free.
- The accuracy map is read once per hotel per cron run from the **scored decision-forecasts Q2
  records** — Q2's payoff: the gate can finally ask "has the model that sizes these orders been right?"
- *Deferred:* replacing the forecast's own heuristic confidence (`activeDays`) with an empirical
  hit-rate. It needs a pure logic tool to read realized outcomes, which breaks the tool contract —
  it belongs with the Q2 read-surface follow-up, not here.

### Q4 — Unify the estimators  ✅ SHIPPED (and it wins)
- `occupancy-v1` is now a **competing auto-select adapter**, not a second opinion in the UI. It's the
  first candidate with an EXTERNAL driver: every other adapter is a pure function of the variant's own
  logs, so they can only extrapolate the past. Bookings are largely on the books a week out, so
  forward occupancy is knowable in a way demand never is — that's the whole edge.
- `ConsumptionForecastInput.occupancy` is optional and additive: occupancy-blind adapters are
  untouched, and occupancy-v1 **degrades to EWMA at capped confidence** rather than guessing when the
  signal is absent or the category is inelastic — so auto-select can't pick it on evidence it lacks.
- **Graded by the instrument, live, on real demand — and occupancy does NOT win.**

  A first pass scored a *single* 7-day holdout and showed occupancy-v1 winning both hotels. That was
  **noise, and it was over-claimed**: moving the cutoff one day flipped the winner. `backtestForecastAdapters`
  scores one window; over 20 variants that is a tiny sample. The honest read uses the accuracy
  instrument over **10 rolling windows** (what auto-select already does internally):

  | Adapter | MAPE | bias | Mixers (0.90) | Spirits (0.45) |
  |---|---|---|---|---|
  | **baseline-rolling-30d** | **7.6%** 🏆 | −0.7% | 6.9% | 8.2% |
  | ewma-v1 | 9.2% | −1.5% | 8.8% | 9.5% |
  | seasonal-naive-v1 | 9.5% | −4.4% | 10.7% | 8.3% |
  | occupancy-v1 | 10.1% | −1.3% | **8.1%** | 12.2% |
  | holt-linear-v1 | 11.8% | −2.9% | 11.0% | 12.7% |

  **The rolling run found a real bug in occupancy-v1**: `histMean` was taken over ALL history (~85%,
  including the quiet winter) while `baseRate` is EWMA over the last 30 days — which already reflects
  today's ~97% occupancy. So it lifted demand by ~13% *on top of a base that already contained it*.
  Double-counting, measured as **+6.3% bias, worst of five**. Matching the windows fixed it
  (**+6.3% → −1.3% bias, 11.9% → 10.1% MAPE**), and a test pins it.

- **Why the simplest model wins right now, and that's the real lesson.** The seasonal ramp happened
  Jan–June; recent occupancy is *pinned near 100%*. With no variance left to exploit, demand is
  effectively stationary — and a flat 30-day mean beats every cleverer estimator, which only add
  variance without adding signal. Occupancy pays when occupancy **changes** relative to the recent
  norm. It isn't changing.
- **The design held even though the hypothesis didn't.** occupancy-v1 helps exactly where theory says
  it should — **Mixers, elasticity 0.90: 8.1%** — and hurts on Spirits (12.2%, elasticity 0.45). And
  because auto-select keeps EWMA as incumbent behind a 10% switch margin, it simply **won't pick a
  candidate that doesn't clearly win**. The safety design did its job without anyone intervening.
- *Caveat:* auto-select itself isn't in the table — it backtests internally, so grading it inside a
  backtest is recursive and slow. The comparison is between the base adapters it chooses from.
- *Deferred:* retiring the parallel `get_occupancy_adjusted_forecast` RPC + the variant-view card. The
  tool and the adapter now share one uplift model, so they can't drift; removing the RPC is cleanup,
  not coherence.

### Q5 — Prove it (close the loop, visibly)
- A **prediction-quality surface** (extends `FlywheelPage`): per-basis MAPE trend, and the
  decision-quality metric (fill-rate / stockout-days / waste) before-vs-after each model change, per
  cohort. A6 proved "the system learns"; this proves "the predictions are getting more accurate **and**
  the decisions better."
- Activate the dormant **promotion loop**: record forecast-adapter evals in CI so
  `recommendAdapterPromotion` lights up and adapter releases become earned + audited, like agent
  releases already are.

---

## 4. Recommended first move

**Q0 then Q1.** Q0 is the artifact that literally answers the question that prompted this doc (and is
nearly free). Q1 is the one change that turns "we have an accurate model" into "our decisions use it" —
small, backtest-gated, and it moves the north-star metric Q0 just defined. Everything after composes
on those two.
