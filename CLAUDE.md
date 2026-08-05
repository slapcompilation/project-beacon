# CLAUDE.md

Guidance for Claude Code working in this repo. The goal is **a Foundry clone
built from Palantir's public documentation.**

This file was 658 lines describing a hospitality product — a Reality Graph, a
Logic Tool registry, an Action registry, three shipped agents, four operator
layers. All of it is deleted. What follows describes what is actually here.

## The rule that produced this state

**Everything not in Palantir's documentation is deleted.** Row count, working
data and effort spent are not arguments. The test is not "does Foundry have
something like this" — it is **"is ours built the way Foundry builds it"**. A
half-built version is worse than none, because it looks like a foundation.

Four things follow, and each was learned by getting it wrong:

1. **Cite the page, inline, before you build.** `grep docs/foundry-reference/mirror/`
   for the concept. Quote the sentence you are relying on. A citation invented
   after the fact is how `object_type_impact` came back — the phrase "impact
   analysis" appears in exactly one mirrored page and it is about pipelines.
2. **A link is not a reading.** `all-foundry-urls.txt` holds 4,764 slugs; the
   mirror holds the pages. Having the URL proves nothing.
3. **If the documentation does not cover it, ASK.** The operator has the
   learn.palantir.com courses and the end-to-end walkthroughs. A plausible shape
   invented here becomes structure, and structure is expensive.
4. **Never hardcode.** The named example: `rebuild_relationship_edges_view()`
   appended a hand-written `product_variants JOIN products` branch to a view
   whose migration claimed it was derived from `link_types`. The claim was false
   for as long as the branch existed.

### The three-times mistake, so it is not made a fourth

A universal table is not how Foundry stores anything. Deleted in this order,
each for the same reason, and each time the next one was kept:

| deleted | what it was |
|---|---|
| `object_links` | one row per link of any type |
| `relationship_edges_store` | one row per edge of any type |
| `object_records` | one row per object of any type, properties in jsonb |

Foundry backs an object type with a **datasource**, and where there is not one
you "select a location to generate a dataset" (`create-object-type.md`) — a real
table, real columns, per type. Links are backed by object type foreign keys or a
join dataset (`create-link-type.md`). If a design needs a generic table with a
`kind` column, it is this mistake again.

## What is here

```
apps/web/                44 files. Ontology Manager (/ontology), projects,
                         account, auth, the shell. Vite + React + Blueprint.
packages/reality-graph/  the ontology model: object types, properties and base
                         types, link cardinality, interfaces, shared properties,
                         object sets and traversal, status, project roles.
packages/types/          UserRole, AuthSession, EdgeType, generated ontology types.
packages/services/       IAuthService and the other interface seams.
packages/ui/             cn().
supabase/migrations/     390 migrations. The last ~40 are the teardown.
docs/foundry-reference/  532+ mirrored pages + 4,764 URL slugs. THE SOURCE.
docs/foundry-deep-dives/ 214 PDFs from learn.palantir.com, nine courses.
```

Eleven tables, and every value in every CHECK traces to a page:

| table | what it holds |
|---|---|
| `object_types` | api name, label, properties, status, visibility, title key, source table |
| `link_types` | the two sides, cardinality, backing |
| `ontology_interfaces`, `object_type_interfaces` | interfaces and their implementations |
| `shared_properties` | one definition used by several types |
| `time_series_properties` | a time series property's declaration |
| `object_sets` | a saved set with its filters |
| `projects`, `project_resources`, `project_role_grants` | Compass: owner/editor/viewer/discoverer |
| `organizations`, `users` | the tenant, and who is in it |

**The ontology has no way to hold an object yet.** `object_types` can describe
one; nothing stores instances. That is the datasource model, and it is the first
thing to build.

## Commands

```bash
pnpm install
pnpm dev                         # all apps
pnpm --filter @beacon/web dev
pnpm turbo lint type-check test  # what CI runs
pnpm check:rpcs                  # every RPC the app calls exists
pnpm check:surfaces              # every web file is reachable from main.tsx
pnpm db <file.sql>               # apply one migration — NEVER MCP apply_migration
pnpm gen:ontology                # regenerate types from object_types
```

### The guards, and what is gone

`check:rpcs` and `check:surfaces` remain. Both ask about **real reachability**
and answer by walking something — the RPC names the app calls, the import graph
from `main.tsx`.

`check:shape` and `check:vocabulary` are deleted, with `shape_registry`. They
depended on an allowlist that let a static scan tell "deliberately ahead of its
runtime" from "dead". **Foundry needs no such table**: the platform indexes
ontology resources, so "what uses this" is a query against the resource graph.
Here the ontology is its own registry — `object_types` is the list of what
exists. Wanting an allowlist is the signal to index instead.

The RLS contract suite is also gone; Foundry handles data contracts another way
and we take that shape when we reach it. **This has a cost that already
landed**: `auth_org_id()` kept reading a dropped table for a day, and every
policy calls it. Nothing static catches that. Until there is a replacement,
assume RLS is unverified.

## Substrate

TypeScript everywhere, Postgres underneath. **Not Java**, and the reason is
specific rather than inertia: Foundry's core is Spark and the JVM data stack,
which are non-goals here. The one thing that transfers — cross-boundary type
safety — a shared TypeScript package gives us without generated SDKs.

Two things we do take from their stack:

- **Namespaced, typed errors.** `Phonograph2:SchemaMismatch` is a namespace, a
  name and a payload. A caller must be able to branch without parsing prose.
- **Python for modelling, behind an adapter seam** — when there is a model, not
  before.

## TypeScript & code rules

- `any` is forbidden. Strict mode enforced.
- UI primitives from `@blueprintjs/core` and `@blueprintjs/icons`. No shadcn, no
  lucide. 4px radius, compact density, tabular numerals for numbers.
- Zustand for UI/session only. Server data lives in TanStack Query.
- **Write less code.** If the same outcome fits in 50 lines instead of 100, that
  is the version that ships.
- **Comments stay human.** One short line, present tense, explaining a *why* or
  a gotcha. No banners, no marketing voice, no restating the code.

## Adding anything

1. **Find it in the mirror first.** Quote the sentence. If it is not there, say
   so and ask.
2. **Is ours built the way theirs is?** Not "do they have one".
3. **What backs it?** An object type has a datasource. A link type has a
   datasource. If the answer is "a generic table", stop.
4. **What reaches it?** If nothing does, it is not built yet — and an allowlist
   is not the answer.
