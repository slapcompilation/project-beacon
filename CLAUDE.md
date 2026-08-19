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

### The agents, and what they may not do

`.claude/agents/` holds three, and the division is deliberate:

| agent | writes | job |
|---|---|---|
| **foundry-reader** | `readings/` only | read a section, parse every image, end with **Decisions** and **Questions** blocks |
| **foundry-adversary** | nothing | try to falsify a reading or a migration |
| **foundry-gap** | nothing | diff the mirror against the schema, **both directions** |

**Only one agent touches the database, and it is not one of these.** Migrations
are ordered and stateful; parallel builders would collide on the ledger and the
ordering *is* the design.

**Scheduling: observe on a timer, never build on one.** `doc-drift.yml` runs
weekly; the audits run in CI. Nothing that writes a migration runs unattended,
and the reason is specific rather than caution — **applied migrations are
immutable and run once**, so an unreviewed one can only be corrected forward,
never edited. The recitation gate says the same thing from the other side: if a
human reads the Decisions block before building, the build step cannot be
autonomous by construction.

**A reading is never built from until a human has read its Decisions block.**
That block is where an invented mechanism has to declare itself, and reciting
before building is what has caught the expensive mistakes here while they were
still cheap.

`pnpm check:readings` makes the citation half mechanical: every quotation is
grepped back against the mirror, and a quote from a screenshot must name the
screenshot. It found a real misquote the first time it ran.

### The two artifacts that make this work

**`docs/foundry-reference/MAP.md`** — every mirrored page by section and title,
4,068 of them across 102 sections as of 2026-08-19. A floor plan, not a reading: it answers "does a page about X
exist, and what is it called", which is the question that keeps going wrong.
`staging` appears in no URL but `manage-models/release-model` defines it. Grep
titles here before concluding Foundry lacks something.

**It is generated, and that is not a detail.** It was maintained by hand and
drifted to 1,184 pages across 36 sections while the mirror held 2,284 across
82 — so the one artifact whose job is answering "does a page about X exist"
was answering *no* for half the corpus, which reads as "Foundry lacks this".
`node scripts/build-map.mjs` rebuilds it, and the mirror script runs that
after every fetch. Never hand-edit it.

**`docs/foundry-reference/readings/`** — our reading of the pages we have
actually read, with a queue in build order. Grep it before designing anything;
an answer already written down beats re-deriving one, and the "connects to" lines
are how a concept met in one part of the platform gets recognised in another.

The corpus is 4,068 mirrored pages against 4,818 known URLs — **16% of the
documentation is not on disk**. `api/` used to be the biggest hole and is now
mirrored whole (1,243 pages fetched 2026-08-19, 6 unavailable), so the rule that
matters most about it changes: it is no longer "not on disk", it is **on disk and
under-read**.
The readings are far fewer still. That is the normal state — the map keeps the
unread ones findable, and the queue says which to read next and when.

**Refresh the index before trusting any answer about what exists.**
`node scripts/mirror-foundry-docs.mjs --urls` re-derives `all-foundry-urls.txt`
from the sitemap and *unions* it with what is there. The list was frozen for
two weeks, and the refresh turned up 39 unknown pages — one of which,
`functions/python-user-facing-error`, falsified code that had already shipped.

### Two vocabularies for one idea, which is the live trap

Foundry names the same concept differently for different audiences, and taking
the wrong one is how `builds.status` ended up holding `COMPLETED` and `ABORTED`
— the **job** tokens — for months. Three confirmed pairs:

| concept | Ontology Manager / prose | public API |
|---|---|---|
| a build finishing | (unpublished) | `RUNNING SUCCEEDED FAILED CANCELED` |
| a job's state | `WAITING RUN_PENDING RUNNING ABORT_PENDING ABORTED FAILED COMPLETED` | `WAITING RUNNING SUCCEEDED FAILED CANCELED DID_NOT_RUN` |
| an entity's status | `active experimental deprecated example` + `promoted` | `ACTIVE ENDORSED EXPERIMENTAL DEPRECATED` |

Neither side is wrong; they describe the same thing to a person and to a
program. **Decide which audience a column serves and say so in the migration.**
We build Ontology Manager, so ontology metadata takes the prose vocabulary and
the orchestration ledgers take the API's.

**`api/` publishes what the prose omits.** Its pages carry no
`pageProps.markdown` — they carry the spec at `page.content.endpoint`, with
request and response schemas, field descriptions and **enums**. It has
falsified our CHECK constraints twice. Grep it before inferring a value.

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
apps/web/                118 files. Ontology Manager (/ontology), projects,
                         account, auth, the shell. Vite + React + Blueprint.
packages/ontology/       the ontology model: object types, properties and base
                         types, link cardinality, interfaces, shared properties,
                         object sets and traversal, status, project roles, and
                         the generated per-type interfaces.
packages/platform/       the engine tested against the documentation's own
                         printed answers, as `authenticated`.
packages/services/       IAuthService and the other interface seams, with the
                         AuthSession and UserRole they describe.
supabase/migrations/     590 migrations. 355 is where the ontology was emptied;
                         everything after it is the rebuild.
docs/foundry-reference/  4,068 mirrored pages of 4,818 known URLs. THE SOURCE.
docs/substrate-reference/ 439 mirrored Supabase pages. What we build it WITH.
docs/foundry-deep-dives/ 214 PDFs from learn.palantir.com, nine courses.
```

The core began as eleven tables; the platform now holds ~65 (datasets and
transactions, markings, value types, interfaces, actions, branches and
proposals, the working state). The rule is unchanged — every value in every
CHECK traces to a page — and the original core is still the map's spine:

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

**The ontology holds objects.** This paragraph used to say it could not, and was
left saying so long after it stopped being true — check it against the database
before repeating it. `index_object_type` builds `objects.ot_<uuid>`: a real
table, one real typed column per property, primary key on the key property. It
runs only from a RUNNING build job, gathers each datasource's current view,
replays `object_edits` over it, drops the deleted, and fails the build on a value
type violation. Objects that exist only in the edit log join the merge, so a type
can hold rows its datasource never had.

What a *new* type could not do until 590 is start life valid: creation left it
with no datasource, so its own linter reported "A backing datasource is required"
and the save was refused. `generate_backing_dataset` is the wizard's documented
other branch — an empty dataset in a chosen location, because "permissions of the
objects of a type are determined by the location of their backing datasources".

## Commands

```bash
pnpm install
pnpm dev                         # all apps
pnpm --filter @beacon/web dev
pnpm turbo lint type-check test  # what CI runs
pnpm check:readings              # every citation traces to a mirrored page
pnpm check:doc-drift             # has a page we built from changed upstream?
pnpm check:surfaces              # every web file is reachable from main.tsx
pnpm check:edge                  # supabase/functions parse, and deploy whole
pnpm --filter @beacon/platform test   # the engine against Palantir's published answers
pnpm db <file.sql>               # apply one migration — NEVER MCP apply_migration
pnpm gen:client                  # regenerate the typed client from the platform
```

### The guards, and what is gone

`check:surfaces` remains. It asks about **real reachability** and answers by
walking the import graph from `main.tsx`. `check:edge` asks the same question of
`supabase/functions`, where the answer is harsher: the deploy uploads only what
`index.ts` statically imports, so an unimported file ships as an empty module
and fails when it is called rather than when it is deployed.

**`check:rpcs` is deleted, and how matters.** It regexed `.rpc('name')` out of
source and looked the name up in `pg_proc` — a reference check done by string
matching, because the boundary was untyped. The fix was to remove the boundary:
`pnpm gen:client` generates a typed value per platform entity, so
`client(datasetView).executeFunction({…})` fails to *compile* when the name is
wrong, with a "Did you mean" suggestion. **A guard whose job the compiler can do
should be deleted, not maintained.** `check:surfaces` is the same category and
goes the same way once object surfaces are generated.

**The platform suite** (`packages/platform`, was `check:datasets` then
`check:platform`) is the third, and it is a different kind: it **runs the
algorithm and compares against the answer the documentation prints**. `data-integration/datasets#example-of-transaction-types` states the
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
`superrepo/core-concepts.md`). The suite asks it one question: **is the
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
it. Nothing static catches that — the replacement is the platform suite's
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
