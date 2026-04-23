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
  | { type: 'REVERT_ACTION'; originalId: string; revertReason: string };
```

**Immutable Flow:** StockLogs are never edited or deleted — corrections are always compensating transactions (`is_revert: true`, `revert_of: <original_id>`). The `triggered_by` field must always be set: `'user'`, `'ai_proposal_accepted'`, `'automation_threshold'`, or `'revert'`.

## The AI & Intelligence Rules

### LLM functions are graph tools, not UI features

Eye and Mind Layer AI functions operate on node sets from the Reality Graph. They are registered in `packages/reality-graph` as named, typed tools. They are never implemented as one-off API calls inside components.

Every LLM tool must:
1. Accept a typed node set as input (not raw strings)
2. Return a structured result with `reasoning`, `confidence_basis`, and `proposed_action`
3. Use a separate deterministic tool for any arithmetic (LLMs cannot do math reliably)
4. Be callable by both human-triggered and automation-triggered flows

### AI transparency is a product requirement

Every AI-generated decision shown to an operator must display:
- Which graph nodes were considered
- What the confidence basis is (e.g., *"based on 30-day avg, 94% restock adherence"*)
- The chain-of-thought trace (which tools were called, what they returned)

This is not a debug panel. It is the trust layer of the product. Never ship an AI feature without it.

### Eval before ship

Before any Eye or Mind Layer AI feature is merged, it requires a `*.eval.ts` file in `packages/reality-graph/src/evals/` with at least 10 historical test cases and a documented pass rate. LLM functions are non-deterministic — without evals you cannot know if a model change broke your proposals.

### AI agents inherit human security scope

An AI agent triggered by a manager at Hotel X can only read and write nodes scoped to Hotel X. Never grant agents broader access than the human user who triggered them.

## Key Architectural Decisions

- **Ontology-first design:** The Reality Graph (`packages/reality-graph`) is the single source of truth.
- **Logic on nodes:** Computed properties and business rules live in `packages/reality-graph`, not in hooks or components.
- **Typed actions:** Every mutation is a named `BeaconAction` flowing through the action registry.
- **Progressive disclosure:** Show only what the current role + layer requires.
- **Role-aware home screen:** Opens in the correct layer based on user role.
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
3. Does it respect progressive disclosure and role awareness?
4. If it's a mutation — is it a named `BeaconAction` with submission criteria and side effects?
5. If it's a computed value — is it defined as a derived property on the node type, not in a hook?
6. If it's an AI feature — does it have a `*.eval.ts` file and a transparency trace panel?

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

## Design & Product Philosophy — Palantir Standard

This is not a hotel inventory app. It is an **operating system for hotel reality**. Every feature must be built to Palantir Foundry/Gotham standards — operator-grade, ontology-first, intelligence-everywhere.

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

### UI Rules That Follow From This

- **Layer-grouped navigation** — tabs and sections are always grouped by ontological layer (Floor / Flow / Eye / Mind) with a visible label prefix.
- **Every list has a sort order with intent** — sort by urgency, anomaly score, or business impact. The most critical item is always at the top.
- **Trend indicators are mandatory** on any metric that changes over time.
- **Empty states are intelligence opportunities** — explain what was scanned, when, and what thresholds were applied. Never just a checkmark or a generic "nothing here" message.
- **Actions live next to data** — operators should never navigate away to act on what they see. Inline `Request Restock`, `Write Off`, `Approve` buttons are the standard.
- **Every AI decision shows its reasoning** — confidence basis, nodes considered, tools called. This is the trust layer.

The key insight: Palantir's products feel like the world's data is being actively analyzed *for* you, not stored *for* you to analyze yourself. Every sprint should move the app further in that direction.