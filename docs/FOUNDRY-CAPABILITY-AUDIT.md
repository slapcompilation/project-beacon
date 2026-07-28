# Foundry capability audit — section by section

A systematic walk of Foundry's documented capabilities **in the order its own docs
navigation lists them**, reconciling each against what Beacon has. Successor to
`ONTOLOGY-PARITY-GAPS.md`, which covered only the Ontology section.

## Method

1. Enumerate the products under a capability from `all-foundry-urls.txt`
   (115 top-level path segments, 3,696 URLs).
2. Read the docs — from `mirror/` where mirrored, fetched otherwise. **Never
   reconcile from a product name alone**; the name rarely predicts the concept.
3. Reconcile against our system, **verified against the code**, not remembered.
4. Record: parity / partial / absent — and for absences, whether they're a *gap*
   or a *deliberate divergence* (we are a hospitality vertical, not a platform).

Status legend: ✅ parity · 🟡 partial · ❌ absent · ⬜ deliberate divergence

| # | Capability | Status |
|---|---|---|
| 1 | AI Platform (AIP) | 🟡 audited below |
| 2 | Data connectivity & integration | — not yet audited |
| 3 | Model connectivity & development | — not yet audited |
| 4 | Ontology building | ✅ covered in `ONTOLOGY-PARITY-GAPS.md` + `GENERATED-OBJECT-VIEWS.md` |
| 5 | Developer toolchain | — not yet audited |
| 6 | Use case development | — not yet audited |
| 7 | Observability | — not yet audited |
| 8 | Analytics | — not yet audited |
| 9 | Product delivery | — not yet audited |
| 10 | Security & governance | — not yet audited |
| 11 | Management & enablement | — not yet audited |

---

# 1. AI Platform (AIP)

Products: **AIP Logic** (10 docs), **AIP Assist** (8), **AIP Chatbot Studio** (6),
**AIP Threads** (2), **Solution Designer** (4).

## 1.1 AIP Logic — 🟡 partial, and the closest thing to our core

Foundry's AIP Logic is an LLM-backed **function**: no-code authoring, tool calls,
typed output, an eval suite, and an Automate integration that stages Ontology
edits for review.

That is nearly a description of our authored agents. We have the composer
(`user_agents` → `compileAgent` → `runToolLoop`), the bounded toolset, the
release gate, and the Automate equivalent (the intelligence cycle, #420).

**What's genuinely different: AIP Logic is a *function*, callable from anywhere.**
Workshop widgets, Action types and other functions can invoke it. Ours emits
proposals into one cycle. The reach is narrower by construction, not by accident —
but it means "use this agent's answer inside another surface" isn't expressible.

`logic/compute-usage` also tracks LLM spend per function. We populate
`AgentRunStep.tokens` (#325) but never aggregate it into a cost view. **Partial.**

## 1.2 AIP Evals — ✅ parity

Suites, test cases, evaluation functions, metrics, version comparison. We have
all of it: eval suites, `model_eval_runs.cases`, CaseMatrix, cohort slices,
EvalDiffView, and the release gate that consumes results. Foundry's
`evaluations-metrics-dashboard` maps to our Calibration + Flywheel pages.

## 1.3 AIP Assist — ❌ absent, and the seeds are already here

> AIP Assist … ask questions in natural language and receive real-time help …
> **awareness of which Foundry application you're currently using** … draws on
> platform documentation, developer documentation, and **custom content sources
> administrators configure**.

This is *platform help*, not operational Q&A. "How do I author a tool?", "what
does this page do?", "what does PAR mean?" — verified absent: no help assistant
exists in `apps/web`.

We have an **operational** copilot (asks about the ontology) and, notably, two
thirds of the substrate for the other one:

- `ApprovedAnswer` — a curated Q&A tier-1 cache, served before any LLM call, now
  with an Object View and hit metrics (#422).
- `GLOSSARY` in `objectPresentation.ts` — plain-language definitions already
  served as metric tooltips.

**The gap is the surface and the app-awareness, not the knowledge store.** That
makes this unusually cheap for its value, and it compounds with the authoring
work: a Studio that can be *authored* by an operator should be able to *explain
itself* to one.

## 1.4 AIP Chatbot Studio — 🟡 partial: we have one copilot, not authorable ones

Foundry's core concepts here are worth naming precisely, because they don't map
to our vocabulary:

| Foundry | Meaning | Ours |
|---|---|---|
| **Retrieval context** | content fetched per message and passed to the LLM | `query_document_chunks`, `matchApprovedAnswers` — but fixed, not configurable per bot |
| **Tools** | external functions the LLM may call | our Logic Tool registry + authored tools ✅ |
| **Application state** | app variables injected into prompts to steer behaviour | selection-aware copilot passes the current Object View's id — narrower |

The structural difference: **Chatbot Studio authors many chatbots; we have one
copilot.** `copilot_config` is a singleton (migration 137 stores tool configs for
*the* copilot). Our authored agents are multi — but they're procedural and emit
proposals, where a chatbot is conversational and answers.

Whether we want N chatbots is a product question, not an obvious gap. Worth
deciding rather than drifting.

## 1.5 AIP Threads — ❌ absent, but we hold the harder half

Ad-hoc document analysis: drag in a PDF, ask questions, get answers with citation
tracking. No configuration.

We have the *harder* part already — typed `Document` ingestion with page-level
provenance, `cited_in` edges, and a rule that agent rationales must carry
page-level citations. What's missing is the *easy* part: a low-friction surface to
ask a question of a document without it becoming a Case or a Proposal.

## 1.6 Solution Designer — ⬜ deliberate divergence

Architectural diagramming with AI review, for designing solutions on the
platform. We have System Map and the ontology canvas, which visualise the
*running* system rather than a proposed one. A design-time diagramming tool is a
platform-vendor need; we are one vertical solution, so this is not a gap.

---

## Section 1 verdict

Our AIP coverage is strong exactly where it's operational (Logic, Evals) and
absent exactly where it's *explanatory* — Assist and Threads are both "help a
human get an answer quickly", and we have built every layer beneath them without
building either.

Ranked by value over effort:

1. **AIP Assist equivalent** — highest. Knowledge store exists (`ApprovedAnswer`,
   `GLOSSARY`); needs a surface and app-awareness. Directly serves the "operator
   authors the system" thesis.
2. **AIP Threads equivalent** — ad-hoc document Q&A over ingestion we already have.
3. **Cost/compute view** over `AgentRunStep.tokens` — small, and we already pay to
   collect the data.
4. **Multi-chatbot** — decide deliberately; may be a divergence rather than a gap.
