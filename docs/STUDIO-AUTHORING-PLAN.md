# Studio authoring plan — make Studio a creation environment

Status: **agreed direction (2026-07-23).** Supersedes the "defer visual authoring"
conclusion of [`AUTHORING-STRATEGY.md`](./AUTHORING-STRATEGY.md); keeps its discipline.

The product question this settles: *Studio was view-only for the things Foundry is
built to create. That was the wrong default. What does a Studio that lets operators
author, configure, and deploy look like — and in what order do we build it?*

---

## 1. The philosophy — what Foundry *is*, not just what it does

We are not copying Foundry's feature list; we are adopting its **stance**. Foundry is a
discipline for turning any operational concern into a **governed, versioned, deployable
artifact**. Five principles, and every Studio surface must obey them:

1. **Config-as-data, not code-as-config.** Anything an operator shapes is *data* in a
   managed store — changed without a deploy, versioned, reversible.
2. **One lifecycle for everything.** Object types, actions, tools, agents, models,
   monitors, *and* policies all move through the same arc: **author → validate/eval →
   release (sandbox → staging → production) → deploy (live / batch) → observe → feed back.**
3. **No dead-end views.** Every surface is a **control surface**. A view that only shows
   is a defect. Lineage is where you *configure*; a metric is where you *set a target and
   deploy the intervention*. (CLAUDE.md principle #4: decision support, not data display.)
4. **The loop closes on itself.** Observability is not the end of the line — it is the
   *input* to the next configuration. You see calibration drift → you retune the
   calibration policy → you deploy → you watch it move.
5. **Governed autonomy.** Everything authored is typed, gated through `decideAutoExecution`,
   audited, permission-scoped, and reversible. Authoring widens *what can be expressed*; it
   never bypasses the gate.

**Corollary (the correction that reshaped this plan):** a surface does **not** get to stay
view-only just because Foundry has no literal equivalent. System Map, Calibration, Flywheel,
and Forecast Lab are Beacon-specific — and they must still be control surfaces, because the
*philosophy* is universal even where the *feature* isn't.

---

## 2. Current state — the 18 Studio surfaces

| Surface | Today | Foundry equivalent | Target |
|---|---|---|---|
| Ontology (object/link types, properties) | View + approve grown types | Ontology Manager | **Author** |
| Actions (action types) | Code-only, no tab | Action Types (wizard) | **Author** |
| Logic Tools | View-only | Functions | **Author** |
| Agents | View + release-approve | AIP Agent Studio | **Author** |
| Modeling Objectives | View-only | Model Integration | **Author + deploy** |
| Monitors | Tune existing | Object Monitors | **Author new** |
| Object Views | Fixed layouts | Object Views | **Configure** |
| Documents | Upload/ingest ✅ | Data connection | keep |
| Constraints / Principles | Create ✅ | Action validations / — | keep |
| Scenarios / Action Chains | Create ✅ | Workshop Scenarios / — | keep |
| Policy / Copilot | Config ✅ | Automation / AIP config | keep |
| Approved Answers / Entity Links | Approve/curate | AIP | keep |
| **System Map** | View | Data Lineage | **Control surface** (§4) |
| **Calibration** | View | Model metrics | **Control surface** (§4) |
| **Flywheel** | View | Observability | **Control surface** (§4) |
| **Forecast Lab** | Run backtests | Model Integration | **Control surface** (§4) |

Nothing lands in a permanent "view-only" column.

---

## 3. Build phases (the *creation* surfaces)

Ordered by value × Foundry-centrality × safety. Each obeys §1.

- **Phase 1 — Author new Automations / Monitors.** The "**when** ‹ontology condition› **→**
  ‹typed tool/action effect› **→** ‹gate: review or auto-above-confidence›" composer,
  authored as data with NL + typed dropdowns over the existing registries. Bounded, safe,
  audited the day it's created. Fastest path to "I can create things in Studio."
- **Phase 2 — Ontology authoring (the flagship).** A DB-backed *user-defined* ontology layer
  the engine reads alongside the code substrate: object types, properties (incl.
  computed/formula), link types, **action types** — Ontology-Manager-style, with
  **save/restore versioning**. Sub-phased: object types & properties → link types → action
  types → computed properties.
- **Phase 3 — Object Views authoring.** Configure each object type's Object View layout
  (sections, metrics, panels). Sits on Phase 2.
- **Phase 4 — Logic Tools / Functions authoring.** Bounded formula/computed-property
  authoring + NL-native "describe a tool → scaffold typed schema + starter eval →
  release-gate." Also the home of **model authoring + deployment** (see Forecast Lab, §4).
- **Phase 5 — Agent authoring.** NL-native composition: describe the agent → scaffold blocks
  + numbered procedure + starter eval → promote sandbox → staging → production.

---

## 4. Observability → control (the surfaces Foundry lacks, reframed)

These are not authored *artifacts* like an object type; they are **control loops**. Each
gains configuration + deployment levers appropriate to what it governs.

- **System Map → the ontology authoring canvas.** Click a node to edit its type; draw an
  edge to create a link type; select a path to attach a monitor or health check; spot an
  unused type and prune it. The map you *build from*, not just read. (Visual entry to Phase 2.)
- **Calibration → the calibration-policy control surface.** Configure the calibration model
  (edit penalty, half-life), set a **target ECE** per agent/cohort, define how calibration
  gates the trust budget, and **deploy** a recalibration or threshold change — not just view
  the drift.
- **Flywheel → the learning-loop governor.** Set improvement **goals** (approval-lift,
  waste-reduction targets), configure what the loop tracks, and author **interventions** that
  fire when it stalls ("if approval rate < X, pause auto-exec and alert") — deployed through
  the gate.
- **Forecast Lab → model authoring + deployment.** Configure the adapter, run the
  backtest/eval, pick the winner, and **deploy** it — promote to production, choose live vs
  batch, set the eval gate. The Modeling-Objectives lifecycle, made operable.

---

## 5. The discipline (carried forward, non-negotiable)

From the old strategy, and reinforced by Foundry itself (Ontology Manager *has* save/restore
versioning; actions *have* typed validations; models *are* eval-gated):

- **Typed grammar over free-form.** Conditions are ontology/threshold predicates; effects are
  registered tools/actions. Auditable by construction.
- **Every write through the one gate + audit.** No authored artifact gets a second execution
  path around `decideAutoExecution`.
- **Versioned + reversible.** Save/restore changes; promote across release stages; roll back.
- **Eval before production.** Nothing an operator authors reaches `production` without a green
  eval at the prior stage.
- **Permission-scoped.** Authoring inherits the multi-tenant scope model; higher roles author,
  writes stay scope-gated.

This is a living document — refined as each phase is designed.

---

## Update 2026-08-04 — the logic canvas editor shipped, narrowed

This plan chose NL as the builder and declined a visual editor. The editor was
then asked for, and building it surfaced the constraint that decides its shape:

**Our procedure compiles into a prompt, not into an executed graph.** So the
canvas edits Foundry's *Use LLM* block and nothing else — Conditionals and Loops
would become prose an LLM interprets, which is not what a block is.

What the canvas adds over the row form it replaced is the thing a list cannot
show: **the typed handoff**. Choose `forecast_consumption` on step 2 and step 3
is authored knowing it will have `projectedUnits`, `basis` and `confidence`. The
clarification rule — appended by `compileAgent`, never authored — is drawn as the
terminal block, so an author can see where their procedure actually ends.

NL authoring is unchanged and still generates into this same data. The two are
not alternatives: the generator writes the procedure, the canvas is where you
read and adjust it.
