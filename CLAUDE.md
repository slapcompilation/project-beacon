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
apps/
web/              ← Vite + React 18 + TypeScript + Tailwind + shadcn/ui
packages/
types/            ← Single source of truth for all entities AND edge types
services/         ← Abstract interfaces (IAuthService, etc.)
ui/               ← Shared primitives
hooks/            ← TanStack Query + graph hooks
reality-graph/    ← Core ontology & four-layer engine (THE HEART OF THE APP)

## The Reality Graph Ontology (Non-Negotiable)

This is not an inventory app. It is the operating system for hotel reality.

All data exists as nodes in a single living graph:

- **Nodes:** Variant, StockLog, RestockRequest, Alert, Report, Hotel, User, etc.
- **Edges:** typed relationships with named, semantic meaning (see Edge Type Vocabulary below)

Every feature, screen, and decision must be built on top of this graph. There is only one source of truth.

### The Ontology models decisions, not data

The Reality Graph integrates four things that must never be separated:

1. **Data** — every source, unified into coherent nodes and typed edges
2. **Logic** — computed properties, business rules, ML functions — attached to node types in `packages/reality-graph`, never in UI components
3. **Action** — every mutation is a named, typed, audited action — never a raw Supabase call
4. **Security** — role-, hotel-, and purpose-based access woven into every read and write

### Logic belongs on nodes, not in UI

Every derived value must be defined as a computed property on its node type in `packages/reality-graph`, not calculated inside a component or hook.
```typescript
// ✅ CORRECT — logic lives on the node type
// packages/reality-graph/src/nodes/variant.ts
export const variantNode = {
  computed: {
    daysUntilZero: (v: Variant, logs: StockLog[]) => ...,
    wasteScore: (v: Variant, logs: StockLog[]) => ...,
    restockUrgency: (v: Variant) => ...,
  },
  actions: {
    adjustStock: adjustStockAction,
    requestRestock: requestRestockAction,
    writeOff: writeOffAction,
  }
}

// ❌ WRONG — logic leaking into UI
// apps/web/src/components/InventoryTable.tsx
const daysLeft = useMemo(() => stock / avgUsage, [stock, avgUsage]);
```

### Edge Type Vocabulary (Non-Negotiable)

Every edge in the graph must use a type from this vocabulary. Never create a relationship as a bare foreign key.
```typescript
// packages/types/src/edges.ts
export type EdgeType =
  // Causal
  | 'causes'          // StockLog → Alert
  | 'caused_by'       // Alert → StockLog
  | 'triggered'       // threshold event → RestockRequest
  // Operational
  | 'consumes'        // Hotel → Variant
  | 'restocks'        // RestockRequest → Variant
  | 'belongs_to_hotel'
  | 'fulfills'        // StockLog → RestockRequest
  // Organizational
  | 'manages'         // User → Hotel
  | 'operates'        // User → Variant
  // Intelligence
  | 'proposed_by'     // RestockRequest → AI agent
  | 'approved_by'     // StockLog → User
  | 'reverts'         // StockLog → StockLog (compensating transaction)
  | 'similar_to'      // Variant → Variant (semantic similarity, pgvector)
  | 'benchmarks'      // Hotel → Hotel (Mind Layer)
  // Network (multi-echelon)
  | 'belongs_to_org'  // Hotel → Organization
  | 'transfers'       // StockLog → StockLog (inter-property lateral movement)
```

## The Four Permanent Layers (The Intentional Architecture)

Every new feature must be placed in exactly one of these layers:

| Layer | Responsibility |
|---|---|
| **Floor Layer** | Physical reality (scanning, voice, quick adjustments) |
| **Flow Layer** | Operational movement (receive → store → use → restock, immutable logs, undo) |
| **Eye Layer** | Intelligence (waste radar, predictive restocking, smart alerts, AI copilot) |
| **Mind Layer** | Strategy & memory (chain benchmarking, procurement leverage, invoicing intelligence) |

**Rule:** Before writing any code, first decide which layer the feature belongs to and document it in a comment at the top of the file or function.

## Network, Not Site — Multi-Echelon Architecture (Non-Negotiable)

Hospitality clients are rarely single-property. Chains, management companies, and ownership groups operate portfolios — and the software must treat the network as the primitive, not an add-on.

**Ontology tiers:**

| Tier | Examples | Scope |
|---|---|---|
| **Organization** | Marriott, Accor, a 12-property boutique group | Portfolio-level contracts, benchmarks, chain-wide agents |
| **Hotel** | One physical property | Day-to-day operations, local stock, property GM |
| **Zone** | Housekeeping cart, F&B outlet, AR room | Location-resolved counts, team attribution |

**Rules:**

- Every node has an `organization_id` in addition to `hotel_id`. RLS is scope-aware: `auth_org_id()` alongside `auth_hotel_id()`.
- Every query, RPC, and agent declares its scope (`'hotel' | 'organization'`). Scope is checked at the boundary — never assumed.
- **Inter-property Transfer is a first-class action**, not a workaround. Before a restock request goes external, the system checks sister properties for available stock. `TRANSFER_STOCK` is a `BeaconAction` with the same immutable audit trail as any other mutation.
- Contracts, suppliers, and agents can be org-scoped (one master contract covering all properties) or hotel-scoped (local arrangement). Resolution order: hotel-scoped overrides org-scoped.
- Role hierarchy mirrors the echelon: `org_director > regional_manager > hotel_admin > hotel_manager > team_member`. Higher roles can read down; writes are always scope-gated.
- **Benchmarking is a property of the network, not a feature.** When an RPC can compare Hotel X against its sister properties, it does — expressed as a default context column, not a separate report.

This is borrowed directly from Gallatin's multi-echelon military logistics model — "consumption projections across multiple echelons" and "lateral resupply" translate one-to-one to hospitality portfolios.

## The Action System (Non-Negotiable)

Every mutation in the system must flow through the typed action registry in `packages/reality-graph`. No raw `.insert()` or `.update()` calls in application code.

Every action must declare:
- **Submission criteria** — validation rules checked before execution
- **Side effects** — graph updates, alerts, or notifications triggered by the action
- **Audit entry** — an immutable `StockLog` record with `triggered_by` context
```typescript
// packages/reality-graph/src/actions/index.ts
export type BeaconAction =
  | { type: 'ADJUST_STOCK'; variantId: string; delta: number; reason: string }
  | { type: 'REQUEST_RESTOCK'; variantId: string; quantity: number; urgency: 'low' | 'medium' | 'high' }
  | { type: 'WRITE_OFF'; variantId: string; quantity: number; wasteReason: string }
  | { type: 'APPROVE_RESTOCK'; requestId: string }
  | { type: 'REJECT_RESTOCK'; requestId: string; reason: string }
  | { type: 'REVERT_ACTION'; originalId: string; revertReason: string }
  // Network (multi-echelon — lateral before external)
  | { type: 'TRANSFER_STOCK'; fromHotelId: string; toHotelId: string; variantId: string; quantity: number; reason: string }
  | { type: 'APPROVE_TRANSFER'; transferId: string };
```

**Immutable Flow:** StockLogs are never edited or deleted — corrections are always compensating transactions (`is_revert: true`, `revert_of: <original_id>`). The `triggered_by` field must always be set: `'user'`, `'ai_proposal_accepted'`, `'automation_threshold'`, or `'revert'`.

## The Intelligence Stack — AIP-Style Agent Layer (Non-Negotiable)

Beacon's AI is not a chatbot bolted onto an inventory app. It is a Palantir AIP–style agent layer that operates on the Reality Graph and proposes typed actions. Three strict tiers:

### Tier 1 — Deterministic Tools
SQL RPCs, math functions, lookups. Always correct, always auditable. LLMs call these; LLMs never do arithmetic themselves.

Examples: `get_smart_proposals()`, `compute_optimal_par()`, `get_contract_price()`, `learn_supplier_lead_times()`.

### Tier 2 — LLM Tools
Reason over typed node sets; produce structured output with `reasoning`, `confidence_basis`, and `nodes_considered`. Never free-form strings, never direct database writes. Arithmetic is delegated to Tier 1.

Every LLM tool must:
1. Accept a typed node set as input (not raw strings).
2. Return a structured result — schema-validated at both ends.
3. Delegate arithmetic to Tier 1 tools.
4. Be callable by humans and automations with identical signatures.

### Tier 3 — Agents
Scoped workflows that orchestrate Tier 1 + Tier 2 tools to produce `BeaconAction` **proposals**. Agents never execute actions directly — they drop proposals into an operator's inbox or into the automated-approval pipeline.

Every agent declares:
- **Purpose** — one sentence.
- **Scope** — `'hotel' | 'organization'`, inherits caller's role.
- **Cadence** — how often it runs (see Cycle-First Operation below).
- **Tool set** — the bounded list of Tier 1 + Tier 2 tools it may invoke.
- **Approval boundary** — who can approve its proposals (operator, threshold-based auto-approve, or both).
- **Eval suite** — `*.eval.ts` in `packages/reality-graph/src/evals/` with ≥10 historical cases, documented pass rate.

### The Agent-Action Contract

> **Every LLM-proposed action must be a `BeaconAction`.**

The agent's "output" is not text — it is a typed, validated, auditable action proposal that flows through the same action registry as human-triggered mutations. The operator approves; the registry executes; the graph records. This means:

- Agents can never bypass validation.
- Agent actions are visible in the audit trail with `triggered_by: 'ai_proposal_accepted'`.
- Model changes cannot silently alter system behavior — every proposal is typed, and type changes require a migration.

### AI Transparency Is a Product Requirement

Every AI-shown decision must surface: which graph nodes were considered, what the confidence basis is (e.g., *"based on 30-day avg, 94% restock adherence"*), which tools were called, what each returned. This is not a debug panel — it is the trust layer of the product.

### AI Agents Inherit Human Security Scope

An agent triggered by a hotel manager can only read/write nodes scoped to their hotel. An agent triggered by an org director operates at org scope. Never grant agents broader access than the human who invoked them. Scope = echelon, always.

## Cycle-First Operation (Non-Negotiable)

Beacon is not a dashboard where operators go to *check*. It is a cycle where agents *pre-populate decisions* and operators *approve / adjust*. Gallatin's **Input → Analyze → Act → Repeat** is the canonical loop.

### Every Agent Has a Declared Cadence

| Cadence | Example agent | Example surface |
|---|---|---|
| **On-event** | `detect_consumption_spike` (trigger on stock_log insert) | Realtime notification |
| **Hourly** | `run_intelligence_cycle` | Morning briefing accumulates overnight |
| **Daily** | `auto_create_alerts`, `detect_expiring_contracts` | Briefing panel |
| **Weekly** | `learn_supplier_lead_times`, `apply_optimal_par` | Monday morning digest |
| **Monthly** | Chain benchmarking, contract-renewal sweep | Portfolio review |

### Surfaces Are Organized by Cycle, Not by Table

- **Briefing** = "what's in this operator's current cycle" (unapproved proposals, unread alerts, pending reviews).
- **SmartProposalsPage** is not "a page of proposals" — it is the **weekly restock agent's inbox**.
- **AlertsPage** is not "a page of alerts" — it is the **continuous anomaly-detection agent's inbox**.
- **ContractsPage** is not "a CRUD table" — it is the **contract renewal agent's cycle dashboard**.

### Decision Windows Are First-Class
Every surface that shows an agent proposal must show: when the agent ran, how long operators have to respond, what happens if they don't (auto-approve / escalate / expire), and what the next cycle looks like.

### Empty States Are Intelligence Opportunities
"All clear" is never enough. Every empty state explains: which nodes were scanned, against what thresholds, when the next cycle runs, and what the most recent cycle's outcome was.

## Key Architectural Decisions

- **Ontology-first design:** The Reality Graph (`packages/reality-graph`) is the single source of truth.
- **Network-as-primitive:** Organization → Hotel → Zone. Every query is scope-aware from day one.
- **Logic on nodes:** Computed properties and business rules live in `packages/reality-graph`, not in hooks or components.
- **Typed actions:** Every mutation is a named `BeaconAction` flowing through the action registry.
- **Agents are workflows, not chatbots:** declared purpose, scope, cadence, tool set, approval boundary, eval suite.
- **Proposals, not executions:** LLM agents produce `BeaconAction` proposals; the action registry executes.
- **Lateral before external:** inter-property `TRANSFER_STOCK` is checked before any external procurement action.
- **Cycle-first UX:** surfaces are organized by agent cycle and decision window, not by table.
- **Progressive disclosure:** Show only what the current role + layer + echelon requires.
- **Role-aware home screen:** Opens in the correct layer based on user role and scope.
- **Contextual Command Bar:** Bottom navigation that changes by layer/role.
- **Immutable Flow:** StockLogs are never edited or deleted — corrections are compensating transactions.
- **State split:** Zustand only for UI/session state. All server data lives in TanStack Query + graph cache. Never duplicate server state in Zustand.
- **Offline-first:** All mutations use signed deltas. Sync happens through the graph queue.
- **Package independence:** `packages/reality-graph` must never import from `apps/web`. The graph is deployable independently.

## Build Phases

- Phase 0–4 ✅ Monorepo scaffold, Supabase, Auth, Core Inventory, Dashboard
- Phase 5 → Reality Graph Core (edge type vocabulary, action registry, node computed properties, `relationship_edges` table)
- Phase 6 → Floor + Flow perfection (voice, AR preview, Flow Timeline — the process variant explorer)
- Phase 7 → Eye Layer intelligence (Waste Radar, predictive restocking, pgvector semantic search, AI copilot with eval suite)
- Phase 8 → Mind Layer strategy (benchmarking, procurement leverage, invoicing insight, outbound webhooks to PMS/suppliers)
- Phase 9 → Autonomous Hotel (IoT, full AR, autonomous restock proposals)

## TypeScript & Code Rules

- `@beacon/types` + Reality Graph types are the only source of truth — never redefine entity shapes locally.
- `any` is forbidden. Strict mode is enforced everywhere (`noImplicitAny`, `strictNullChecks`, etc.).
- Every new component and hook must declare its layer in a comment.
- Computed node properties belong in `packages/reality-graph`, not in component files.
- Raw Supabase mutations are forbidden in `apps/web` — use the action registry.

## Adding Features

Before writing any code, answer these questions:

1. Which of the four layers does this belong to?
2. How does it extend or use the Reality Graph?
3. Which echelon scope does this operate at — hotel, organization, or both? How is scope enforced at the RLS boundary?
4. Does it respect progressive disclosure and role awareness?
5. If it's a mutation — is it a named `BeaconAction` with submission criteria and side effects?
6. If it's a computed value — is it defined as a derived property on the node type, not in a hook?
7. If it's an agent — what's its declared purpose, scope, cadence, tool set, approval boundary, and eval suite?
8. If it's an AI-proposed action — is the proposal a typed `BeaconAction` flowing through the action registry, not free text?
9. Is there a cycle this belongs to, or does it create a new cadence? Document the next-run expectation.

Document the answers in a comment at the top of the relevant file.

## Adding shadcn/ui Components
```bash
cd apps/web
pnpm dlx shadcn@latest add <component-name>
```

Components install to `apps/web/src/components/ui/`.

## Environment Variables

Copy `.env.example` to `.env` and fill in values. Vite exposes only `VITE_*` prefixed vars to the client. Never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_*` var.

---

## Design & Product Philosophy — Foundry + AIP + Gallatin

This is not a hotel inventory app. It is an **operating system for hotel reality**. Three influences define the design:

- **Palantir Foundry** — ontology-first data model. Everything is a typed node or edge in the Reality Graph. No standalone CRUD.
- **Palantir AIP** — agent-first intelligence layer. LLMs produce typed action proposals, not free text. Every agent declares purpose, scope, cadence, tool set, approval boundary, and eval suite.
- **Gallatin** — multi-echelon logistics primacy. The network (Organization → Hotel → Zone) is the primitive. Lateral resupply between sister properties comes before external procurement. The Input → Analyze → Act → Repeat cycle is the UX mental model.

Every feature must be built to these standards — operator-grade, ontology-first, agent-driven, multi-echelon, intelligence-everywhere.

### The 10 Non-Negotiable Principles

1. **Ontology-first** — every feature is a node or edge in the Reality Graph. Never build standalone CRUD. Always ask: how does this extend the graph?

2. **Operator-grade density** — interfaces are for managers at terminals making decisions under pressure, not consumer apps. Fill space with signal, not padding. A table row that can show a trend arrow, confidence band, or anomaly flag must.

3. **Intelligence everywhere** — static data displays are failures. Every number must carry its derived context: `47 units · ↓12% this week · ~6d left` is correct. `47 units` alone is not.

4. **Decision support, not data display** — every screen must answer: *what should the operator do right now?* Surfaces that only show what IS, without indicating what to DO, are incomplete.

5. **Auditability as a first-class feature** — every mutation is immutable, traceable, and revertible. The Flow Timeline and graph edges are not a debug tool; they ARE the product. Operators must always be able to see why the world is the way it is.

6. **Cross-domain synthesis** — never show one domain in isolation if combining domains reveals more. Stock + supplier + waste + team activity = situational picture. A waste spike is more meaningful when correlated with a team member's shift and a supplier's late delivery.

7. **Real-time awareness** — stale data is wrong data. Realtime subscriptions, live badge counts, and cache invalidation on remote changes are non-negotiable.

8. **Progressive disclosure with role-awareness** — surface only what the current operator needs for their mission.

9. **Keyboard-first, high-cadence workflows** — all modals close on Escape and submit on Enter. Batch operations wherever a list exists.

10. **Confidence and uncertainty** — predictions must always expose their basis inline: *"based on 30-day avg"*. Never present model outputs as ground truth.

### Self-Apply: Intelligence Everywhere Includes Our Own Code

We sell intelligence everywhere — derived context, confidence basis, immutable audit, decision support. **Our own code, migrations, and debug loops must meet the same bar.** Hypocrisy here is a product defect: we cannot promise customers that the world's data will be actively analyzed *for* them while shipping migrations that fail with `stack depth limit exceeded` and zero traceable context.

The recent `SECURITY DEFINER` RLS-recursion incident is the canonical lesson. It surfaced as an opaque HTTP 500 — exactly the failure mode we promise operators they will never have. The fix was one line; the prevention was missing.

**Rules that follow:**

1. **Every new RPC, trigger, or RLS helper ships with a test** that exercises it under realistic RLS context — anonymous, authenticated, cross-org, cross-hotel. RLS recursion, missing `SECURITY DEFINER`, and policy gaps must fail in CI, not in production.
2. **Every migration touching auth, RLS, or graph helpers runs `get_advisors`** before it is considered done. Advisors are part of the migration cycle, not an ad-hoc debugging step after something breaks.
3. **Failure modes must carry derived context.** A stack-depth error without a function call chain is a defect, not just a Postgres quirk. Wrap, log, or capture enough context that the failure tells us *where* and *why* on first read.
4. **Instrument before shipping, not after debugging.** If a feature has a cycle, the cycle emits metrics. If an agent runs, its run logs input nodes, tools called, and outcome — for our observability, not just the customer's UI.
5. **Our debug loop is a Beacon cycle.** Input (the failure) → Analyze (the trace) → Act (fix + prevention) → Repeat (update tests, advisors, or this file). A patch without prevention is incomplete.

If a bug took longer than ten minutes to root-cause, ask: *what observability would have made this a one-minute fix?* The answer is the real deliverable, alongside the patch.

### UI Rules That Follow From This

- **Layer-grouped navigation** — tabs and sections are always grouped by ontological layer (Floor / Flow / Eye / Mind). The layer label is a typographic eyebrow / chip in the page header — **never** a `Layer ·` prefix on tab labels (that pattern doesn't survive the 5/10/30 audit below).
- **Every list has a sort order with intent** — sort by urgency, anomaly score, or business impact. The most critical item is always at the top.
- **Trend indicators are mandatory** on any metric that changes over time.
- **Empty states are intelligence opportunities** — explain what was scanned, when, and what thresholds were applied. Never just a checkmark or a generic "nothing here" message.
- **Actions live next to data** — operators should never navigate away to act on what they see. Inline `Request Restock`, `Write Off`, `Approve` buttons are the standard.
- **Every AI decision shows its reasoning** — confidence basis, nodes considered, tools called. This is the trust layer.

### Patterns Lifted From Foundry / AIP (Non-Negotiable Going Forward)

Sourced from Palantir's public Foundry & AIP docs (Workshop, Object Views, Action Types, Agent Studio, AI FDE). Apply these without re-deriving them.

- **The 5 / 10 / 30 rule** — top-level navigation ≤ 5 destinations; visible components per view ≤ 10; target whitespace 30–40%. This is the literal cure for sub-tab proliferation. When a sub-tab appears, the design has failed; collapse to Sections inside the page.
- **Object Views as the canonical surface for any node type** — every variant / supplier / restock_request / PO / stock_log gets a Full Object View (own page) and a Panel Object View (slide-over). Standard anatomy: **header → metric strip → action bar → body sections → right rail**. Operator never gets a different anatomy depending on the entity.
- **Action invocation has exactly two modes** — `open-form` (modal auto-rendered from the action's parameter schema; default) and `apply-immediately` (one-click when defaults are valid). Every BeaconAction declares which mode applies. No third pattern.
- **Color-coded button intents** — Gray = secondary (Back/Cancel), Blue = primary CTA (Create/Next), Green = completion (Submit/Approve), Amber = attention-required (Archive), Red = destructive (Delete). Audit every `<Button>` against these five.
- **Action log is a first-class node, not a sidebar** — StockLog already is. Surface it bidirectionally: in a global Activity feed AND in every related object's right rail. Never hide audit behind a drawer toggle.
- **"View reasoning" is a disclosure, not the main copy** — agent reasoning trace lives behind an inline expand under each AI-generated row, not crammed into the response text. The action modal is for parameter review; the trace surface is for *why this was proposed*. Two distinct affordances.
- **Copilot is a contextual slide-over, not a global drawer** — when open, it knows the current Object View context and passes that node's id to its tools. One drawer, contextually scoped. Right-rail outline panel renders the user → tool → tool → response chain with click-to-jump.
- **Pinned module header, non-scrolling tabs** — page-level tabs live in a sticky header that survives sub-navigation. Sub-views become **Sections inside the page**, not tab strips at the top.
- **Compact density default; 16px spacing rhythm** — touch targets ≥ 30px when scrolling is enabled. Tabular numerals (`font-feature-settings: 'tnum'`) on every number that changes over time.
- **`Request Clarification` as an agent capability** — when an agent is below confidence threshold, it pauses and asks the operator a question inline rather than emitting a low-confidence proposal. Beacon copilot should adopt this for any tool whose result has confidence < 0.6.

Where Foundry's pattern doesn't fit Beacon's scale — single-hotel-to-small-chain, ~15 node types, 1-tenant-per-org typical — translate spiritually but reshape: a single global Copilot slide-over instead of N embedded widgets; a typographic layer eyebrow instead of a `Mind ·` prefix; a linear indented outline instead of a directed-graph reasoning trace.

The key insight: Palantir's products feel like the world's data is being actively analyzed *for* you, not stored *for* you to analyze yourself. Every sprint should move the app further in that direction.