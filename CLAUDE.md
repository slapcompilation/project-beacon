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

Architecture

    Turborepo monorepo with pnpm workspaces.

    apps/
      web/              ← Vite + React 18 + TypeScript + Tailwind + shadcn/ui
    packages/
      types/            ← Single source of truth for all entities
      services/         ← Abstract interfaces (IAuthService, etc.)
      ui/               ← Shared primitives
      hooks/            ← TanStack Query + graph hooks
      reality-graph/    ← Core ontology & four-layer engine (THE HEART OF THE APP)

    The Reality Graph Ontology (Non-Negotiable)

    This is not an inventory app. It is the operating system for hotel reality.

    All data exists as nodes in a single living graph:

    - Nodes: Variant, StockLog, RestockRequest, Alert, Report, Hotel, User, etc.
    - Edges: "causes", "consumes", "restocks", "belongs_to_hotel", etc.

    Every feature, screen, and decision must be built on top of this graph. There is only one source of truth.

    The Four Permanent Layers (The Intentional Architecture)

    Every new feature must be placed in exactly one of these layers:

    ┌─────────────┬──────────────────────────────────────────────────────────────────────────────────────┐
    │    Layer    │                                    Responsibility                                    │
    ├─────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
    │ Floor Layer │ Physical reality (scanning, voice, quick adjustments)                                │
    ├─────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
    │ Flow Layer  │ Operational movement (receive → store → use → restock, immutable logs, undo)         │
    ├─────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
    │ Eye Layer   │ Intelligence (waste radar, predictive restocking, smart alerts)                      │
    ├─────────────┼──────────────────────────────────────────────────────────────────────────────────────┤
    │ Mind Layer  │ Strategy & memory (chain benchmarking, procurement leverage, invoicing intelligence) │
    └─────────────┴──────────────────────────────────────────────────────────────────────────────────────┘

    Rule for Claude: Before writing any code, first decide which layer the feature belongs to and document it in a comment at the top of the file or function.

    Key Architectural Decisions

    - Ontology-first design: The Reality Graph (packages/reality-graph) is the single source of truth.
    - Progressive disclosure: Show only what the current role + layer requires.
    - Role-aware home screen: Opens in the correct layer based on user role.
    - Contextual Command Bar: Bottom navigation that changes by layer/role.
    - Immutable Flow: StockLogs are never edited or deleted — corrections are always compensating transactions (is_revert: true, revert_of: <original_id>).
    - State split: Zustand only for UI/session state. All server data lives in TanStack Query + graph cache. Never duplicate server state in Zustand.
    - Offline-first: All mutations use signed deltas. Sync happens through the graph queue.

    Build Phases

    - Phase 0–4 ✅ Monorepo scaffold, Supabase, Auth, Core Inventory, Dashboard
    - Phase 5 → Reality Graph Core (packages/reality-graph, four-layer hooks, relationship_edges table)
    - Phase 6 → Floor + Flow perfection (voice, AR preview, Flow Timeline)
    - Phase 7 → Eye Layer intelligence (Waste Radar, predictive restocking)
    - Phase 8 → Mind Layer strategy (benchmarking, procurement leverage, invoicing insight)
    - Phase 9 → Autonomous Hotel (IoT, full AR, autonomous restock proposals)

    TypeScript & Code Rules

    - @beacon/types + Reality Graph types are the only source of truth — never redefine entity shapes locally.
    - any is forbidden. Strict mode is enforced everywhere (noImplicitAny, strictNullChecks, etc.).
    - Every new component and hook must declare its layer in a comment.

    Adding Features

    Before writing any code, answer these questions:

    1. Which of the four layers does this belong to?
    2. How does it extend or use the Reality Graph?
    3. Does it respect progressive disclosure and role awareness?

    Document the answers in a comment at the top of the relevant file.

    Adding shadcn/ui Components

    cd apps/web
    pnpm dlx shadcn@latest add <component-name>

    Components install to apps/web/src/components/ui/.

    Environment Variables

    Copy .env.example to .env and fill in values. Vite exposes only VITE_* prefixed vars to the client. Never put SUPABASE_SERVICE_ROLE_KEY in a VITE_* var.

    A few notes on what I cleaned up:
    - The `text` code fences in the original were replaced with proper markdown (no language tag for the directory tree, ` ```bash ` for commands)
    - Lists were formatted as proper markdown bullet points
    - The layer table makes the four layers scannable at a glance
    - I preserved all the content from your existing `CLAUDE.md` (shadcn instructions, env vars) since those are still relevant to the project

## Design & Product Philosophy — Palantir Standard

    This is not a hotel inventory app. It is an **operating system for hotel reality**.
    Every feature must be built to Palantir Foundry/Gotham standards — operator-grade,
    ontology-first, intelligence-everywhere.

    ### The 10 Non-Negotiable Principles

    1. **Ontology-first** — every feature is a node or edge in the Reality Graph. Never
       build standalone CRUD. Always ask: how does this extend the graph?

    2. **Operator-grade density** — interfaces are for managers at terminals making
       decisions under pressure, not consumer apps. Fill space with signal, not padding.
       A table row that can show a trend arrow, confidence band, or anomaly flag must.

    3. **Intelligence everywhere** — static data displays are failures. Every number
       must carry its derived context: `47 units · ↓12% this week · ~6d left` is correct.
       `47 units` alone is not.

    4. **Decision support, not data display** — every screen must answer: *what should
       the operator do right now?* Surfaces that only show what IS, without indicating
       what to DO, are incomplete.

    5. **Auditability as a first-class feature** — every mutation is immutable,
       traceable, and revertible. The Flow Timeline and graph edges are not a debug tool;
       they ARE the product. Operators must always be able to see why the world is the
       way it is.

    6. **Cross-domain synthesis** — never show one domain in isolation if combining
       domains reveals more. Stock + supplier + waste + team activity = situational
       picture. A waste spike is more meaningful when correlated with a team member's
       shift and a supplier's late delivery.

    7. **Real-time awareness** — stale data is wrong data. Realtime subscriptions,
       live badge counts, and cache invalidation on remote changes are non-negotiable.
       Operators must trust that what they see is what is true right now.

    8. **Progressive disclosure with role-awareness** — surface only what the current
       operator needs for their mission. Floor staff see physical reality signals.
       Managers see flow and operational health. Owners see chain-level strategy.

    9. **Keyboard-first, high-cadence workflows** — operators process many items quickly.
       All modals close on Escape and submit on Enter. One-click actions for common
       operations. Batch operations wherever a list exists.

    10. **Confidence and uncertainty** — predictions (days_until_zero, forecast,
        proposals) must always expose their basis inline: *"based on 30-day avg"*.
        Never present model outputs as ground truth.

    ### UI Rules That Follow From This

    - **Layer-grouped navigation** — tabs and sections are always grouped by their
      ontological layer (Floor / Flow / Eye / Mind) with a visible label prefix.
      Never use a flat unlabelled list when layers apply.

    - **Every list has a sort order with intent** — not alphabetical by default.
      Sort by urgency, anomaly score, or business impact. The most critical item
      is always at the top.

    - **Trend indicators are mandatory** on any metric that changes over time.
      Use arrow glyphs, color bands (red/yellow/green), or sparklines — whichever
      fits the space.

    - **Empty states are intelligence opportunities** — "No alerts" should tell
      the operator what was scanned, when, and what thresholds were applied —
      not just a checkmark.

    - **Actions live next to data** — operators should never navigate away from
      a surface to act on what they see. Inline "Request Restock", "Write Off",
      "Approve" buttons are the standard. Separate action pages are a last resort.

    The key insight to keep front of mind: Palantir's products feel like the world's data is being actively analyzed for you, not stored for you to analyze yourself. Every sprint should move the app 
    further in that direction.