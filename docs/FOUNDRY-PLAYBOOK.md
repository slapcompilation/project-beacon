# Foundry-as-Playbook — the Hospitality AIP strategic map

> Consolidates the **complete** Palantir Foundry / AIP end-to-end tutorial — Pipeline Builder →
> Ontology Manager → Vertex → AIP Logic → **Workshop** — into one strategic map for Beacon. Foundry is
> our **playbook, not our competitor.** They pioneered the ontology-operating-system; we take their
> proven patterns and aim them at the one vertical they structurally won't enter.
>
> This doc captures three things, not just features: **what each module *represents*, the *sequence* a
> builder moves through, and how each maps to Beacon.**

---

## 0. The thesis

**Beacon is the vertical AIP for hospitality.** Palantir sells a *horizontal* platform into defense,
intelligence, and industrial **supply-chain / procurement / logistics**. Nobody has built the
hospitality AIP, and Palantir's model (sell a platform to enterprises) means they won't build vertical
apps. That's a defensible wedge: same principles, a market they've left open.

The rule for every Foundry pattern in this doc:

> **Copy the shell. Own the semantics. Keep our backend.**

- **Copy the shell** — the interaction grammar (Object Views, Search Around, the AIP-Logic block model,
  the Workshop widget model). A decade of refinement; copy it.
- **Own the semantics** — their Airport/Flight/Aircraft becomes our Hotel/Variant/Supplier/Occupancy;
  their Flight Alert Inbox becomes our Restock Review Queue; their procurement actions become our
  `REQUEST_RESTOCK` / `TRANSFER_STOCK`.
- **Keep our backend** — Foundry's two-tier *datasets → mapped-ontology* split exists because it's a
  general platform ingesting arbitrary data. A vertical collapses it: our reality-graph nodes/edges
  **are** the ontology. That collapse is an *advantage*, not a gap — same UX on a simpler, type-safe,
  git-governed backend.

---

## 1. The AIP architecture, mapped

Foundry's own three-layer stack, and where Beacon sits:

| Foundry layer | What it is | Beacon equivalent |
|---|---|---|
| **Leverage Your Data Asset** | raw *datasets* (Pipeline Builder output) | (we skip the raw-dataset layer for domain data) |
| **Create an API for your Organization** | *object types* + *link types* (Ontology Manager) | **`packages/reality-graph`** — typed nodes + typed edges, by construction |
| **Solve Operational Problems** | AIP Logic functions · Vertex graphs · Workshop apps | our agents/Logic Tools · GraphConnections (weak) · the React app |

**The structural difference in one line:** Foundry is *datasets, then an ontology overlay, then apps*.
Beacon is *code-as-ontology* — one layer that is both storage and API. Foundry needs the extra layer
for generality; a hospitality product doesn't, and shouldn't pay for it.

---

## 2. The build journey — what each stage *represents*, and the sequence

The tutorial isn't a feature tour; it's a **bottom-up assembly line**, and each stage plays a distinct
conceptual role. The full flow:

> **Articles (Media Set) → Document Processing (Pipeline Builder) → Chunks / Entities / Join Table
> (Datasets) → Chunk & Entity Object types + a link (Ontology) → AIP Logic function + Vertex graph →
> Workshop App.**

| # | Stage (Foundry) | What it *represents* | Beacon equivalent | Verdict |
|---|---|---|---|---|
| 1 | Media Set (Articles) | your raw, unstructured assets — "the mess" | `Document` nodes (uploaded PDFs) | Have |
| 2 | Pipeline Builder (Document Processing) | the ETL that turns the mess into queryable nuggets | doc-ingest, **stubbed at OCR** | **Build** |
| 3 | Datasets (Chunks / Entities / Join Table) | clean, structured staging tables | *(we skip — code-as-ontology)* | N/A |
| **4** | **Object + Link types (Ontology)** | **the pivot — data becomes *meaning* the org can query. THE product.** | reality-graph nodes/edges | Have (by construction) |
| 5 | AIP Logic (Ontology Augmented Generation) | grounded business logic / agents over the ontology | our agents / Logic Tools | Have (as code) |
| 5 | Vertex (Knowledge Graph) | see + simulate the ontology | GraphConnections (weak) | **Build** |
| 6 | Workshop (the App) | the operational surface end-users touch; captures decisions | React app + NL authoring | Have / leapfrog |

**Stage 4 is the pivot.** Everything *below* the ontology is plumbing to fill it; everything *above*
consumes it. That's the single most important thing the sequence teaches — and it's why **Beacon's
journey is shorter: we start at stage 4.** Our reality-graph is the ontology by construction, so we
don't climb the datasets ladder — we fill the ontology *directly* (doc-ingest → resolve mentions to
real nodes) and consume it *directly* (agents + graph + app). Foundry needs six stages because it's a
general platform; a vertical needs three.

**The interaction grammar within each stage** (the sequence a builder actually feels):

- **Pipeline Builder** — *add data → chain transform blocks (each previews live) → add output → deploy.*
- **Ontology Manager** — *pick datasource → metadata → properties (primary key + title) → actions →
  save via branch / proposal.*
- **AIP Logic** — *typed inputs → drag blocks (Semantic search / Use LLM / Control flow / Ontology) →
  one output → preview-run in the Debugger → publish.*
- **Vertex** — *add objects → Search Around a relationship → layout → save as a parameterized template.*
- **Workshop** — *nest Sections → drop Widgets → wire each widget to variables (one input fans out to
  many views) → Save & publish → View.*

---

## 3. Module-by-module scorecard

### 3.1 Pipeline Builder — Document Processing → **BUILD the arc**
PDF → extract text → chunk (512, overlapping) → composite **chunkId** → LLM (`{summary, entities}`) →
three outputs: **Chunks** (with embeddings), **Entities** (deduped), **Join Table** (the many-to-many).

- **Beacon status:** we have the *destination* (a `Document` node, `describes_entity`/`cited_in` edges,
  `query_document_chunks`, pgvector) but the *pipeline that fills it stops at OCR*. This module is the
  complete blueprint for the stage we stubbed.
- **The differentiator:** Foundry keys entities on the extracted *string* (discovered entities) and
  builds the link as a *Join Table dataset*. For us, the killer move is **resolving the mention to an
  existing operational node** (`chunk —describes_entity→ Supplier #42`) so the document becomes *about*
  something we already act on — and the "join table" is a native edge, no bridge dataset.
- **Steal regardless:** composite natural keys (`documentId_page_chunk`, not a UUID).

### 3.2 Ontology Manager — object/link types + governance → **HAVE (collapsed)**
4-step object wizard (Datasource → Metadata → Properties [primary key + title] → Actions). Link types
(FK 1:1/1:many · Join-table many:many · Intermediary backing object). Branch → Proposal → **Review
edits (Warnings / Errors / Migrations / Conflicts)** → Save to ontology.

- **The punchline:** the Review-edits flow is **git + CI rebuilt inside a GUI** — because Foundry's
  ontology is *configuration*, not code. Ours is code, so we use the real thing:

  | Ontology Manager | Beacon |
  |---|---|
  | Ontology branch → Proposal → merge to Main | git branch → PR → merge |
  | Review edits: Errors / Warnings | `pnpm turbo lint type-check test` · `get_advisors` |
  | Review edits: Migrations / Conflicts | SQL migrations + lifecycle triggers · merge conflicts |

- **Honest tradeoff (where Foundry wins):** a non-engineer can evolve their ontology via the GUI +
  Proposal. Ours needs an engineer + PR. **Our answer is more ambitious, not weaker:** the
  self-evolving-ontology / NL-feedback loop lets operators grow the vocabulary by *talking*.
- **Auto-generated CRUD actions + "who can execute"** = our Action Registry (`BeaconAction` with
  submission criteria, audit, invocation mode) + scope-gating. Ours are *richer* — domain verbs.

### 3.3 Ontology-aware applications — the consumption layer → **mixed**
| Foundry app | Beacon surface | Status |
|---|---|---|
| **Object Views** (360 hub) | our Object Views (header → metric strip → action bar → body → right rail) | ✅ our AIP-UX parity work |
| **Object Explorer** (search / filter / **Search Around**) | `/objects` type browser + `GraphConnections` | ⚠️ **gap — build** |
| **Quiver** (analysis / dashboards / time-series) | Insights lenses + Flywheel + decision-quality trend | ⚠️ partial |
| **Workshop** (no-code app builder) | React app + NL copilot | ⏭️ leapfrog (see §3.6) |
| **Slate** (high-code app builder) | our React app | ✅ this *is* us |
| **Carbon** (workspace of apps + tabs) | sidebar / Studio landing / Mind IA | ⚠️ partial |
| **Map** (geospatial) | maplibre portfolio home | ✅ have |

The app comparison taxonomy — *(use case × workflow style × config model)* — is a **free audit lens**.

### 3.4 Vertex — knowledge graph + simulation → **BUILD (our biggest gap)**
Add objects → **Search Around** (traverse a relationship, pull in linked objects) → **Layout** (Radial,
Cluster, Hierarchy…) → save as a **parameterized Template** (parameters → search-arounds → layers →
graph). Beyond visualization: a **causal simulation graph / digital twin** — chain models, overlay a
demand forecast on a node, *"simulate how a change to one object affects others."*

- **Beacon status:** `GraphConnections` is *static, one-hop, per-node*. We have **no** interactive
  Search-Around explorer, no parameterized graph templates, and no visual causal-simulation graph.
  Scenarios (the graph-overlay sandbox) is adjacent but not this.
- **The module where Foundry is clearly ahead**, and the simulation graph is the single feature that
  would make a hospitality AIP *feel* like Palantir.

### 3.5 AIP Logic — the LLM-function builder → **HAVE (as code)**
Typed **Inputs** → **Semantic search** block (RAG over an embedding property) → **Use LLM** block
(grounded prompt, Single-completion vs **Chain-of-Thought**, output enforcement) → **Output** (a value
**or ontology edits**). Preview run + **Debugger** (per-block timing, "Add as test case"). Publish
(API name, versioning, bound-to-ontology, docs *for the LLM*).

- **It's our reality-graph agent stack, one-to-one:**

  | AIP Logic | Beacon |
  |---|---|
  | Logic function (typed in → blocks → one out) | agent / Logic Tool (zod in → blocks → typed out) |
  | Semantic search block | `searchDocumentChunks` / `matchApprovedAnswers` (pgvector) |
  | Use LLM block | our LLM blocks (`extract_variant`, `reason_and_propose`) |
  | Single completion vs **Chain of Thought** | `reasoning: 'deterministic' \| 'llm'` (the `runToolLoop`) |
  | Tools (LLM accesses ontology / functions) | the `LogicTool` set the agent may call |
  | **Output = ontology edits, staged for review or auto-applied** | proposal → `decideAutoExecution` → review queue |
  | Preview run + Debugger + "add as test case" | eval suites + `TracePanel` + `AgentRunStep.tokens` |
  | Publish (API name, versioning, docs-for-LLM) | tool registry + versioning + release gate |

- **The names align because the thesis is identical:** Foundry's function is called *"Ontology Augmented
  Generation"*; our CLAUDE.md names the whole system *"Ontology-Augmented Generation."*
- **We're ahead on substance** — the only open question is the *authoring surface* (their GUI vs our
  typed-code-plus-NL). Leapfrog with NL, don't clone the block palette.

### 3.6 Workshop — the app that ties it all together → **the NL-leapfrog target**
The final module builds the payoff: a **natural-language document Q&A app** ("Ontology Augmented
Generation App"). It's the whole course in one screen, and its structure is the most important UX lesson
in the tutorial.

**A Workshop app = a tree of nested Sections and Widgets, wired by variables.** Every widget "acts like
a function": it reads variables as input and writes output variables from user interaction. The app the
tutorial assembles, top to bottom:

1. **Text input** widget → writes a `User Question` string variable.
2. **Object list** widget, backed by an object-set variable "Relevant Chunks" = *semantic search as a
   filter*: Starting set = Chunk, Filter on the **Embedding** property (K-nearest-neighbors), Query =
   `User Question`, K=10. **RAG retrieval, declared at the app layer** — no code.
3. **Vertex Graph** widget, backed by the Knowledge Graph *template*, input = the Relevant Chunks set →
   shows the retrieved chunks + their entity links, live.
4. **Markdown** widget, input = a **Function** variable calling the `Ontology Augmented Generation` Logic
   function with `User Question` → renders the grounded, cited LLM answer.

Then *Save & publish → View*.

- **One text input fans out to three synchronized views** (retrieved chunks · the graph · the answer).
  **That reactive-variable model is exactly our selection-aware ContextPanel** — one selection drives
  the detail tab, the graph, and the copilot. Foundry calls it a variable; we call it the selected node.
  Same idea, and we already have the primitive.
- **Two validations worth flagging:**
  - **"Ask AIP Assist"** appears *inside* Workshop's widget config — Foundry is bolting an NL helper
    onto its own drag-and-drop builder. **Even Palantir is migrating toward NL authoring.** That's the
    strongest possible endorsement of our leapfrog: skip drag-and-drop, go NL-native from the start.
  - **Writeback** is a first-class widget category — *"expose opportunities for users to write back
    their decisions to your data asset, truly making your work operational."* That is our **Action
    Registry / proposal / review-queue** loop. Their app captures a decision; ours captures a *typed
    `BeaconAction` with immutable audit*. We're ahead.
- **The widget/config grammar to copy:** widget palette categorized as *Properties & links · Visualize ·
  Filter · Writeback · Foundry apps*; per-widget *Widget setup / Metadata / Display* tabs; Section
  *layouts* (Columns / Rows / Tabs / Flow / Toolbar / Loop) with row-height *Auto / Absolute / Flex*;
  variable value sources (*Static / Function / Object property / Time series / Struct field / …*).

---

## 4. The consolidated scorecard

| Foundry concept | Beacon | Verdict |
|---|---|---|
| PDF → chunk → embed → chunkId | doc-ingest stops at OCR | **Build** |
| Composite natural keys | ids should be composite | **Steal** |
| LLM entity extraction → strings | discovered-entity path | **Have** |
| **Resolve mention → existing node** (edge) | `describes_entity` to a real Supplier/Variant | **Build — differentiator** |
| Many-to-many Join Table | native edge | **Have (cleaner)** |
| Embedding → semantic search / RAG | pgvector + a grounded copilot answer | **Have infra / Build the surface** |
| Object type + link type wizard | reality-graph typed nodes/edges | **Have (collapsed)** |
| Ontology branch → Proposal → Review edits | git branch → PR → CI + migrations | **Have (real git)** |
| Object Views (360 hub) | our Object Views | **Have** |
| **Object Explorer / Search Around** | `GraphConnections` (static) | **Build — gap** |
| Quiver (analysis/dashboards) | Insights + Flywheel | **Partial** |
| **Vertex simulation graph (digital twin)** | Scenarios (sandbox only) | **Build — moat** |
| AIP Logic function | our agents / Logic Tools | **Have (as code)** |
| Single-completion vs Chain-of-Thought | `reasoning: deterministic \| llm` | **Have — surface it** |
| Output = staged ontology edits | proposal → gate → review queue | **Have** |
| Debugger + "add as test case" | trace + evals | **Have — one-click it** |
| Publish / API name / versioning | tool registry + release gate | **Have** |
| **Workshop app** (nested Sections + Widgets, variable-wired) | our React app | **Have — leapfrog authoring** |
| Reactive variable model (one input → many views) | selection-aware ContextPanel | **Have** |
| Semantic search as an object-set *filter* | RAG in code | **Steal the declarative framing** |
| **Writeback widgets** | Action Registry / proposals / review queue | **Have (richer)** |
| **"Ask AIP Assist" (NL help in the builder)** | NL copilot | **Validates the leapfrog** |
| Data-op vs AI-op **color** taxonomy | tool categories (labels only) | **Steal (make visual)** |
| Output "expectations" contract | zod + constraints + contract tests | **Have — surface it** |
| Visual no-code Pipeline Builder / Workshop | NL copilot | **Leapfrog, don't clone** |

---

## 5. The build backlog (ranked)

Value ÷ effort, hospitality lens:

1. **Document-ingestion arc.** PDF → chunk → embed → LLM entity extraction → **resolve the mention to a
   real node** → `describes_entity` edge + page-level `cited_in`. The resolution step is our
   differentiator; a supplier contract becomes queryable from the supplier. *Its own roadmap doc,
   grounded in the `Document` node + `query_document_chunks` + pgvector we already have.*
2. **Search Around** — interactive multi-hop graph traversal (Supplier → its Variants → their Stock
   Logs → the Documents citing them), with a Radial/Cluster layout. Closes our clearest UX gap.
3. **The Document Copilot app — the capstone (composes 1 + 2 + this).** The tutorial's entire payoff is
   a RAG Q&A over documents; it hands us the blueprint. For Beacon: ask *"what does the Acme contract say
   about lead-time penalties?"* → semantic search over Chunk embeddings → a **grounded answer citing
   contract p.3** → the supplier's subgraph beside it. One operator surface that composes the ingest arc,
   RAG, and Search Around — **the single most compelling first app to build.**
4. **Vertex simulation graph (digital twin)** — the causal view: overlay demand/forecast on nodes,
   simulate *"if this supplier's lead time doubles, what's the portfolio stockout risk."* Highest
   ceiling, biggest build; grows out of Scenarios + the prediction stack. **The moat feature.**
5. **Authoring affordances** — "Add as test case" one-click from a live trace; surface the
   Single-completion vs Chain-of-Thought choice; the LLM trial-run with token + latency.
6. **NL-native app authoring** — the leapfrog over Workshop, now confirmed by Foundry's own "Ask AIP
   Assist": the operator *describes* the ops app in NL, the copilot assembles Sections + Widgets +
   Object Views + a Logic function + a graph view, wired by the selection variable. The platform play —
   how hotel groups build on Beacon without engineers.

**Cheap "steal" refinements** (fold into the above): composite chunk keys · the data-op-vs-AI-op color
split on the Ontology/Logic-canvas surfaces · the Object-View "related workflows / management consoles"
right-rail section · surfacing output-as-contract · semantic-search-as-a-declarative-filter.

---

## 6. Principles (the load-bearing lessons)

1. **A mention is not a link.** Extraction yields entity *strings*; value comes from *resolving* them to
   real nodes as typed edges. A pile of unresolved mentions is a footnote nobody reads.
2. **Code-as-ontology beats GUI-configured-ontology for a vertical** — we get real git + CI + advisors
   instead of a rebuilt-in-a-GUI version of them.
3. **The LLM is glue.** Deterministic tools do retrieval/math/writes; the LLM decides *which* to call.
   Single-completion (fast) vs Chain-of-Thought (agentic tool-use) is the one authoring dial.
4. **One input, many synchronized views.** The reactive-variable model (a selection drives every panel)
   is the heart of an operational app — and it's our selection-aware ContextPanel.
5. **Writes are staged ontology edits** — proposal → gate → review queue → audit, never a silent
   mutation. Foundry's "ontology edits staged for review" is our decideAutoExecution loop.
6. **Composite, traceable identity** over opaque hashes — the lesson the prediction arc paid for twice.
7. **Even Palantir is going NL-native** ("Ask AIP Assist"). Our NL-first authoring is not a shortcut
   around a builder we haven't built — it's the next generation of the builder.
8. **Copy the shell, own the semantics, keep the backend.**

---

## 7. The one-line takeaway

Foundry spends six stages and five apps assembling what a hospitality vertical can express in three
layers of typed code plus NL. We're **ahead on the backend and the agent tier**, **at parity on Object
Views**, and **behind on exactly two things worth building**: the interactive graph (Search Around +
simulation) and the document copilot that sits on top of it. Everything else is *own the semantics* —
pour hospitality meaning into patterns Palantir already proved.
