# 03 · Speedrun: Your First Agentic AIP Workflow

Source: `source/03-agentic-aip-workflow/` (38 lesson PDFs). Advanced; assumes guide 2. Use case:
clinical-trial patient recruitment — automate the **eligibility-assessment** step with an agent, keep
humans on edge cases. Builds on a pre-installed Marketplace ontology (Patient + Clinical Trial + a
recruitment Workshop app).

## Verbatim step-spine

1. **Install the foundational ontology** (Marketplace) — Patient + Clinical Trial objects + "Clinical
   Trial Recruitment Hub" Workshop; every patient starts `Eligibility Decision = Pending`.
2. **Encode the process first** — the lesson is explicit: automation is only possible *after* the
   process is understood and encoded in the Ontology (data + logic + actions). Steps: (1) review
   criteria + aggregate candidates, (2) review eligibility, (3) enroll. Automate step 2; keep human
   oversight for edge cases.
3. **Create the agent (AIP Logic "Review Patient for Clinical Trial"):**
   - **Use LLM block.** System prompt returns JSON `{enrollment_decision, enrollment_reasoning}` with
     three branches: **Suitable / Not suitable / Manual review required** (the last when info is
     missing). Task prompt injects trial `<criteria>` + ~11 patient variables. Output struct
     {eligibility_decision, eligibility_reasoning}, Single completion.
   - **Ontology Action block.** Attach the existing `Modify Eligibility Decision` action; map the LLM's
     `eligibility_reasoning`/`eligibility_decision` into its parameters. *"The agent is using this very
     same action"* a human triggers from the app — dual-callable.
   - **Preview** in the Debugger (shows execution steps + proposed ontology edits). **Publish**
     (user-scoped execution) as a function.
4. **Evaluate the agent (AIP Evals, in Logic):**
   - Create an Evaluation Suite; inputs = Patient + Clinical Trial objects.
   - Add **diverse test cases** (suitable / not suitable / missing-info).
   - **Expose the LLM block's output** for evaluation (unit-test the non-deterministic part, not the
     ontology edit).
   - **Evaluator = Exact string match** on `eligibility_decision` vs an `Expected value` column.
     (Built-in + custom evaluators available.)
   - **Run**; inspect aggregated metrics + per-case pass/fail + intermediates.
   - **Compare across LLMs** — swap model (e.g. GPT-4.1 mini), rerun, diff the two runs side by side.
5. **Automate the agent (Automate):**
   - **Trigger** = "Object added to set" for Patient.
   - **Effect** = run the agent function with `clinicalTrial` = static object.
   - Execute across all patients; observe eligibility columns auto-populate; **History/event log** shows
     each trigger + agent status.
   - **Add a new patient** → automation fires automatically → decision populated. (Or a scheduled
     pipeline can add patients.)
6. **Human-AI teaming** — patients marked "Manual review required" go to an SME, who now reviews *with
   the agent's reasoning already attached*, speeding the decision.
7. **Next steps named:** more agents (summarize criteria PDFs), clearer manual-review surfacing, and
   **AIP Agent Studio** for *interactive* agents (LLM + Ontology + documents + custom tools) — vs this
   background agent.

## Beacon mapping — full parity; this is our agent framework verbatim

- **Agent in AIP Logic → edits ontology via an Action** = Beacon agents: read via tools, **propose a
  typed `BeaconAction`**, never raw text to a writer. The "same action a human uses" is our
  dual-callable Action Registry.
- **"Manual review required" branch** = our **`request_clarification`** — below confidence, pause and
  ask the operator instead of emitting a low-confidence proposal. Foundry hard-codes it as a third
  enum; we gate on a confidence threshold (default < 0.6). Same behavior.
- **AIP Evals: test cases + expose-the-LLM-block + evaluator + cross-LLM diff** = our eval pipeline
  (`model_eval_runs`, cases + CaseMatrix diff + cohorts). "Unit-test the non-deterministic part, not
  the deterministic edit" is precisely our object-match vs rubric split. Cross-LLM run comparison =
  our EvalDiffView.
- **Automate: trigger on object-added → run agent → write ontology** = our **intelligence cycle**
  (`runIntelligenceCycle`, on-event/cron cadence) composing `decideAutoExecution`. "Live monitoring on
  a new object" = our on-event cadence + monitors.
- **Debugger (execution steps + proposed edits)** = our `AgentRunTrace` rendered in the developer
  debugger + operator slide-over.
- **AIP Agent Studio (interactive agents)** = our selection-aware operator **copilot** (`copilot-chat`)
  — the interactive counterpart to the background cycle. Both already exist.

The single conceptual nuance worth noting: Foundry's eval→automate ordering is our **release gate**
(`promote_agent` server-verifies production vs `model_eval_runs` before `decideAutoExecution` will
auto-execute). Guide 3 evaluates *then* automates by hand; Beacon enforces that ordering as a gate.
Slight edge to us.

## Mandatory-step ledger

| # | Mandatory step | Beacon | Where |
|---|---|---|---|
| 1 | Encode the process in the ontology before automating | ✅ | typed lifecycles + nodes/edges/actions |
| 2 | Build agent that reasons over unstructured inputs | ✅ | agent blocks + numbered task prompt |
| 3 | Agent proposes a typed Action (dual-callable) | ✅ | `BeaconAction`, same action as human |
| 4 | Uncertainty branch → human review | ✅ | `request_clarification` (< confidence threshold) |
| 5 | Preview/debug the agent run | ✅ | AgentRunTrace debugger + slide-over |
| 6 | Eval suite: diverse test cases | ✅ | `*.eval.ts` ≥10 cases, cohorts |
| 7 | Expose the non-deterministic step for eval | ✅ | object-match on LLM output |
| 8 | Evaluator (exact match / rubric) | ✅ | object-match, string-contains, rubric grader |
| 9 | Compare performance across models/versions | ✅ | EvalDiffView / CaseMatrix |
| 10 | Automate: trigger → run agent → write | ✅ | intelligence cycle + decideAutoExecution |
| 11 | Observe automation history/event log | ✅ | run traces + cycle metrics + review feed |
| 12 | Human-AI teaming on edge cases (reasoning attached) | ✅ | confidence-coded review queue + reasoning |
| 13 | (Release only after eval evidence) | ✅✅ | eval-gated `promote_agent` — stronger than the guide |

**Verdict: 13/13 ✅** (one at ✅✅). Guide 3 is Beacon's agent framework end to end. Beacon additionally
*enforces* the eval-before-automate ordering as a release gate, which the guide leaves to the builder.
