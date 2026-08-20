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
2. **A link is not a reading.** `all-foundry-urls.txt` holds 4,818 slugs; the
   mirror holds the pages. Having the URL proves nothing.
3. **If the mirror does not cover it, read the courses, then ASK.** The
   learn.palantir.com material is **on disk** — `docs/foundry-deep-dives/`, nine
   courses, 76MB — so grep there before asking the operator, and say you did. A
   plausible shape invented here becomes structure, and structure is expensive.
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
   as inference — that is what rule 1 above is guarding against, one step later.
7. **Never claim coverage you have not counted.** A header saying "all five of
   its images parsed" is a falsifiable assertion, and mine have been false twice:
   `actions-on-interfaces` claimed five with four parsed, `ontology-cleanup`
   claimed seven with four. `pnpm check:readings` now fails on it — naming a file
   anywhere counts, so "these three add nothing beyond the prose: a.png, b.png"
   passes. **The bar is that the reading says what it looked at.** And when
   editing a header, never delete the list of what is unparsed; that turns a
   recorded debt into a silent one, which is how the second false claim happened.

8. **A screenshot does not say which product it is of.** The mirror carries more
   than one generation of the same UI, and they disagree on everything. The
   Ontology Manager's old captures (`cleanup-*.png`, an `Overview` row, a card
   column) measure 275px on a 44px row pitch; the one Foundry ships
   (`oma-discover-view.png`, a `Resources` block, `Value types`) measures 252px
   on 33px. Calibrating to the first made our sidebar looser when the real one is
   tighter. **Check the era before measuring, and say in the reading which
   capture a number came from.** Scale is not a guess either: a 1px CSS rule is a
   hairline, so a divider's thickness in device pixels gives the capture's ratio.

**And say who skipped it.** Not "the image nobody had read" — every reading here
has the same author as the code, and the passive voice turns an omission into a
property of the corpus. Write "the image I skipped", in readings and migration
headers alike, because those are read next session as fact. The rule is here on
results, not manners: **re-reading what I claimed to have read has the highest
hit rate of anything in this repository** — a confirmed inference, three unbuilt
Cleanup features and a falsified guard (597), all from images already claimed.

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
weekly and the audits run in CI, but nothing that writes a migration runs
unattended — **applied migrations are immutable and run once**, so an unreviewed
one can only be corrected forward.

**A reading is never built from until a human has read its Decisions block.**
That block is where an invented mechanism has to declare itself, and it makes the
build step non-autonomous by construction.

`pnpm check:readings` makes the citation half mechanical: every quotation is
grepped back against the mirror, a screenshot quote must name the screenshot, and
a header's **coverage claim** is compared against the images the page references.
Read the counts it prints, not just its exit code.

**And a quotation that names its page must be ON that page.** For a long time the
guard proved a sentence was in *some* mirrored page and that a named page
*existed*, never that the two were the same — the failure its own comment calls
the most expensive, half-closed. A real sentence filed under the wrong page sends
the next reader somewhere that does not say it, which is the whole thing citation
is for. It also accepts a course under `docs/foundry-deep-dives/` and checks the
text is in it, because rule 3 says to read those and until recently a reading
could not cite one at all.

### The two artifacts that make this work

**`docs/foundry-reference/MAP.md`** — every mirrored page by section and title,
4,068 of them across 102 sections as of 2026-08-19. A floor plan, not a reading: it answers "does a page about X
exist, and what is it called", which is the question that keeps going wrong.
`staging` appears in no URL but `manage-models/release-model` defines it. Grep
titles here before concluding Foundry lacks something.

**Never hand-edit it** — `node scripts/build-map.mjs` rebuilds it and the mirror
script runs that after every fetch. Hand-maintained, it drifted to half the
corpus, so the artifact whose job is "does a page about X exist" was answering
*no* for pages we had.

**`docs/foundry-reference/readings/`** — our reading of the pages we have
actually read, with a queue in build order. Grep it before designing anything;
an answer already written down beats re-deriving one, and the "connects to" lines
are how a concept met in one part of the platform gets recognised in another.

4,068 mirrored pages against 4,818 known URLs — **16% is not on disk**, and
`api/` is the opposite problem: mirrored whole, and **under-read**. Readings are
fewer still; that is the normal state.

**Refresh the index before trusting any answer about what exists.**
`node scripts/mirror-foundry-docs.mjs --urls` re-derives `all-foundry-urls.txt`
from the sitemap and *unions* it. Frozen for two weeks, the refresh turned up 39
unknown pages — one of which falsified code that had already shipped.

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
apps/web/                120 files. Ontology Manager (/ontology), projects,
                         account, auth, the shell. Vite + React + Blueprint.
packages/ontology/       the ontology model: object types, properties and base
                         types, link cardinality, interfaces, shared properties,
                         object sets and traversal, status, project roles, and
                         the generated per-type interfaces.
packages/platform/       the engine tested against the documentation's own
                         printed answers, as `authenticated`.
packages/services/       IAuthService and the other interface seams, with the
                         AuthSession and UserRole they describe.
supabase/migrations/     597 migrations. 355 is where the ontology was emptied;
                         everything after it is the rebuild.
docs/foundry-reference/  4,068 mirrored pages of 4,818 known URLs. THE SOURCE.
docs/substrate-reference/ 439 mirrored Supabase pages. What we build it WITH —
                         grep it before saying the platform cannot do something.
docs/foundry-deep-dives/ 214 PDFs from learn.palantir.com, nine courses.
```

The core began as eleven tables and the platform now holds ~65. **Ask the
database what exists rather than a table in this file** — that list went stale
here once already, and `information_schema` cannot. The rule is unchanged: every
value in every CHECK traces to a page.

**The ontology holds objects.** This paragraph used to say it could not, long
after it stopped being true. `index_object_type` builds `objects.ot_<uuid>` — a
real table, one typed column per property — from a RUNNING build job, replaying
`object_edits` over each datasource's current view, dropping the deleted and
failing on a value type violation. Objects existing only in the edit log join the
merge.

A *new* type could not start life valid until 590: creation left it with no
datasource, so its own linter refused the save. `generate_backing_dataset` is the
wizard's documented other branch — an empty dataset in a chosen location, because
"permissions of the objects of a type are determined by the location of their
backing datasources".

## Commands

```bash
pnpm install
pnpm dev                         # all apps
pnpm --filter @beacon/web dev
pnpm turbo lint type-check test  # what CI runs
pnpm check:readings              # citations trace, and coverage claims are true
pnpm check:doc-drift             # has a page we built from changed upstream?
pnpm check:surfaces              # every web file is reachable from main.tsx
pnpm check:classes               # every class a component names has a CSS rule
pnpm check:edge                  # supabase/functions parse, and deploy whole
pnpm --filter @beacon/platform test   # the engine against Palantir's published answers
pnpm db <file.sql>               # apply one migration — NEVER MCP apply_migration
pnpm db:status                   # pending / orphaned / MODIFIED-since-applied
pnpm gen:client                  # regenerate the typed client from the platform
```

### How work ships

Nothing here reaches production by being written. **One PR per chunk of work**,
not per idea — the platform suite runs three times per change (local, PR CI, then
`DB migrate` on main), so four PRs for one session's work is forty minutes of CI.
Merge on green; **`Deploy verify` going green on the merge commit is the
definition of done**, because it polls production until it serves that SHA and
"merged but production runs the old bundle" has bitten twice. It is path-gated to
app code, so a docs-only PR correctly never runs it.

Wait on CI with `gh pr checks <n> --watch`, never a fixed sleep. And **never
mutate the database between merging and main's CI finishing** — re-applying a
migration a minute after a merge turned main red while its suite ran against that
same database.

### The guards, and what is gone

`check:surfaces` asks about **real reachability**, walking the import graph from
`main.tsx`. `check:edge` asks it of `supabase/functions`, where the answer is
harsher: the deploy uploads only what `index.ts` statically imports, so an
unimported file ships as an empty module and fails when called, not when
deployed.

**`check:classes` asks the same question of a CSS class.** There is no Tailwind
and no build step, so a Tailwind-shaped name nobody wrote a rule for is an inert
string — it compiles, it does not warn, and it does nothing. The utilities block
says of itself that it was "generated once from the classes this app actually
uses", and *generated once* is the failure: it had drifted by 88 classes across
139 sites, among them `overflow-x-auto` on a wide panel and the object types
list's entire selected state. **A class is not a colour vocabulary either** —
44 of the 88 were Tailwind palette names, and colours come from Blueprint's
palette through our tokens.

**`check:rpcs` is deleted, and how matters.** It regexed `.rpc('name')` out of
source and looked the name up in `pg_proc` — string matching, because the
boundary was untyped. The fix was to remove the boundary: `pnpm gen:client` makes
a typed value per platform entity, so a wrong name fails to *compile*. **A guard
whose job the compiler can do should be deleted, not maintained.**
`check:surfaces` goes the same way once object surfaces are generated.

**The platform suite** (`packages/platform`) is a different kind: it **runs the
algorithm and compares against the answer the documentation prints** —
`data-integration/datasets#example-of-transaction-types` states the view after
each of five transactions, and markings, scoped sessions and the datasource
binding each state their outcome the same way. Nothing in it is structural; the
guarded-table list comes from `pg_class WHERE relrowsecurity`.

**It runs at least one pass as `authenticated`.** Connecting as the DB owner
bypasses RLS, which is how two infinite recursions sat in production while every
guard stayed green. **A policy may not read the table it guards.**

**Ontology content is not its job** — that is `ontology_violations()`, which is
Foundry's own shape ("Ontology owners... write linters that check the entity
definitions", `superrepo/core-concepts.md`). The suite asks one question: is the
ontology we actually have well-formed?

**That linter is not only read by a reader: `save_working_state` refuses a save
that INTRODUCES one** (426, comparing against the set that existed before). An
arm written too wide does not add noise, it blocks the save — 586's third arm
fired on six suites. `ontology_warnings()` is the second list, for findings that
must not block: "errors need to be handled in order to save, warnings will not
prevent you from saving". Choose the list before writing the arm.

**`check:shape` and `check:vocabulary` are deleted**, with `shape_registry`. They
needed an allowlist to tell "deliberately ahead of its runtime" from "dead".
Foundry needs no such table because the platform indexes ontology resources;
here `object_types` is the list of what exists. **Wanting an allowlist is the
signal to index instead.** The RLS contract suite went too, and that one cost:
`auth_org_id()` read a dropped table for a day, and every policy calls it.
Nothing static catches that — the `authenticated` pass does.

## Working the migrations

Each line names the failure it prevents; none of it is general advice.

**Gate BEFORE `pnpm db`, and never through a pipe.** An applied file cannot be
edited — `db.mjs` byte-compares it against the ledger — so a citation typo caught
afterwards becomes another migration. **A pipe's exit status is `tail`'s**, and a
semicolon gates nothing; both let a red gate through. The form that works:

```bash
if pnpm check:readings > /dev/null 2>&1; then pnpm db supabase/migrations/NNN_x.sql; fi
```

**Re-applying an "idempotent" migration can revert a later one.** 587 was
`CREATE OR REPLACE` only, so re-applying looked free; it restored its own version
of a function 588 had replaced and broke six suites. Idempotent *with respect to
itself* is not idempotent with respect to the ordering — check what came after.

**Patch the live definition, never retype it.** `pg_get_functiondef` → edit the
lines that change → apply, and say in the header that nothing else moved.
Retyping `apply_object_type` from memory invented two helpers that do not exist.

**An assertion that never CALLS the thing proves it exists, not that it works.**
592's `DO $$` checked a vocabulary count while the function it added read a column
that does not exist. Ask: if this body were `RAISE`, would my assertions still
pass? If yes they check the catalogue.

**A guard that passes is not evidence — read the count it prints.** `0` and `17
quotation(s) checked` both exit 0. The migration half of `check:readings` never
ran in CI at all (`fetch-depth: 1`, so no `origin/main`) and reported success
every time.

**Do not be stricter than Foundry, and scope any divergence you take.** Where a
page says *warned* or *recommended*, we do not refuse. A recorded divergence
still needs bounding: `guard_function_version`'s refusal was reasoned, and also
fired during initial development, which the page exempts by name. A divergence
nobody scoped grows.

**Before building, ask what already reads it.** The dominant defect here is not a
missing engine but an engine nothing reaches — derived properties, interface
action rules, `auto_upgrade`, media sources, Health issues, the READS column,
`icon_color`. Thirteen and counting. `grep` the web and the platform first.

**Verify "we do not have X" before acting on it, including in this file.** It
claimed the ontology could not hold objects while `index_object_type` was
building per-type tables. A stale "we lack X" invites rebuilding X; four queries
against `information_schema`, `pg_proc` and the non-standard schemas settle it.

**`api/` settles shape questions the prose cannot** — unions with their members,
and the wire encoding of each value. It has falsified our schema four times.
Grep it before inventing a discriminator or a set of kinds. And prefer it to an
icon: the media source was read as (set, *branch*) off a branch-like glyph where
the API says *view*.

## Substrate

TypeScript everywhere, Postgres underneath. **Not Java**: Foundry's core is Spark
and the JVM data stack, both non-goals here, and the one thing that transfers —
cross-boundary type safety — a shared TypeScript package gives us. Two things we
do take from their stack:

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
5. **Where does the rule go?** Down the ladder, stopping at the first rung that
   can hold it:

   **CHECK constraint** → a fact about one row, always true. *(A subquery is not
   allowed in one; the way round is an `IMMUTABLE` function returning the legal
   set, which is what `property_base_types()` is for.)*
   **Unique or partial index** → a fact about a set of rows.
   **Trigger** → a fact needing other tables, or a namespaced error. Remember a
   BEFORE trigger runs *ahead* of the CHECKs, so a test can pass against the
   wrong guard.
   **`ontology_violations()`** → a fact that can go stale without anyone editing
   the ontology, like a column the dataset dropped. Blocks a save that introduces
   it.
   **`ontology_warnings()`** → advisory, where the page says *warned* or
   *recommended* rather than refused.

   Assertions in the migration prove the change at the moment it lands; the
   platform suite proves it still holds. Both, not either.
