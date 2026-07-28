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
| 2 | Data connectivity & integration | 🟡 audited below |
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

---

# 2. Data connectivity & integration

Products: **available-connectors** (193 docs), **data-connection** (30),
**data-integration** (27, mirrored), **analytics-connectivity** (25), **sap** (34),
**fusion** (22), **hyperauto**, **media-sets**, **microsoft-excel**, **email**.

The biggest section by doc count, and the one where "vertical solution vs
platform" changes the answer most. Reconciling by *concept*, not doc count.

## 2.1 Document ingestion — ✅ built to spec, and now PROVEN — with five defects found by proving it

**`docs/DOCUMENT-INGESTION-ROADMAP.md` was stale and is corrected in this change.**
Its gap table listed stages 1–8 and 10 as unbuilt (🔴/🟠). `document-ingest`
implements all of them, to the Foundry reference:

| Roadmap said | Actual |
|---|---|
| 🔴 no 512-char overlapping chunker | `CHUNK_SIZE = 512`, `CHUNK_OVERLAP = 128`, `chunkString()` |
| 🟡 chunk id `docId-chunk-{page}` | `${docId}_${page}_${chunk}` — Foundry's composite key exactly |
| 🟠 doc-level entity extract, no summary | per-chunk LLM `{summary, entities}` with categories |
| 🟠 embeds a 240-char preview | `text_full` populated; summary embedded |
| 🟠 `Chunk` not a node | `document_chunks` table + `chunk` in NODE_LABELS |
| 🟠 no `Entity` type | `entities` table + `entity` node type |
| 🟠 no `mentions` edge | written, and **fail-closed** (`gateFail('embedded.mentions_written', …)`) |
| 🟠 `cited_in` declared, never written | written, also fail-closed |

Those gates are the good part: ingestion refuses to advance a document's stage if
citations or mentions can't be written, rather than leaving a half-linked doc.

**The real finding is different, and worse: `documents = 0`, `document_chunks = 0`.**
The pipeline our own roadmap calls the differentiator has never run in this
environment. Everything above is verified by reading code, not by observing
output. The `documents` row of the object-view e2e gate is therefore skipping.

### Proven end to end (2026-07-28)

A real `text/plain` supplier agreement was ingested through the live edge
function under a real user session. **The pipeline works**, stage `raw →
contextualized`, and the Foundry-exact stages hold:

| Stage | Result |
|---|---|
| Chunking 512/128 | 2 chunks from 1 page |
| Composite key | `<docId>_1_1`, `<docId>_1_2` — exactly the spec |
| Per-chunk LLM summary | real summaries, not previews |
| Embeddings | 2/2 |
| `text_full` | 2/2 populated |
| `cited_in` edges | 2 (document → chunk) |
| `mentions` edges | 11 |
| Entity categorization | `Rivendell Provisions Ltd[supplier]`, `Valinor Hotel[location]`, `Lime/Orange Juice/Tomato[product]`, `Lead Time/Shelf Life[term]`, `Quality/Pricing[clause]` — genuinely good |

**But proving it surfaced five defects, none of which reading the code revealed.**

### D1 — Harmonization produces nothing (the differentiator is dead)

`entity_link_suggestions = 0`. `Lime` and `Orange Juice` **exist as real products**
and were extracted as `[product]` entities — exact name matches — yet stage 9
resolved nothing to a real node.

The roadmap calls resolve-to-real-node *"our differentiator, keep + elevate"*. It
is currently inert. **Highest-severity finding in the section.**

### D2 — The stage-9 gate is shallow, which is why D1 went unnoticed

`document-ingest` gates `citations_written` and `mentions_written` on **content**
(`gateFail('embedded.mentions_written', …)`), but gates entity-extract on
**HTTP status only** (`if (!exResp.ok)`). A 200 that wrote zero suggestions
advances the document to `contextualized` and reports success.

The fail-closed posture is real but inconsistently applied. One gate asserts the
call happened; the others assert the contract holds.

### D3 — Deleting a user destroys their documents and the citation graph

`documents_uploaded_by_user_id_fkey … ON DELETE CASCADE`. Deleting the probe user
silently removed the document **and all its chunks and edges**.

In a system whose premise is immutable audit and provenance, offboarding staff
would erase ingested evidence. StockLogs are never deleted; documents are one
`DELETE FROM auth.users` away. **Should be `ON DELETE SET NULL`.**

### D4 — Entities outlive their documents as orphans

23 entities remain, 0 documents. Entity rows are not cascaded or cleaned, so the
graph accumulates nodes nothing mentions. Either cascade them or make orphan
entities visible and reapable.

### D5 — The same real-world thing duplicates across categories

`Valinor Hotel Operations` exists twice — once `[supplier]`, once `[location]` —
because dedup is keyed on (hotel, name, **category**). Exactly the harmonization
problem D1 was meant to solve.

**Live state after the probe: `documents = 0` again** (D3 took it), so the
`documents` row of the object-view e2e gate is still skipping.

## 2.2 Connectors — ⬜ divergence in breadth, ✅ parity in kind

Foundry documents 193 connectors to generic enterprise sources (SAP, S3,
Snowflake, JDBC…). We have hospitality-specific inbound instead:

`mews-webhook` (PMS) · `square-webhook` (POS) · `ingest-pos` · `ingest-occupancy` ·
`parse-invoice` (vision) · `parse-shelf-photo` (vision) · `smart-import` ·
`document-ingest` · `fire-webhooks` (outbound)

For a vertical, that *is* the right connector set — breadth over generic sources
is a platform-vendor need. **Not a gap.**

What we lack is a **source registry**: Foundry's `source-type-overview` makes a
source a first-class configurable object with credentials, health and lineage.
Ours are nine hard-coded edge functions. Adding a connector means writing one.
That's the honest limitation, and it's the same shape as every gap this repo has
closed lately — a capability that exists in code but isn't config-as-data.

## 2.3 Datasets, builds, schedules, branching — ⬜ deliberate divergence

Foundry's dataset → build → schedule → branch model is a pipeline engine. Ours is
Postgres tables plus pg_cron running one intelligence cycle. We don't have a
build graph because we don't have derived datasets; computed values are node
properties resolved at read time.

Worth naming so it isn't mistaken for a gap later: **our "pipeline" is the
intelligence cycle**, and it already has the things that matter from this section
— a schedule, a health check, and observable runs.

## 2.4 Data health — 🟡 partial

Foundry: health checks on datasets and connections, plus stream monitoring.
Ours: `get_integration_health()` (migration 190) and the pipeline-health monitor
(#297). Covers connection liveness; does not cover *data* quality assertions
(row-count deltas, null-rate drift, schema expectations).

Adjacent to something we just built: `builtin_property_drift()` is a schema
expectation check. The same idea applied to data rather than schema is what
Foundry's health checks do.

## 2.5 Streams, CDC, Flink — ⬜ deliberate divergence

We are not a streaming platform. Worth noting that the webhooks *are* our event
stream — Mews and Square push, we react — which covers the operational need
without a streaming engine.

## 2.6 Virtual tables, external transforms, dataproxy, S3 API — ❌ absent

Foundry can compute over data **without copying it** (`virtual-tables`,
`external-transforms`, `foundry-s3-api`). We always ingest.

Plausibly relevant for a hotel group whose PMS or finance data can't be copied
for contractual reasons — but speculative until a customer asks. Recording it as
absent rather than divergent, since the reason to skip it is "no demand yet",
not "wrong for a vertical".

---

## Section 2 verdict

The section splits cleanly:

- **Genuinely divergent** (connector breadth, pipeline engine, streaming) — a
  vertical shouldn't rebuild a data platform.
- **Genuinely partial** (data health) — we check that connections are alive, not
  that data is sane.
- **Genuinely absent** (source registry as config-as-data; federated compute).
- **Built but unproven** — document ingestion, which is the urgent one.

Ranked:

1. **D3 — `ON DELETE CASCADE` on `documents.uploaded_by_user_id`.** A user
   deletion erases documents, chunks and citation edges. Data-loss severity;
   trivial fix.
2. **D1 + D2 — harmonization is inert and its gate can't see that.** The stage
   the roadmap calls our differentiator resolved zero exact matches, and the gate
   only checks HTTP 200. Fix the gate first; it would have caught this.
3. **D4/D5 — entity orphans and cross-category duplicates.**
4. **Source registry** — make a connector config-as-data instead of an edge
   function, so adding one doesn't mean shipping code.
5. **Data-quality checks** — extend the drift idea from schema to data.
