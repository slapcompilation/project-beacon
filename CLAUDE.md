# CLAUDE.md

Guidance for Claude Code working in this repo. The north star is **replicating Palantir AIP** for hospitality. Everything below exists to keep us on that path.

## Commands

```bash
pnpm install                       # repo root
pnpm dev                           # all apps
pnpm --filter @beacon/web dev      # web only
pnpm type-check
pnpm lint
pnpm --filter @beacon/web build
pnpm format
```

## Repo shape

```
apps/
  web/                  Vite + React 18 + TS + Blueprint
packages/
  types/                entity + edge types — single source of truth
  services/             abstract interfaces (IAuthService, …)
  ui/                   shared primitives
  hooks/                TanStack Query + graph hooks
  reality-graph/        ontology, tools, actions, agents, objectives — THE HEART
  models/               (future) trained-model adapters
```

`packages/reality-graph` must never import from `apps/web`. It ships independently.

---

## The Ontology Is The Product

Beacon is an **Ontology-Augmented Generation** system. The LLM does not retrieve document chunks and write free text. It:

1. **Reads** typed nodes via Logic Tools
2. **Computes** through deterministic functions (or trained adapters behind the same tool signature)
3. **Writes** by proposing typed Actions that flow through an audited registry

Three load-bearing layers, all rooted in one ontology:

| Layer | Lives in | Job |
|---|---|---|
| **Data** | `reality-graph/src/nodes` + `edges` | Typed nodes, named edges, computed properties |
| **Compute** | `reality-graph/src/tools` | Typed functions, callable identically by humans and LLMs |
| **Mutation** | `reality-graph/src/actions` | Typed `BeaconAction`s with immutable audit |

LLMs are glue. They decide *which* component to call. They never do retrieval, math, or writes directly. Drop any layer and the result is unsafe.

---

## Data layer — Reality Graph

All data is nodes + typed edges. No bare foreign keys.

```ts
// packages/types/src/edges.ts
export type EdgeType =
  // causal
  | 'causes' | 'caused_by' | 'triggered'
  // operational
  | 'consumes' | 'restocks' | 'fulfills' | 'transfers'
  // organizational
  | 'belongs_to_hotel' | 'belongs_to_org' | 'manages' | 'operates'
  // intelligence + learning
  | 'proposed_by' | 'approved_by' | 'reverts' | 'similar_to' | 'benchmarks'
  // documents + provenance
  | 'describes_entity' | 'cited_in' | 'harmonized_to'
  // principles + constraints
  | 'applies_to'
```

**Logic belongs on nodes, not in UI.** Every derived value lives as a computed property on its node in `packages/reality-graph`:

```ts
// ✅ on the node
export const variantNode = {
  computed: {
    daysUntilZero: (v, logs) => …,
    wasteScore:    (v, logs) => …,
  },
}

// ❌ in a component
const daysLeft = useMemo(() => stock / avgUsage, [stock, avgUsage])
```

### Core node types

Operational: `Variant`, `StockLog`, `RestockRequest`, `PurchaseOrder`, `Supplier`, `Hotel`, `Organization`, `User`.

AIP-native: `Document` (with provenance + page citations), `Proposal` (versioned, with confidence + reasoning + parent_version_id), `Principle` (operator feedback, categorized), `ApprovedAnswer` (curated Q&A, served before fresh LLM calls), `Case` (workflow envelope tying inputs → trace → proposals → outcome), `Constraint` (NL rule, LLM-categorized, applied at trigger points).

---

## Compute layer — Logic Tool Registry

A Logic Tool is a named, typed, versioned function. Same signature whether a human, automation, or LLM calls it.

```ts
export const forecastConsumptionTool = {
  name: 'forecast_consumption',
  category: 'logic',          // data | logic | search | mutation | utility | predefined | ui-control
  kind: 'inproc',             // inproc | remote | container
  version: '1.0.0',
  description: 'Projected unit consumption for a variant over N days.',
  inputSchema:  z.object({ variantId: z.string().uuid(), horizonDays: z.number().int().min(1).max(90) }),
  outputSchema: z.object({
    projectedUnits: z.number(),
    basis:          z.string(),   // 'rolling-30d-avg' | 'prophet-v1' | …
    confidence:     z.number(),   // 0–1
  }),
  examples: [ /* few-shot */ ],
  traversableLinks: ['consumes', 'restocks'],  // edges the tool may follow
  invoke: async (input) => { /* deterministic or adapter-backed */ },
}
```

### Tool categories (AIP parity)

| Category | Purpose |
|---|---|
| `data` | Fetch / filter / aggregate ontology nodes |
| `logic` | Pure computation over inputs (forecasting, scoring, ranking) |
| `search` | Semantic / vector search over nodes or documents |
| `mutation` | Wrap an Apply Action — the only category allowed to write |
| `utility` | Format dates, parse text, sanitize strings |
| `predefined` | Built-in framework helpers (think_step_by_step, request_clarification) |
| `ui-control` | Surface-level helpers exposed to the operator copilot |

### Rules

- **One file per tool.** Co-locate schema, examples, impl.
- **Dual-callable.** UI calls `tool.invoke(...)`; agent blocks pick from a registered list. No "LLM-only" variants.
- **Pure unless `mutation`.** Tools query the graph; only mutation tools write — and only through the Action Registry.
- **Versioned.** Bump version on input/output/basis change. Every agent run records the version that ran on both the call and the response step, so a number in a proposal is traceable to the implementation that produced it. There is one registry entry per tool name — callers don't select a version, the trace reports it.
- **Explicit basis + confidence** on every computed result. Without these the operator can't audit and the transparency layer has nothing to render.
- **`traversableLinks`** declares which edges the tool may follow, and `toolSpec()` appends it to the description the LLM sees — so declaring it constrains the model's plan. It does *not* yet constrain the runtime: there is no graph-traversal primitive to gate. Enforcement lands with Tier 2 of `docs/IMPLEMENTATION-MAP.md`; until then, treat this as a contract with the model, not a sandbox.

---

## Mutation layer — Action Registry (Apply Actions)

Every write flows through `packages/reality-graph/src/actions/`. **No raw `.insert()` / `.update()` in `apps/web`.**

```ts
export type BeaconAction =
  | { type: 'ADJUST_STOCK';      variantId: string; delta: number; reason: string }
  | { type: 'REQUEST_RESTOCK';   variantId: string; quantity: number; urgency: Urgency }
  | { type: 'WRITE_OFF';         variantId: string; quantity: number; wasteReason: string }
  | { type: 'APPROVE_RESTOCK';   requestId: string }
  | { type: 'REJECT_RESTOCK';    requestId: string; reason: string }
  | { type: 'REVERT_ACTION';     originalId: string; revertReason: string }
  | { type: 'TRANSFER_STOCK';    fromHotelId: string; toHotelId: string; variantId: string; quantity: number; reason: string }
  | { type: 'APPROVE_TRANSFER';  transferId: string }
```

Every action declares:

- **Submission criteria** — validation checked before execution
- **Side effects** — graph updates, alerts, notifications
- **Audit entry** — immutable `StockLog` with `triggered_by ∈ {'user', 'ai_proposal_accepted', 'ai_auto_approved', 'automation_threshold', 'revert'}`
- **Invocation mode** — exactly one of:
  - `open-form` — modal auto-rendered from the action's schema
  - `apply-immediately` — one-click when defaults are valid

StockLogs are never edited or deleted. Corrections are compensating transactions (`is_revert: true`, `revert_of: <id>`).

---

## Modeling Objectives (when a baseline isn't enough)

When a deterministic baseline (rolling avg, percentile threshold) gets beaten by a trained model on the eval set, the model goes behind a typed **Adapter** in `packages/reality-graph/src/objectives/<name>/`:

- `adapter.ts` exposes `api()` (input/output Tabular columns + Parameters) and `runInference()`
- Eval suite — datasets, metrics, cohorts
- Releases — `sandbox → staging → production`, with compatibility checks and review gates
- Deployments — `live` (real-time) or `batch` (pipeline populates computed properties)

The existing Logic Tool gets a second implementation behind the same signature; `basis` changes from `'rolling-30d-avg'` to `'prophet-v1'`; **callers don't change**.

**No code anywhere talks to a model directly.** It talks to the adapter, wrapped by a Logic Tool.

---

## Agents — N small blocks, never one big call

Agents live in `packages/reality-graph/src/agents/<name>/`. They read via tools, propose via actions, produce a trace.

```
agents/restock_advisor/
  blocks/
    extract_variant.ts        sub-LLM: "tomatoes" → typed Variant
    extract_supplier.ts       sub-LLM (optional)
    reason_and_propose.ts     main LLM: numbered procedure
  prompt.ts                   the numbered task prompt
  eval/                       *.eval.ts with ≥10 historical cases
  index.ts                    run(input) → { proposals, trace }
```

### Block rules

- One paragraph system prompt per block
- One typed input from the prior block, one typed output to the next
- Narrow tool set — usually one tool for entity-extraction, several for reasoning
- If a prompt has more than three responsibilities, split it
- Entity extraction is always its own block — never inline in reasoning

### Task prompts are numbered procedures

The reasoning block reads like training a new analyst:

```
Given the operator's stockout concern:
1. Call `query_open_restock_requests`. Confirm no pending request covers the gap.
2. Call `forecast_consumption` for 7 days to size it.
3. Call `query_sister_property_inventory`. If a sister has ≥40% of the gap, prefer TRANSFER_STOCK.
4. Call `rank_alternative_suppliers`. Pick the highest-reliability supplier whose lead time covers the remainder.
5. Propose TRANSFER_STOCK and/or REQUEST_RESTOCK that closes the gap. Cite each tool result in the rationale.
6. If confidence < threshold at any step, call `request_clarification` instead.
```

Not "do your best." Procedural, each step a discrete tool call.

### Each agent declares

- Purpose (one sentence)
- Scope — `'hotel' | 'organization'`, inherits caller's role; never broader than the invoker
- Cadence — `on-event | hourly | daily | weekly | monthly`
- Tool set — bounded
- Approval boundary — operator | threshold auto-approve | both
- Release stage — `sandbox | staging | production`
- Version — semantic; new versions branch-test before merging to main
- Eval suite — `*.eval.ts` with ≥10 historical cases and a documented pass rate

### Agent → Action contract

Every LLM output is a typed `BeaconAction`. Never raw text passed to a writer. Validation, audit trail, and type migration apply identically to human and agent proposals.

### `request_clarification` is first-class

Below confidence threshold (default `< 0.6`), the agent pauses and asks the operator. It does not emit a low-confidence proposal.

### Chain-of-thought is a product surface

Every run produces an `AgentRunTrace`:

- Numbered steps (AIP debugger style: 09, 10, 11…)
- Per step: block, tool, input args, return value, thought, token usage
- Same data structure renders in two surfaces:
  - **Developer debugger** when iterating
  - **Operator slide-over** beside the proposal in production

A proposal without a viewable trace is a defect.

---

## Eval Suites

Every agent and every non-trivial tool ships an eval suite alongside it.

- **Test cases** — historical inputs with expected outputs or rubrics
- **Three evaluator types**:
  - **Object match** — exact / subset equality on the typed output
  - **String contains** — substring assertion on rationale or response
  - **Rubric grader** — LLM-as-judge with an explicit checklist
- **Diff view** — runs of version A vs version B side-by-side on the same cases
- **Cohorts** — per-hotel / per-region slices flagged when overall pass rate hides a regression

You don't promote an agent or tool to `production` without a green eval at the prior stage.

---

## Proposals, Principles, Approved Answers — the learning flywheel

| Node | Source | Used to |
|---|---|---|
| `Proposal` | Agent output | Drive operator review queue; track version + parent_version_id; record approve/edit/reject outcome |
| `Principle` | Operator feedback ("never restock X past 6pm") | Inject into agent system prompts as soft constraints; LLM categorizes into the matching typed bucket |
| `ApprovedAnswer` | Curated Q&A | Tier-1 lookup — served before any fresh LLM call when the question matches |
| `Constraint` | NL rule | Hard gate at action submission; LLM categorizes into a typed bucket (`scope`, `threshold`, `time-window`, `actor-role`) |

Operators **refine via NL, not by direct edit** — they instruct the LLM to regenerate, the new Proposal supersedes the old one with a diff against the parent. Per-field edit-and-approve is allowed for terminal corrections.

---

## Documents & provenance

Multi-stage ingestion: OCR / Vision / Whisper / SAM → embed → semantic contextualization → typed `describes_entity` / `cited_in` edges to nodes.

A `Document` carries:

- Source + ingestion stage
- Per-chunk page reference
- Edges to the entities it describes

Any agent rationale that cites a document **must** include a page-level citation. No vague "per the contract" without `cited_in → page 4`.

---

## Operator UX (AIP-shaped, not dashboard-shaped)

The non-negotiables:

- **Confidence-coded review queues** — green ≥0.85, yellow 0.6–0.85, red <0.6
- **Every proposal carries confidence + reasoning + provenance** (tool chain + cited documents)
- **Selection-aware copilot** — knows the current Object View and passes that node's id to its tools. One contextually-scoped slide-over, not a global drawer.
- **Refinement-via-NL** — operator instructs the LLM to re-generate; original Proposal is preserved with a versioned successor
- **Per-field edit-and-approve** for terminal corrections (not edit-everything-then-save)
- **Plan versioning with auto-computed diffs** — operator reviews the delta between V_n and V_n+1, never the whole plan
- **Scenarios** are exploratory and uncommitted — distinct from versions
- **Action chains** observe state between steps; **Change Log** is the commit boundary for batched writeback
- **Stakeholder impact rollups** on any action touching multiple hotels or budgets
- **Empty states explain the cycle** — which nodes were scanned, against what thresholds, when the next run is, what last run produced. "All clear" is never enough.

### Object Views

Every node type has a Full Object View (page) and a Panel Object View (slide-over). Anatomy is uniform: header → metric strip → action bar → body sections → right rail. The right rail always carries the audit log for that node.

---

## Constraint engine + auto-execution

Operators author constraints in natural language. The LLM categorizes each into a typed bucket and stores it as a `Constraint` node. At action submission, constraints applicable to the action's `type` + `scope` are evaluated:

- Hard violation → action rejected with the constraint cited
- Soft violation → action requires a higher approval tier
- No violation + `confidence × criteria` above the auto-execution threshold → unattended execution with `triggered_by: 'ai_auto_approved'`
- Otherwise → operator approval

The threshold is per-action-type, configurable per organization. Auto-executed actions still emit a full trace and are visible in the operator review feed, marked for retroactive sampling.

### How the cycle runs unattended

One core loop, two callers:

| Caller | Lives in | Purpose |
|---|---|---|
| Operator-triggered | `apps/web/.../useRestockCycle.ts` ("Run cycle" on Command home) | On-demand sweep with the same gate |
| **Unattended (cron)** | edge fn `intelligence-cycle` + pg_cron `beacon-agent-intelligence-cycle` (daily 07:00 UTC) | Scheduled sweep across every hotel |

Both call **the same** `runIntelligenceCycle()` (in `packages/reality-graph/src/cycles/`), which composes `decideAutoExecution` with the constraint set. Runtime-specific seams (reader, persistence, dispatch) are injected — the web injects a browser Supabase client, the edge fn injects a service-role client. **There is no second gate; if you're tempted to add one, extend `decideAutoExecution` instead.**

The legacy SQL detectors (`auto_propose_restocks`, `auto_create_alerts`, `generate_preemptive_restocks`) read `auth_hotel_id()` — NULL under pg_cron — so they're no-ops on the cron path and were removed from `run_intelligence_cycle()` in migration 144. They remain in-app callable for authenticated users (the web uses two of them). Don't re-wire them into cron.

---

## Multi-tenant, multi-echelon

| Tier | Examples | Scope |
|---|---|---|
| **Organization** | Marriott, a 12-property group | Portfolio contracts, chain-wide agents, benchmarks |
| **Hotel** | One property | Day-to-day operations, local stock |
| **Zone** | F&B outlet, housekeeping cart | Location-resolved counts |

- Every node carries both `organization_id` and `hotel_id`. RLS is scope-aware: `auth_org_id()` alongside `auth_hotel_id()`.
- Every query / RPC / tool / agent declares its scope. Checked at the boundary, never assumed.
- Hotel-scoped overrides org-scoped (local arrangement beats master contract).
- Role hierarchy mirrors the echelon: `org_director > regional_manager > hotel_admin > hotel_manager > team_member`. Higher reads down; writes are scope-gated.
- **Lateral before external.** Inter-property `TRANSFER_STOCK` is checked before any external procurement.
- Benchmarking is a property of the network, not a feature. When a tool can compare against siblings, it does.

---

## Self-apply — our code meets the same bar

We sell intelligence, derived context, immutable audit. Our own code meets that bar.

1. Every new RPC / trigger / RLS helper ships with a test that exercises it under anonymous, authenticated, cross-org, cross-hotel contexts.
2. Every migration touching auth, RLS, or graph helpers runs `get_advisors` before being considered done.
3. Failure modes carry derived context. A stack-depth error without a call chain is a defect, not a Postgres quirk.
4. Instrument before shipping, not after debugging. Cycles emit metrics. Agent runs log input nodes, tools called, outcome.
5. Our debug loop is a Beacon cycle: Input → Analyze → Act → Repeat. A patch without prevention is incomplete.

If a bug took longer than ten minutes to root-cause, ask: *what observability would have made this a one-minute fix?* That's the real deliverable, alongside the patch.

---

## TypeScript & code rules

- `@beacon/types` + Reality Graph types are the only source of truth — never redefine entity shapes locally
- `any` is forbidden. Strict mode (`noImplicitAny`, `strictNullChecks`) is enforced
- Computed node properties belong in `packages/reality-graph`, not in components
- **Raw Supabase mutations are forbidden in `apps/web`** — use the Action Registry
- **Predictive computation is forbidden in `apps/web`** — use the Logic Tool Registry
- State split: Zustand only for UI/session. Server data lives in TanStack Query + graph cache. Never duplicate server state in Zustand
- UI primitives come from `@blueprintjs/core` and `@blueprintjs/icons`. No shadcn, no lucide
- Numeric cells use tabular numerals. 4px radius. Compact density.

### Write less code

If the same outcome fits in 50 lines instead of 100, that's the version that ships. Pick the shorter path when it's equally clear. No wrappers that exist only to be wrappers, no intermediate variables used once, no defensive branches for cases that can't happen, no abstractions for a single caller. Prefer composing existing primitives over building new ones.

### Comments stay human

Default to no comment. When a comment is genuinely useful, write it like a coworker leaving a quick note — short, direct, present-tense, no marketing voice.

- One short line max — multi-line explainers belong in the PR description
- Explain the *why* / a hidden constraint / a gotcha. Never restate what the code obviously does
- No "Breakthrough feature:", no "Palantir principle:", no congratulatory framing
- No decorative banners (`// ───── Foo ─────`) — blank lines and clear names do that work
- File-top docstring (if any): one short sentence on what the file is for

When you edit a file, rewrite or remove AI-flavored comments in the area you touch.

---

## Adding features — the checklist

Before code, answer in a top-of-file comment:

1. **Layer** — data, compute, mutation, agent, or surface?
2. **Ontology fit** — which nodes / edges does it use or add?
3. **Scope** — hotel, organization, or both? How is RLS enforcing it?
4. **Read or computation?** → typed Logic Tool with `category`, `kind`, `basis`, `confidence`, `traversableLinks`
5. **Mutation?** → named `BeaconAction` with submission criteria, side effects, audit entry, `open-form` or `apply-immediately`
6. **Predictive?** → typed adapter behind an objective with eval + releases (only when baseline is beaten)
7. **Agent?** → purpose, scope, cadence, tool set, approval boundary, release stage, version, eval suite — decomposed into sub-LLM blocks with a numbered task prompt
8. **Agent surface?** → renders the trace alongside the proposal with confidence + provenance
9. **Cycle?** → declared cadence, next-run expectation, empty state that explains what was scanned

---

## Environment

Copy `.env.example` → `.env`. Vite exposes only `VITE_*` to the client. **Never** put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_*` var.
