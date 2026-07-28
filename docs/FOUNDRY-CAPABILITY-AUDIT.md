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
   or a *deliberate divergence*.

**Calibration on "deliberate divergence" (revised at section 5).** Being a vertical
product justifies narrower **scope** — fewer connectors, one LLM, no Spark. It never
justifies weaker **logic or execution**. If Foundry enforces a limit, tests a unit,
or pins a version, we should too, at our scale. Divergence claims in sections 1-3
that rest on scope stand; any resting on rigor are re-opened.

Status legend: ✅ parity · 🟡 partial · ❌ absent · ⬜ deliberate divergence

| # | Capability | Status |
|---|---|---|
| 1 | AI Platform (AIP) | 🟡 audited below |
| 2 | Data connectivity & integration | 🟡 audited below |
| 3 | Model connectivity & development | audited below |
| 4 | Ontology building | ✅ covered in `ONTOLOGY-PARITY-GAPS.md` + `GENERATED-OBJECT-VIEWS.md` |
| 5 | Developer toolchain | audited below |
| 6 | Use case development | audited below |
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

---

# 3. Model connectivity & development

Products: **integrate-models** (26), **manage-models** (18), **model-integration**
(15), **evaluate-models** (9), **compute-modules** (7), **model-catalog** (2),
**migrate-models** (2).

The section we copied most deliberately — CLAUDE.md's Modeling Objectives contract
(adapter with `api()` + `runInference()`, eval suite, releases
`sandbox to staging to production`, deployments `live | batch`) is Foundry's model
lifecycle almost term for term. Structural parity is real. The findings are about
**use**, not structure.

## 3.1 Model adapters — parity

Foundry's `model-adapter-api` wraps any model behind a uniform interface so callers
never talk to the model. Ours: `ModelAdapter` with `name`, `api()`,
`runInference()`, and six registered consumption-forecast adapters
(`auto_select_v1`, `ewma_v1`, `holt_linear_v1`, `seasonal_naive_v1`,
`occupancy_v1`, `baseline_rolling_30d`), all reachable through one Logic Tool whose
`basis` names which one answered. The rule that matters — *no code talks to a model
directly* — holds.

## 3.2 Evaluation — parity, and genuinely alive

`model_eval_runs`: **5,745 rows**, CI-fed through `autoPersistReporter`, with
per-case results and cohort slices. Foundry splits evaluators into regression /
binary-classification / custom; ours are Vitest suites with object-match,
string-contains and rubric graders. Different mechanism, same contract.

## 3.3 The release + deployment lifecycle — built, never used

`model_releases` and `model_deployments` exist (migration 131), `promote_model` is
role-gated, and require-staging is enforced server-side (#405, #406).

**Live: `model_releases = 0`, `model_deployments = 0`.**

Compare `agent_releases`: **5 rows, including production**. The agent lifecycle is
exercised; the model one is not.

Our forecast adapters are selected **in code** — `CONSUMPTION_FORECAST_ADAPTERS`
plus `auto_select_v1` — never through a release. `basis` changes from
`rolling-30d-avg` to `ewma-v1` because a function chose it, not because anyone
promoted it. That is precisely what the release machinery was built to prevent,
bypassed by code that predates it.

**Not a missing feature — an unused one**, which is worse: the safeguards look
present.

## 3.4 Models in the Ontology — the real conceptual gap

> Run model inference in the context of Ontology objects, **binding object
> properties to model inputs**, and exposing outputs as **object properties or
> function return values**. — `models-in-the-ontology`

Foundry binds a model to an object type: the object's properties *are* the model's
inputs, and outputs come back as properties, so model-backed Actions and UI follow
for free.

Ours takes a `variantId` and returns a forecast to whoever asked. The model is
reachable *from* the ontology but not bound *to* it — a `Variant` has no
`projected_demand` property a model fills; our computed properties are
deterministic functions only.

Same shape as the gap G1-G4 closed one layer down: the capability exists but is not
part of the type. **The section's most interesting gap**, because binding would make
forecasts visible everywhere a Variant is, instead of only where someone called a
tool.

## 3.5 Model checks — absent

Foundry's `set-up-checks`: per-objective quality checks (smoke tests, metric
thresholds, fairness), manual or automatic, before a model is operationalized —
and notably **not hard gates** there, but documented approvals.

We have no equivalent. Eval suites are closest but are pass/fail on cases, not a
reviewable checklist against an objective. Since we *do* hard-gate on evals, we are
stricter in one dimension and absent in another (no fairness or smoke-test concept,
no reviewer threads).

## 3.6 External model connections — deliberate divergence

`external-model-connection-{open-ai,sagemaker,vertex-ai}`, container models, compute
modules: bring your own serving infrastructure. We call Anthropic through one edge
function and run statistical adapters in-process. Right for a vertical.

## 3.7 Inference history and compute usage — partial

Foundry has `model-inference-history` and per-model `compute-usage`. We record
`forecast_observations` (feeding accuracy scoring) and `AgentRunStep.tokens`, but
there is no per-model inference log or spend view — the same cost-visibility gap as
section 1.1.

---

## Section 3 verdict

Structure copied faithfully; **operation diverged**. The release/deployment
lifecycle is the clearest case in this audit of machinery that exists, is correct,
and is simply not in the path.

Open gaps:

1. **Bind models to object types** (3.4) — model outputs as object properties. Most
   valuable, and consistent with the direction of G1-G4.
2. **Route adapter selection through releases** (3.3) — or consciously decide
   in-code selection is right and retire the tables. Either is defensible; the
   present state, where safeguards exist but nothing uses them, is not.
3. **Model checks** (3.5) — a reviewable pre-operationalization checklist.
4. **Inference history / compute usage** (3.7) — shares a fix with 1.1.

---

# 5. Developer toolchain

Products: **functions** (53), **code-repositories** (34), **ontology-sdk** (19),
**linter** (7), **checkpoints** (7), **foundry-devops** (8), plus `transforms-*`
and `code-workbook` / `code-workspaces`.

Audited under the revised rule above: scope may narrow, rigor may not.

## 5.1 Function unit testing — parity, and better than expected

Seven of the 53 function docs are about **unit testing** — stub objects, stub users
and groups, object searches, ontology edits, dates. Foundry's mechanism is
`Objects.create().objectType(...)`, building mock ontology objects so tests need no
live data.

We have the equivalent through the reader seam: `fakeReader({ stockLogs })` in tool
tests, in-memory `GraphReader` implementations for evals, `AuthoredToolReader`
stubs. Same property — logic is testable without a database.

**No gap.** Worth stating plainly, because it is the rigor mechanism that justifies
much of the rest of the architecture.

## 5.2 Tool versioning — declared, never enforced

`LogicTool.version` exists, and CLAUDE.md is explicit:

> **Versioned.** Bump version on input/output/basis change. **Callers pin.**

**There is no pinning.** `.version` is never read at call time — not in
`runtime.ts`, not in the registry, not by `invokeTool`. `catalog.test.ts` asserts
only `expect(t.version).toBeTruthy()`. A caller cannot pin, so a tool whose `basis`
changes silently changes every caller's answer.

Foundry's equivalent is real: functions are versioned artifacts and consumers bind
to a version. **This is a rigor gap, not a scope one** — exactly the class the
revised rule says we do not get to wave away.

Cheapest honest fix: enforce pinning at `invokeTool`, or delete the field and the
CLAUDE.md claim. A version nobody can pin to is decoration.

## 5.3 Enforced limits — partial

Foundry publishes hard runtime limits: 60s elapsed, 30s CPU (TS v1), 128MB-5GB
memory by runtime, **100,000 objects** per `.all()`, max 3 search-arounds. Exceeding
them terminates the function.

Ours are uneven:

| Bounded | Unbounded |
|---|---|
| agent loop `maxIterations = 8` | any Logic Tool's row reads |
| `tokenWindow = 24_000` | `evaluateUserToolAcross` across an interface's implementers |
| `MAX_AGENTS_PER_CYCLE = 3` | authored-tool aggregation scan size |
| edge function 150s (platform) | |

The agent loop is well bounded because we thought hard about model cost. The **data**
path is not: an interface tool spanning several large types has no equivalent of
Foundry's 100k object ceiling. The `.limit(1000)` in the copilot path is one call
site, not a contract.

## 5.4 Ontology SDK — the structural gap

Foundry **generates** a typed client from the ontology (19 docs, plus
`ontology-sdk-react-applications`), so application code gets types that cannot drift
from the live ontology.

We hand-write `@beacon/types` and reality-graph types while `object_types` is
config-as-data. **Those two can disagree** — and G2's `builtin_property_drift()`
exists precisely because they did. That tripwire *detects* a problem generation
would *prevent*.

Same finding as section 3.4 and G1-G4 from another angle: the ontology is the source
of truth for data, but not yet for **types**.

## 5.5 Repositories, transforms, workbooks, linter — divergence (scope), with one real borrow

Foundry hosts authoring environments: repos, Spark transforms in four languages,
notebooks, a linter for platform artifacts. We use git, TypeScript and ESLint outside
the product. Scope, not rigor — our equivalent gates (turbo lint, type-check, tests,
`check:edge`, DB contracts) run on every change.

**The genuine borrow is `checkpoints` / `foundry-devops`**: promoting platform
artifacts between environments. Our ontology artifacts — object types, interfaces,
automations, authored tools and agents — live in the database with **no export,
import or promotion path**. Moving an authored tool from a test org to production
means re-authoring it by hand. Foundry's `marketplace` and `export-import` exist for
exactly this.

---

## Section 5 verdict

Testing rigor is genuinely at parity. The real gaps are all versions of *the ontology
is the source of truth for data, but not yet for everything else*:

1. **Version pinning declared and unenforced** (5.2) — fix it or drop the claim; the
   present state misleads a reader of CLAUDE.md.
2. **No generated types from the ontology** (5.4) — drift is *detected* (G2) rather
   than *prevented*.
3. **No promotion path for ontology artifacts** (5.5) — authored types, tools and
   agents cannot move between environments.
4. **Data-path limits unbounded** (5.3) — the agent loop is capped, the row reads are
   not.

---

# 6. Use case development

Products: **workshop** (96), **use-case-examples** (20), **forms** (19),
**cross-app-interactivity** (9), **use-cases** (9), **marketplace** (7),
**use-case-patterns** (6), **use-case-life-cycle** (6), **app-building** (5).

The most useful thing here is not a product — it is `use-case-patterns`, which
names the five canonical operational shapes Foundry is built to serve:

`alerting-workflow` · `investigation-and-cohorting` ·
`operational-process-coordination` · `resource-allocation-optimization` ·
`multi-organization-ecosystems`

**Beacon is an instance of all five at once.** That is worth stating: it is
independent confirmation that the domain we picked is one the ontology pattern
was designed for, rather than one we bent it to fit.

## 6.1 Alerting workflow — parity, and ahead in one direction

Foundry's pattern: **Alert objects** for the thing needing review, **Trigger
objects** for the subject that prompted it, **Actions** recording decision
metadata (user, timestamp, decision, optional explanation), and **writeback** of
the result.

Ours maps one-to-one and then goes further: `Proposal` is the alert,
`variant`/`supplier` the trigger, the Action Registry records the decision with
`triggered_by`, `decided_at` and `edited_before_approval`, and the immutable
`StockLog` is the writeback.

Beyond the pattern we add confidence-coded queues, calibration scoring of those
decisions, and constraint gating before execution — none of which the pattern
requires.

**Foundry's pattern doc explicitly stops short of triage, assignment and
resolution.** We have resolution (Cases, lifecycle transitions). We do **not**
have assignment — see 6.2.

## 6.2 Investigation and cohorting — partial, and the section's real gap

> **Cohort and Rules objects that store investigation logic** … cohorts generated
> by manual rule creation, automated clustering, or exploratory analysis.

Two absences, both verified:

**No Cohort object.** `Case` is our investigation envelope (trigger → trace →
outcome) and it is good. But a cohort is the *grouping* that precedes an
investigation — "the set of variants with anomalous waste this month", stored as a
named thing with its rule, trackable over time. Ours are re-derived on every sweep
by `useMonitorCaseSweep`, which opens a Case per fired subject and keeps no record
of the group. There is no `cohorts` table.

The consequence is that investigation logic is not an ontology object. It lives in
a hook. That is the same class of gap as automations-before-#420 and monitors
before their config moved to `org_policy`: real capability that is not
config-as-data.

**No assignment.** Neither `proposals` nor `cases` has an assignee column —
`cases` has `opened_by_user_id` and `resolved_by_user_id` only. A hotel with three
managers cannot route a proposal to one of them, and nobody owns an open Case
between opening and resolution. Foundry's pattern doc omits assignment too, but a
multi-operator property needs it, and our echelon model (`org_director >
regional_manager > hotel_admin > hotel_manager > team_member`) makes its absence
more conspicuous, not less.

## 6.3 Operational process coordination, resource allocation, multi-org — parity

- **Process coordination** → the intelligence cycle, one loop with two callers.
- **Resource allocation optimization** → restock sizing, and lateral
  `TRANSFER_STOCK` checked before external procurement.
- **Multi-organization ecosystems** → `organization_id` + `hotel_id` on every node,
  scope-aware RLS, benchmarking across siblings.

These are the patterns we implement most completely.

## 6.4 Workshop — scope divergence, with the logic already borrowed

96 docs: build applications from ontology-bound widgets without writing code.

Building *many* applications is scope — we are one application. But the **logic**
is not scope, and we already adopted it: generated Object Views (G1-G4) render a
type from its ontology definition with no per-type code, and `ActionFormModal`
renders a form from an action's schema. That is Workshop's principle applied
where it matters to us.

What we do not have is **operator-composable layout** — an operator can author a
type, a tool and an agent, but cannot compose a screen. `viewConfig` is the
closest thing and only orders properties within a generated view.

## 6.5 Forms — parity in kind

19 docs on ontology-bound data entry with validation. Our actions declare
`open-form` and the modal is auto-rendered from the action's schema, with
submission criteria checked before execution. Same mechanism, narrower surface.

## 6.6 Marketplace — same gap as 5.5

Packaging a use case for distribution and installation elsewhere. This is the
export/import gap already recorded in 5.5, seen from the product side: our
authored ontology artifacts cannot leave the database they were authored in.

## 6.7 use-case-life-cycle — methodology, not software

`distilling-functional-requirements`, `sequencing-development`, `solution-design`,
`use-case-roles`. Process guidance rather than platform capability. No gap to
close in code; worth reading before the implementation map, since it is Palantir's
own account of how to sequence work like ours.

---

## Section 6 verdict

The strongest section for us. We implement all five canonical patterns, and on
alerting we exceed the documented pattern.

Open gaps:

1. **No Cohort object** (6.2) — investigation logic lives in a hook, not the
   ontology. Cohorts are the natural companion to the Case we already have.
2. **No assignment** (6.2) — proposals and cases have no owner; the role hierarchy
   makes this more glaring, not less.
3. **No operator-composable layout** (6.4) — an operator can author types, tools
   and agents but not a screen.
4. **No packaging/export** (6.6) — duplicate of 5.5; counts once in the map.
