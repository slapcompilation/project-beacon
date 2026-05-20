# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
```bash
# Install dependencies (from repo root)
pnpm install

# Start all apps in dev mode
pnpm dev

# Start only the web app
pnpm --filter @beacon/web dev

# Type-check all packages
pnpm type-check

# Lint all packages
pnpm lint

# Production build (web)
pnpm --filter @beacon/web build

# Format all files
pnpm format
```

## Architecture

Turborepo monorepo with pnpm workspaces.
```
apps/
  web/                  ← Vite + React 18 + TypeScript + Blueprint
packages/
  types/                ← Single source of truth for entities AND edge types
  services/             ← Abstract interfaces (IAuthService, etc.)
  ui/                   ← Shared primitives
  hooks/                ← TanStack Query + graph hooks
  reality-graph/        ← Ontology, tools, actions, agents (THE HEART OF THE APP)
```

---

## The OAG Architecture (North Star)

Beacon is built as an **Ontology-Augmented Generation** system, not a Retrieval-Augmented one. The LLM never retrieves document chunks. It retrieves **typed nodes from the Reality Graph via Logic Tools**, calls deterministic functions for computation and prediction, and emits **typed Actions** that flow through an audited registry.

The architecture is three load-bearing layers, all rooted in the ontology:

1. **Data layer** — the Reality Graph: typed nodes + named edges + computed properties
2. **Compute layer** — the Logic Tool Registry: typed functions, callable identically by humans and LLMs
3. **Mutation layer** — the Action Registry: typed `BeaconAction`s with immutable audit

LLMs sit on top of all three as orchestrators. They reason and decide *which* component to call. They never do retrieval, math, prediction, or writes directly.

The reason this works is that **each layer does exactly one thing it's good at**, and the LLM is glue. Drop any layer and the result is unsafe.

---

## The Reality Graph (Data Layer)

`packages/reality-graph` is the single source of truth for the data layer. Nothing in `apps/web` defines entity shapes; all types come from `@beacon/types` and `@beacon/reality-graph`.

### Nodes and edges

All data exists as nodes in a single living graph:
- **Nodes:** Variant, StockLog, RestockRequest, Alert, Report, Hotel, User, Supplier, etc.
- **Edges:** typed relationships with named, semantic meaning (vocabulary below)

### Logic belongs on nodes, not in UI

Every derived value lives as a computed property on its node type in `packages/reality-graph`, not in a hook or component:

```typescript
// ✅ CORRECT — logic on the node
// packages/reality-graph/src/nodes/variant.ts
export const variantNode = {
  computed: {
    daysUntilZero: (v: Variant, logs: StockLog[]) => ...,
    wasteScore:    (v: Variant, logs: StockLog[]) => ...,
  },
}

// ❌ WRONG — logic in UI
const daysLeft = useMemo(() => stock / avgUsage, [stock, avgUsage])
```

### Edge Type Vocabulary (Non-Negotiable)

```typescript
// packages/types/src/edges.ts
export type EdgeType =
  // Causal
  | 'causes' | 'caused_by' | 'triggered'
  // Operational
  | 'consumes' | 'restocks' | 'belongs_to_hotel' | 'fulfills'
  // Organizational
  | 'manages' | 'operates'
  // Intelligence
  | 'proposed_by' | 'approved_by' | 'reverts'
  | 'similar_to'    // pgvector semantic similarity
  | 'benchmarks'    // Hotel → Hotel (Mind Layer)
  // Network (multi-echelon)
  | 'belongs_to_org' | 'transfers'
```

Never create a relationship as a bare foreign key. Every edge declares its type.

---

## The Logic Tool Registry (Compute Layer)

`packages/reality-graph/src/tools/` holds the typed function registry. A Logic Tool is a named function with:

- A typed input schema (zod)
- A typed output schema (zod)
- A natural-language description (used by LLMs to decide when to call it)
- Optional few-shot examples
- A semantic version
- A pure `invoke(input)` implementation

```typescript
// packages/reality-graph/src/tools/forecast_consumption.ts
export const forecastConsumptionTool = {
  name: 'forecast_consumption',
  version: '1.0.0',
  description:
    'Returns projected unit consumption for a variant over N days, ' +
    'based on rolling 30-day average. Use when reasoning about ' +
    'stockout risk or restock sizing.',
  inputSchema: z.object({
    variantId:   z.string().uuid(),
    horizonDays: z.number().int().min(1).max(90),
  }),
  outputSchema: z.object({
    variantId:      z.string().uuid(),
    projectedUnits: z.number(),
    basis:          z.string(),   // 'rolling-30d-avg' — explicit for transparency
    confidence:     z.number(),   // 0–1
  }),
  examples: [
    { input:  { variantId: 'var_3f9...', horizonDays: 7 },
      output: { variantId: 'var_3f9...', projectedUnits: 162,
                basis: 'rolling-30d-avg', confidence: 0.85 } },
  ],
  invoke: async (input) => { /* deterministic impl */ },
}
```

### Tool rules

- **One file per tool.** Co-locate schemas, examples, and impl.
- **Dual-callable.** The same tool is callable by hooks (UI) and by the agent orchestrator (LLM). UI code calls `forecastConsumptionTool.invoke(...)`; LLM blocks pick from a registered list.
- **Pure where possible.** Tools may query the graph; they never mutate. Mutations go through the Action Registry.
- **Versioned.** Bump the version when input/output shape or basis changes. Callers pin to a version.
- **Explicit basis.** Every computed (not retrieved) result declares `basis` and `confidence` so the transparency layer can surface them.
- **Identical signatures everywhere.** A tool is a tool whether a human, an automation, or an LLM calls it. No "LLM-only" or "internal-only" variants.

### Why every tool layer is required

| Drop | What breaks |
|---|---|
| Typed input schema | LLM can pass garbage; runtime errors instead of validation failures |
| Typed output schema | Downstream code can't trust the shape; LLM has to parse free text |
| Description + examples | LLM doesn't know when to call the tool, falls back to guessing |
| `basis` + `confidence` | Operator can't audit; transparency layer has nothing to render |
| Version pinning | Agent behavior changes silently when tool implementation changes |

---

## The Action Registry (Mutation Layer)

Every mutation flows through `packages/reality-graph/src/actions/`. No raw `.insert()` / `.update()` in `apps/web`.

Every action declares:
- **Submission criteria** — validation rules checked before execution
- **Side effects** — graph updates, alerts, notifications
- **Audit entry** — an immutable `StockLog` with `triggered_by` context

```typescript
export type BeaconAction =
  | { type: 'ADJUST_STOCK';       variantId: string; delta: number; reason: string }
  | { type: 'REQUEST_RESTOCK';    variantId: string; quantity: number; urgency: 'low' | 'medium' | 'high' }
  | { type: 'WRITE_OFF';          variantId: string; quantity: number; wasteReason: string }
  | { type: 'APPROVE_RESTOCK';    requestId: string }
  | { type: 'REJECT_RESTOCK';     requestId: string; reason: string }
  | { type: 'REVERT_ACTION';      originalId: string; revertReason: string }
  // Network (multi-echelon — lateral before external)
  | { type: 'TRANSFER_STOCK';     fromHotelId: string; toHotelId: string;
                                  variantId: string; quantity: number; reason: string }
  | { type: 'APPROVE_TRANSFER';   transferId: string }
```

### Immutable Flow

StockLogs are never edited or deleted. Corrections are compensating transactions (`is_revert: true`, `revert_of: <original_id>`).

`triggered_by` is always set: `'user'`, `'ai_proposal_accepted'`, `'automation_threshold'`, or `'revert'`.

### Action invocation has exactly two modes

- `open-form` — modal auto-rendered from the action's parameter schema (default)
- `apply-immediately` — one-click when defaults are valid

Every BeaconAction declares which mode applies. No third pattern.

---

## Modeling Objectives and Adapters (Predictive Layer — Deferred)

When a Logic Tool's computation is non-deterministic enough to warrant a trained model (forecasting, anomaly scoring, classification), the model lives behind a **Modeling Objective** with a typed **Adapter**.

**This layer is deferred until we ship our first real model.** Current predictive tools (`forecast_consumption`, etc.) are deterministic baselines (rolling averages, percentile thresholds). When a Prophet / sklearn / hosted-LLM implementation outperforms the baseline on the eval set, the work is:

1. Create `packages/reality-graph/src/objectives/<name>/`
2. Declare a typed `adapter.ts`:
   - `api()` returns input schemas (Tabular columns with named types + Parameters) and output schemas (Tabular columns with named types)
   - `runInference()` takes the typed input, calls the underlying framework, maps the response back into the typed output
3. Declare the eval suite — datasets, metric library, subsets (e.g., per-hotel cohorts)
4. Declare releases — `sandbox → staging → production` with compatibility checks and review gates
5. Declare deployments — `live` (real-time endpoint) or `batch` (pipeline populates computed properties)
6. The existing Logic Tool gets a second implementation behind the same signature; the `basis` field changes from `'rolling-30d-avg'` to `'prophet-v1'`; **callers don't change**.

The adapter is the typed boundary between the objective and the implementation. **No code anywhere in the app talks to a model directly — it talks to the adapter, which is wrapped by a Logic Tool.**

A Modeling Objective is a container, not a model. It owns N candidate model assets (trained-in-platform, imported file, containerized, or externally-hosted endpoint), one eval config, one release lifecycle, and N deployments. Promotion goes through the release lifecycle; the eval dashboard compares candidates side-by-side on identical metrics.

---

## AIP-Style Agents

Agents live in `packages/reality-graph/src/agents/<agent_name>/`. They are LLM-orchestrated workflows that read the graph via Logic Tools and propose typed `BeaconAction`s.

### Agent decomposition (Non-Negotiable)

An agent is **N small LLM blocks, not one big call**. The canonical structure:

```
agents/restock_advisor/
  blocks/
    extract_variant.ts        // sub-LLM: resolve "tomatoes" → typed variant node
    extract_supplier.ts       // sub-LLM (optional): resolve supplier from prompt
    reason_and_propose.ts     // main LLM: numbered procedure, calls tools, emits proposals
  prompt.ts                   // exported task prompt — the numbered checklist
  eval/                       // *.eval.ts with ≥10 historical cases
  index.ts                    // run(input) → { proposals, trace }
```

Each block has:
- A narrow single-purpose system prompt (one paragraph max)
- A narrow tool set (one tool for entity-extraction blocks; several for reasoning blocks)
- A typed input variable from the prior block(s)
- A typed output variable consumed by the next block

**If a block's prompt has more than three responsibilities, split it.** Entity extraction is always its own block — never inline in the reasoning step.

### Task prompts are numbered procedures

The main reasoning block's prompt reads like training instructions for a new analyst — numbered, each step a discrete tool call:

```
Given the user's stockout concern:
1. Call `query_open_restock_requests` for the variant. Confirm no pending
   request covers the gap.
2. Call `forecast_consumption` for 7 days to size the gap.
3. Call `query_sister_property_inventory`. If a sister has ≥40% of the gap,
   prefer TRANSFER_STOCK (lateral-before-external).
4. Call `rank_alternative_suppliers`. Pick the highest-reliability supplier
   whose lead time covers the remaining gap.
5. Propose a combination of TRANSFER_STOCK and/or REQUEST_RESTOCK that
   closes the gap. Cite each tool result in the rationale.
6. If confidence < 0.6 at any step, call `request_clarification` instead.
```

Not "figure out what to do." Not "do your best." Procedural instructions, each step a discrete tool call.

### Every agent declares

- **Purpose** — one sentence
- **Scope** — `'hotel' | 'organization'`, inherits caller's role
- **Cadence** — `on-event | hourly | daily | weekly | monthly`
- **Tool set** — the bounded list of Logic Tools each block may invoke
- **Approval boundary** — operator | threshold-based auto-approve | both
- **Release stage** — `sandbox | staging | production`
- **Version** — semantic; the orchestrator pins to a version; new versions can branch-test with a subset of users before merging to main
- **Eval suite** — `*.eval.ts` with ≥10 historical cases, documented pass rate

### The Agent-Action Contract

> Every LLM-proposed action is a typed `BeaconAction`.

The agent's output is never raw text — it is a typed, validated, auditable action proposal that flows through the same registry as human-triggered mutations. The operator approves; the registry executes; the graph records.

- Agents cannot bypass validation
- Agent actions are visible in the audit trail with `triggered_by: 'ai_proposal_accepted'`
- Model changes cannot silently alter system behavior — every proposal is typed, and type changes require a migration

### Scope inheritance

An agent triggered by a hotel manager can only read/write nodes scoped to their hotel. An agent triggered by an org director operates at org scope. **Never grant agents broader access than the human who invoked them.** Scope = echelon, always.

### `Request Clarification` is a first-class agent capability

When an agent is below its confidence threshold, it pauses and asks the operator a question inline rather than emitting a low-confidence proposal. Default threshold: `confidence < 0.6`.

### Chain-of-Thought is a product surface

Every agent run produces a structured `AgentRunTrace`:
- Numbered step list (matching the AIP debugger pattern: 09, 10, 11…)
- Per step: block name, tool called, input args, return value, intermediate `Thought:`, token usage
- The **same data structure** renders in two surfaces:
  - **Developer debugger** when iterating on an agent
  - **Operator slide-over** next to the agent's proposal in production

A proposal without a viewable trace is a defect.

---

## Network, Not Site — Multi-Echelon Architecture

Hospitality clients are rarely single-property. The network is the primitive, not an add-on.

### Ontology tiers

| Tier | Examples | Scope |
|---|---|---|
| **Organization** | Marriott, Accor, a 12-property boutique group | Portfolio contracts, benchmarks, chain-wide agents |
| **Hotel** | One physical property | Day-to-day operations, local stock, property GM |
| **Zone** | Housekeeping cart, F&B outlet, AR room | Location-resolved counts, team attribution |

### Rules

- Every node has `organization_id` in addition to `hotel_id`. RLS is scope-aware: `auth_org_id()` alongside `auth_hotel_id()`.
- Every query, RPC, tool, and agent declares its scope (`'hotel' | 'organization'`). Scope is checked at the boundary — never assumed.
- **Inter-property `TRANSFER_STOCK` is checked before any external procurement.** Before a restock request goes external, the system checks sister properties.
- Contracts, suppliers, and agents can be org-scoped (one master contract covering all properties) or hotel-scoped (local arrangement). Resolution: hotel-scoped overrides org-scoped.
- Role hierarchy mirrors the echelon: `org_director > regional_manager > hotel_admin > hotel_manager > team_member`. Higher reads down; writes are always scope-gated.
- Benchmarking is a property of the network, not a feature. When a tool can compare Hotel X against its siblings, it does — expressed as a default context column.

---

## The Four Permanent Layers (UX Organization)

Every new feature is placed in exactly one of these layers, documented in a top-of-file comment:

| Layer | Responsibility |
|---|---|
| **Floor** | Physical reality (scanning, voice, quick adjustments) |
| **Flow** | Operational movement (receive → store → use → restock, immutable logs, undo) |
| **Eye** | Intelligence (waste radar, predictive restocking, smart alerts, AIP-style copilot) |
| **Mind** | Strategy & memory (chain benchmarking, procurement leverage, invoicing intelligence) |

The layer label appears as a typographic eyebrow / chip in the page header — **never** as a `Layer ·` prefix on tab labels.

---

## Cycle-First Operation

Beacon is not a dashboard where operators go to check things. It is a cycle where agents pre-populate decisions and operators approve / adjust. Gallatin's **Input → Analyze → Act → Repeat** is the canonical loop.

### Every agent has a declared cadence

| Cadence | Example agent | Surface |
|---|---|---|
| **On-event** | spike detector (triggered on stock_log insert) | Realtime notification |
| **Hourly** | intelligence cycle | Morning briefing accumulates overnight |
| **Daily** | auto_create_alerts, expiring_contracts | Briefing panel |
| **Weekly** | learn_supplier_lead_times, apply_optimal_par | Monday digest |
| **Monthly** | chain benchmarking, contract renewal sweep | Portfolio review |

### Surfaces are organized by cycle, not by table

- **Briefing** = "what's in this operator's current cycle" (unapproved proposals, unread alerts, pending reviews)
- **SmartProposalsPage** = the weekly restock agent's inbox
- **AlertsPage** = the continuous anomaly-detection agent's inbox
- **ContractsPage** = the contract renewal agent's cycle dashboard

### Decision windows are first-class

Every surface that shows an agent proposal shows: when the agent ran, how long operators have to respond, what happens if they don't (auto-approve / escalate / expire), and what the next cycle looks like.

### Empty states are intelligence opportunities

"All clear" is never enough. Every empty state explains: which nodes were scanned, against what thresholds, when the next cycle runs, and what the most recent cycle's outcome was.

---

## Self-Apply: Our Own Code Meets the Same Bar

We sell intelligence everywhere — derived context, confidence basis, immutable audit, decision support. **Our own code meets the same bar.** Hypocrisy here is a product defect.

1. **Every new RPC, trigger, or RLS helper ships with a test** that exercises it under realistic RLS context — anonymous, authenticated, cross-org, cross-hotel. RLS recursion, missing `SECURITY DEFINER`, and policy gaps fail in CI, not in production.
2. **Every migration touching auth, RLS, or graph helpers runs `get_advisors`** before it's considered done.
3. **Failure modes carry derived context.** A stack-depth error without a function call chain is a defect, not a Postgres quirk. Wrap, log, or capture enough context that the failure tells us *where* and *why* on first read.
4. **Instrument before shipping, not after debugging.** If a feature has a cycle, the cycle emits metrics. If an agent runs, the run logs input nodes, tools called, and outcome.
5. **Our debug loop is a Beacon cycle.** Input (the failure) → Analyze (the trace) → Act (fix + prevention) → Repeat. A patch without prevention is incomplete.

If a bug took longer than ten minutes to root-cause, ask: *what observability would have made this a one-minute fix?* That's the real deliverable, alongside the patch.

---

## The Beacon Design System: Blueprint

Beacon's design system is **[`@blueprintjs`](https://blueprintjs.com)** — the same toolkit Foundry uses. The migration from shadcn/ui + lucide-react is complete; **new code does not introduce shadcn primitives or lucide icons.**

### Rules

- Every UI primitive comes from `@blueprintjs/core` or `@blueprintjs/icons`
- Visual tokens (colors, spacing, type ramp) are wired into `tailwind.config.ts` from Blueprint
- Numeric cells use tabular numerals (`font-feature-settings: 'tnum'`) — non-negotiable
- Compact density default; 16px spacing rhythm; 4px multiples for margins/padding; `4px` border radius everywhere
- Color intents: gray = secondary (Back/Cancel), blue = primary (Create/Next), green = completion (Submit/Approve), amber = attention-required (Archive), red = destructive (Delete)
- Dense surfaces use `@blueprintjs/table` (virtualization, frozen columns, in-cell editing)
- `HotkeysProvider` is wired at app root — keyboard-first workflows are mandatory (Escape closes modals, Enter submits)

### 5 / 10 / 30 rule

- Top-level navigation ≤ 5 destinations
- Visible components per view ≤ 10
- Whitespace target 20–25% (we run on 1440×900 viewports, not terminal-class monitors)

When a sub-tab appears, the design has failed; collapse to Sections inside the page. Pinned module header, non-scrolling tabs.

### Object Views

Every node type (variant, supplier, restock_request, PO, stock_log) has:
- A **Full Object View** (own page)
- A **Panel Object View** (slide-over)
- Standard anatomy: **header → metric strip → action bar → body sections → right rail**

Operators never get different anatomy depending on the entity.

### Copilot is a contextual slide-over, not a global drawer

When open, the copilot knows the current Object View context and passes that node's id to its tools. One drawer, contextually scoped. The right-rail outline panel renders the user → tool → tool → response chain with click-to-jump — the AIP Chain-of-Thought pattern as a production surface.

### Action log is a first-class node, not a sidebar

StockLog already is. Surface it bidirectionally: in a global Activity feed AND in every related object's right rail. Never hide audit behind a drawer toggle.

### Trend indicators and decision support

- Every metric that changes over time shows a trend indicator
- Every list has a sort order with intent (urgency, anomaly score, business impact at top)
- Actions live next to data — operators never navigate away to act on what they see
- Every AI decision shows its reasoning (the Chain-of-Thought widget, never crammed into the response text)

---

## TypeScript & Code Rules

- `@beacon/types` + Reality Graph types are the only source of truth — never redefine entity shapes locally
- `any` is forbidden. Strict mode is enforced (`noImplicitAny`, `strictNullChecks`)
- Every new component, hook, tool, action, and agent declares its layer in a top comment
- Computed node properties belong in `packages/reality-graph`, not in component files
- **Raw Supabase mutations are forbidden in `apps/web`** — use the Action Registry
- **Predictive computation is forbidden in `apps/web`** — use the Logic Tool Registry
- `packages/reality-graph` must never import from `apps/web`. The graph is deployable independently
- State split: Zustand only for UI/session state. All server data lives in TanStack Query + graph cache. Never duplicate server state in Zustand

### Write less code

If the same outcome fits in 50 lines instead of 100, that's the version that ships. Pick the shorter path when it's equally clear. No wrapper layers that exist only to be wrappers, no intermediate variables that get used once, no defensive branches for cases that can't happen, no abstractions for a single caller. Prefer composing existing primitives over building new ones. When two patterns work, pick the one with less code.

### Comments stay human

Default to no comment. When a comment is genuinely useful, write it like a coworker leaving a quick note — short, direct, present-tense, no marketing voice. The bar:

- One short line max — multi-line explainers belong in the PR description or the commit, not the file
- Explain the *why* / a hidden constraint / a gotcha, never restate what the code obviously does
- No "Breakthrough feature:", no "Palantir principle:", no "Layer X — [grand phrase]", no congratulatory framing
- No decorative banner separators (`// ───── Foo ─────`) — blank lines and clear function names do that work
- File-top docstring (if any): a single short sentence stating what the file is for, plus the layer label if relevant

When you edit a file, rewrite or remove AI-flavored comments in the area you touch.

---

## Adding Features (AIP Checklist)

Before writing any code, answer:

1. Which of the four layers does this belong to?
2. How does it extend or use the Reality Graph?
3. Which echelon scope — hotel, organization, or both? How is scope enforced at RLS?
4. If it's a **read or computation** — is it a typed Logic Tool? Does the tool declare `basis` and `confidence`?
5. If it's a **mutation** — is it a named `BeaconAction` with submission criteria, side effects, and an immutable audit entry? Does it declare `open-form` or `apply-immediately`?
6. If it's a **predictive function** — does it sit behind a typed adapter? If yes, is there an objective with eval + releases?
7. If it's an **agent** — what's its purpose, scope, cadence, tool set, approval boundary, release stage, version, eval suite? Is it decomposed into sub-LLM blocks? Is the task prompt a numbered procedure?
8. If it's an **agent surface** — does it render the Chain-of-Thought trace alongside the proposal?
9. If it's a **cycle** — what's the cadence? What's the next-run expectation? What does the empty state explain?

Document the answers in a comment at the top of the relevant file.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in values. Vite exposes only `VITE_*` prefixed vars to the client. Never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_*` var.
