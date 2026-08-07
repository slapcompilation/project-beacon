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

## How to read a Foundry page

**The failure this prevents:** I read `concepts-styles.md`, took one sentence out
of it, and built a styling system. The page also described three stylesheet
scopes, the named-classes pattern, Blueprint's CSS API, a static-CSS rule with
three escapes, and custom fonts. None of it reached the work.

So, before building anything from a page:

1. **Mirror it, images and all.** `node scripts/mirror-foundry-docs.mjs <section>`
   downloads referenced images into `mirror/<section>/images/` and rewrites the
   links. A screenshot often carries the UI shape that the prose leaves out.
2. **Read every paragraph, and every image.** Not a skim for the sentence that
   settles the question at hand.
3. **Follow the sublinks.** A concept page usually has an overview above it and
   worked examples below. Read those too, then say which pages you read.
4. **Write the reading down** in `docs/foundry-reference/readings/<topic>.md`:
   what the pages say with quotes; **what the images add that the prose does not**;
   what it connects to elsewhere in the docs and in our code; decisions taken; and
   open questions you could not answer from the page.
5. **Recite it back before building.** The summary is for alignment on the
   deliverable, not a formality — this is where a wrong reading gets caught while
   it is still cheap.
6. **Separate quote from inference.** Anything not lifted from the page is marked
   as inference. `object_type_impact` came back on a citation that did not exist.

### The two artifacts that make this work

**`docs/foundry-reference/MAP.md`** — every mirrored page by section and title,
1,184 of them. A floor plan, not a reading: it answers "does a page about X
exist, and what is it called", which is the question that keeps going wrong.
`staging` appears in no URL but `manage-models/release-model` defines it. Grep
titles here before concluding Foundry lacks something.

**`docs/foundry-reference/readings/`** — our reading of the pages we have
actually read, with a queue in build order. Grep it before designing anything;
an answer already written down beats re-deriving one, and the "connects to" lines
are how a concept met in one part of the platform gets recognised in another.

The corpus is 1,184 pages and the readings are far fewer. That is the normal
state — the map keeps the unread ones findable, and the queue says which to read
next and when.

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
packages/ontology/       the ontology model: object types, properties and base
                         types, link cardinality, interfaces, shared properties,
                         object sets and traversal, status, project roles, and
                         the generated per-type interfaces.
packages/services/       IAuthService and the other interface seams, with the
                         AuthSession and UserRole they describe.
supabase/migrations/     390 migrations. The last ~40 are the teardown.
docs/foundry-reference/  532+ mirrored pages + 4,764 URL slugs. THE SOURCE.
docs/foundry-deep-dives/ 214 PDFs from learn.palantir.com, nine courses.
```

Eleven tables, and every value in every CHECK traces to a page:

| table | what it holds |
|---|---|
| `object_types` | api name (PascalCase), label, status, visibility |
| `object_type_properties` | one row per property: api name, base type, source, backing column, the two key designations |
| `object_type_datasources` | which dataset and branch backs a type |
| `link_types` | the two sides, cardinality, backing |
| `ontology_interfaces`, `object_type_interfaces` | interfaces and their implementations |
| `shared_properties` | one definition used by several types |
| `time_series_properties` | a time series property's declaration |
| `object_sets` | a saved set with its filters |
| `projects`, `project_resources`, `project_role_grants` | Compass: owner/editor/viewer/discoverer |
| `organizations`, `users` | the tenant, and who is in it |

**The ontology has no way to hold an object yet.** A type can now describe one
completely — properties are rows, the primary key and title key are designations
on them, and each names the datasource column it reads. What is missing is the
step that turns that description into stored instances.

## Commands

```bash
pnpm install
pnpm dev                         # all apps
pnpm --filter @beacon/web dev
pnpm turbo lint type-check test  # what CI runs
pnpm check:rpcs                  # every RPC the app calls exists
pnpm check:surfaces              # every web file is reachable from main.tsx
pnpm check:platform              # the engine against Palantir's published answers
pnpm db <file.sql>               # apply one migration — NEVER MCP apply_migration
pnpm gen:ontology                # regenerate types from object_types
```

### The guards, and what is gone

`check:rpcs` and `check:surfaces` remain. Both ask about **real reachability**
and answer by walking something — the RPC names the app calls, the import graph
from `main.tsx`.

`check:platform` (was `check:datasets`) is the third, and it is a different kind:
it **runs the algorithm and compares against the answer the documentation
prints**. `data-integration/datasets#example-of-transaction-types` states the
view after each of five transactions; markings, scoped sessions and the
datasource binding each state their outcome the same way. Nothing in it is
structural — no grep for a function name, no list of tables. The guarded-table
list is derived from `pg_class WHERE relrowsecurity`.

**It runs at least one pass as `authenticated`.** Connecting as the DB owner
bypasses RLS, which is how two infinite recursions sat in production while every
guard stayed green. A policy may not read the table it guards.

It cannot move into the migrations that own those algorithms: **applied
migrations are immutable and run once**, so an assertion placed in one would
never run again where it had already been applied. Migration assertions prove a
change at the moment it lands; this proves it still holds.

**Ontology content is not its job.** "Does every object type have a primary key,
does every property name a column its datasource actually has" is
`ontology_violations()` — a query against the ontology, which is Foundry's own
shape ("Ontology owners... write linters that check the entity definitions",
`superrepo/core-concepts.md`). `check:platform` asks it one question: **is the
ontology we actually have well-formed?**

`check:shape` and `check:vocabulary` are deleted, with `shape_registry`. They
depended on an allowlist that let a static scan tell "deliberately ahead of its
runtime" from "dead". **Foundry needs no such table**: the platform indexes
ontology resources, so "what uses this" is a query against the resource graph.
Here the ontology is its own registry — `object_types` is the list of what
exists. Wanting an allowlist is the signal to index instead.

The RLS contract suite is also gone; Foundry handles data contracts another way
and we take that shape when we reach it. **This had a cost that landed**:
`auth_org_id()` kept reading a dropped table for a day, and every policy calls
it. Nothing static catches that — the replacement is `check:platform`'s
`authenticated` pass, which reads every RLS-guarded table in the catalog.

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
- **Blueprint is Foundry's own framework** and the citation is explicit: "Slate
  is built on top of the Palantir open source Blueprint framework"
  (`mirror/slate/concepts-styles.md`). Use `@blueprintjs/core` and
  `@blueprintjs/icons`; for each component read its **CSS API**, not just the
  JavaScript one. Colours come from Blueprint's palette, "chosen with WCAG 2.0
  compliance in mind". No shadcn, no lucide.
- **No Tailwind.** Slate styles Blueprint with CSS — "like any other website,
  styles the DOM using CSS" — so ours live in `apps/web/src/styles/globals.css`:
  Blueprint's palette as tokens, then ~227 hand-written utility rules. There is
  no build step and no config; add a rule when a surface needs one.
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
