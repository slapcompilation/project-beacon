# Readings

The mirror holds Palantir's text. This holds **our reading of it** — and it is
the thing that survives a context boundary, so it is written for a future reader
who has none of today's conversation.

One file per topic, named for the topic rather than the page, because a reading
usually spans an overview, a concept page and a worked example.

## Template

```
# Reading — <topic>

Pages read in full: <list>
Images read: <list, or "none — check they mirrored">

## What the pages say
Quotes, paragraph by paragraph. Quote the sentence you will rely on.

## What the images add, that the prose does not
Often the most valuable section. A screenshot carries UI shape prose omits.

## Connects to
Other mirrored pages, AND our own code. This is how a concept met here gets
recognised somewhere else later.

## Decisions taken from this reading
With the date, and who agreed.

## Open questions
What the page did not answer. Say so rather than inferring.
```

Rules, from `CLAUDE.md`:

- **Quote versus inference is always marked.** A citation invented after the fact
  is how `object_type_impact` came back.
- **An unanswered question stays a question.** The operator has the
  learn.palantir.com courses and can settle it.

## The queue

Ordered to match the build order in `../../DELIVERABLE-MAP.md`, because a reading
is worth most just before the thing it describes gets built. Nothing here is
"read the whole corpus" — 1,184 pages is a reference, not a syllabus.

**Before the first object type**

1. `ontology/core-concepts` + `ontology/_index` — the frame everything else sits in
2. `object-link-types/create-object-type`, `base-types`, `edit-object-type`,
   `edit-properties` — including **primary key**, which does not exist here at all
3. `ontology-manager/overview`, `navigation`, `save-changes` — the authoring surface
   we already have a page for
4. `ontology/ontology-anti-patterns` + `ontology-best-practices` — read BEFORE
   designing, not after

**Then, in build order**

5. `object-link-types/create-link-type`, `edit-link-types` — backings and cardinality
6. `action-types/` — the action type, which we deleted rather than kept
7. `object-explorer/` — the surface that proves the three above are real
8. `security/` + `platform-security-management/` — the layer with a live gap

**Standing interest, not queued**

- `interfaces/` (9) and `object-link-types/create-shared-property` — both already
  half-built here
- `compass/` (10) — projects and roles exist; the rest is demand-gated
- `architecture-center/` (7) — how the pieces are meant to fit

## Written so far

- `slate-styles.md` — Slate's three stylesheet scopes, Blueprint as the substrate,
  static-CSS rules. Decided: Blueprint stays on citation, no Tailwind, tiers wait
  for a widget layer.
- `create-object-type.md` — **rewritten 2026-08-07 from the whole page.** Both keys
  are **checkboxes on a property**, not fields on the type. The completeness
  contract (5 type fields + 6 property fields) is the tightest spec on the page.
  A property's source may be `User input / actions` rather than a column. Plus
  **mandatory control properties** — implemented as restricted views, securing
  every other property in the same datasource, which is what MDOs are *for*.
- `object-permissioning.md` — **dynamic security is object and property security
  policies**: row, column and cell-level, evaluated per instance, decoupled from
  the datasource. Ontology permissions live in Compass projects.
- `virtual-tables-and-dynamic-security.md` — a virtual table is connection +
  locator, and an object type can be backed by one straight from Ontology Manager.
  Rubix is NOT dynamic security; that question is still open and
  `object-permissioning/` (8 pages) is unmirrored.
- `ontology-core-concepts.md` — the dataset analogy (object type = dataset, row =
  object, column = property, join = link type), semantic vs kinetic elements, and
  the airline diagram showing two link types over the same pair of object types.
- `datasets-rid-and-object-storage.md` — what a dataset is (files + transactions +
  a schema per view), the four transaction types, the 15 field types, RID grammar,
  the six backend services, and OSv2's enforced data restrictions. Answers all four
  open questions from `create-object-type.md`.
- `rid-grammar.md` — which resources actually have a RID, and in what form. The
  instance segment can be **empty**; a **project is a folder** at the RID level;
  organizations carry a Marking ID *and* a Resource ID. Link types and shared
  properties have no attested form and stay without one. **Four of six answers
  came from screenshots, three appear in no sentence anywhere.**

- `spaces-and-the-resource-path.md` — a space is the **first element of every
  resource path**, and its `Path` field (`/Test Space-5adf6d`) is greyed because a
  rename must not move everything inside it. Space roles are **workflow bundles**,
  not a rank ladder like project roles. Spaces are an *enrollment* concern, above
  organizations.

- `projects-roles-and-portfolios.md` — a project's access requirements are a
  conjunction the UI spells out (**Roles AND Organizations·Any of AND
  Markings·All of**); `Default role` is a standing grant to the **organization**,
  not the creator; project constraints limit which markings *may be applied*, not
  which you must hold; portfolios are curation, not security. Answers the
  project-organization subset question, and assesses the missing space RID.

- `markings.md` — the mandatory control. **A data marking is what a file marking
  becomes when it crosses a data dependency** — same marking, different route,
  different requirement bucket. The panel splits into **File access** (roles, orgs,
  file markings → gates metadata) and **Data access** (data markings → gates rows),
  so the failure mode is "metadata yes, data no", not "denied". File markings are
  buildable now; only data markings block on lineage.

- `control-panel-and-banners.md` — settings are grouped by **scope** (user /
  platform / enrollment / organization / space), not by feature; a settings page
  is title + subtitle + tabs + one-toggle-per-card. **Three banners share one
  slot above everything, including the sidebar** — CBAC beats static, and the
  scoped-session workspace banner is a *control*, not text.

- `data-lineage.md` — **object types are nodes in the same graph as datasets**,
  and link types are its edges. Marking simulation gives a four-state output
  contract and a direct-only removal constraint. The Access panel confirms
  migration 401's File/Data split verbatim, from a second independent page.

- `properties-and-keys.md` — a property is a **column**, a property value a
  **field**. Primary-key eligibility is **three-valued**: only `String`, `Integer`,
  `Short` are unreservedly valid, with a **Discouraged** tier that carries its own
  reasons. `Marking` is a property base type — row-level marking security, at the
  object layer. Indexing is what turns a datasource into queryable objects, joined
  on the primary key.

- `osdk-and-ontology-as-code.md` — application code **never names storage**:
  `client(Restaurant).where({…})`, object type as a generated value. Foundry
  supports the ontology living in **code** *or* in the **platform with the types
  imported** — ours is the second, which `gen:client` now does for real.
  `Marking` is unsupported in the TypeScript SDK, so markings stay server-side.
  **O2/O3 are the generated client's input, not its alternative.**
- `ontology-linting.md` — where a rule about the ontology belongs, in strict
  order: constraint, then partial index, then trigger, then `ontology_violations()`
  for what reads two tables or drifts later. Foundry names the pattern
  ("Ontology owners... write linters that check the entity definitions").
  Records why the engine assertions **cannot** move into their migrations —
  applied migrations are immutable and run once — and the `dataset_current_schema`
  tie-break bug the first lint assertion found.

- `tests-audits-and-checks.md` — three mechanisms were all called "checks": a
  **test** builds a fixture and proves the code, an **audit** builds nothing and
  reads the system you have, a **reference check** is a type error found late.
  `check:datasets` held all three. Records the split (`@beacon/platform`,
  `rls_violations()`), and the four traps found doing it — a silently skipped
  audit, a turbo-cached skip, a role reset that leaked privilege, and an audit
  that never proved it could report.

- `the-generated-client.md` — the OSDK page in full plus three images. The SDK's
  three sections (object types / action types / functions) and the fact that its
  contents are **curated and saved**, not projected. Built the functions+actions
  half: 47 typed entities derived from EXECUTE-granted-to-`authenticated`, which
  **deleted `check:rpcs`** — a wrong name is now a compile error. Object types
  wait for one to exist.

- `deep-dive-ontology.md` — the learn.palantir.com course read to the word with
  every screenshot parsed field by field. **The Ontology is a resource you select
  between** and we have no table for it; an object type BELONGS to one. Also: a
  link type has **two separately-named ends**, an action's declared property set
  IS the edit permission, saving is a **session** with errors-block/warnings-don't,
  and an object type is live only when its **index** finishes. Carries the S1–S7
  implementation map.

- `compass-branching-and-views.md` — Compass is the filesystem (**Space → Project
  → Folder → Resource**, and the UI calls a Space a *Namespace*); Global Branching
  **replaces** the edit-session/version pair I had invented — branch from `main`,
  rebase per resource, and a proposal where **each resource is a task with its own
  approval**; Object Views are standard (derived) or configured (Workshop), in Full
  and Panel form factors. Carries the complete Ontology Manager resource list,
  which is **bigger than we knew**: Groups, Value types and Functions are ontology
  resources too. **Capabilities remains unanswered** — the suggested page is a
  generative-AI stub.

- `capabilities-value-types-and-groups.md` — **an Ontology belongs to a SPACE,
  one per space** (found in a value-types aside, and it settles where the
  container lives). **Capabilities** is where an object type nominates which of
  its properties fulfil a platform capability — assembled from five consumers
  because the tab has no page of its own. **Value types** are semantic wrappers
  with constraints that run at INDEX time; **type groups** are a classification
  primitive living in a project. Plus the object type Overview's seven sections,
  of which **Dependents** is the resource index we have no equivalent of.

- `materializations-links-media-and-rids.md` — a **materialization** writes the
  ontology back out as a dataset (schema from **property API names**, gated on
  edits, not creatable on a branch); link-type **status gates deletion and API
  name changes** and the key-mapping rules are real constraints; **interfaces
  constrain LINKS too**, not only properties; cleanup has six **computable
  flags**; and the RID spec from `palantir/resource-identifier` — which found a
  latent defect in our own `rid_locator()`, since **dots are legal in a locator**.

- `capabilities-typeclasses-and-branching.md` — **Capabilities is what type
  classes became** ("all supported type classes will move to the Capabilities
  page"), so its predecessor's table enumerates it; and it has **two panel
  shapes** — slot-based (Geospatial) and list-based (Time series, which is our
  existing `time_series_properties`). Branch state is **per-resource, per-field**
  — a conflict is "the same **property** of the same resource edited on both".
  Four branch states with Merged terminal; one rejection blocks a whole proposal;
  branch roles are **not** resource permissions. And spaces are the
  **environment-separation** primitive, so one-ontology-per-space also gives
  dev/test/prod their own.

- `object-edits-and-security.md` — answers three of the four phase-E questions.
  An instance is identified by its **primary key value**; instances live as an
  **ephemeral index over a durable merged dataset** (datasource ⊕ edit log),
  which is machinery we mostly have; and object state is a **replay of an
  instruction log** with a fifteen-row published answer key, exactly like the
  dataset transaction example. Conflict resolution is **per datasource**, not per
  object type — a correction to the map. Plus object/property security policies,
  which **decouple object access from datasource access** (the course describes
  the legacy model), and the `NOT`-condition warning that applies to our scoped
  sessions too.

- `ontology-manager-save-session.md` — the whole `ontology-manager/` section (10
  pages, all 56 images) plus the branching pages. **The working state is a second
  layer above the branch, confirmed three ways** — `Save to new branch` builds a
  branch *out of* an existing working state, and a rebase loads a branch's saved
  changes back *into* it. An entry is a **resource**; the diff inside it is
  **per field**, struck-through-old beside green-new, nested three deep. The
  conflict *decision* is per **entity** (`Use latest` / `Keep my changes`) while
  the *display* is per field — three granularities across three surfaces, and
  419's per-field merge is finer than anything documented. Errors block the save
  and warnings do not, but **no page enumerates the errors**: two exist only as
  pixels, twelve coded names are scattered across other pages. A restore writes
  into the working state rather than committing. Export/import operate on the
  working state, not the saved ontology. Seven corpus contradictions logged,
  every one being prose that fell behind its own screenshots — including
  `_index`/`overview` being the same file.

- `home-and-navigation.md` — **there are two chromes and they nest**: a dark platform
  sidebar down the left (always, suppressible only by `embedded=true`) plus each
  application's own light top bar and sidebar. The platform landing page is
  *configuration* — `/narrative` by default, or a Slate dashboard or Carbon workspace,
  with per-group overrides — and **not one word of the only screenshot of it appears
  in any mirrored sentence**, so §2.2 is read entirely off pixels. Foundry's primary
  button is **green, not blue**; blue is links and selection; the sidebar carries no
  blue at all. Favourites group headers are unstable across eight labels in six
  sources, so the invariant (uppercase header · `View all` · items, hidden when
  empty) is what is buildable. Extends `ontology-manager-save-session.md` §10.8 with a
  fourth sidebar capture, the `Value types` placement and the **ontology switcher**
  above it; confirms §10.9 independently. **`MAP.md` is stale — 19 of 55 mirrored
  sections are missing from it, including the three this reading needed most**, and
  grepping it for `home`/`landing`/`orientation` returns nothing.

- `interfaces-phase.md` — **the whole `interfaces/` section, all 32 images**, as the
  spec that replaces our two-table stub. An interface is the one ontology type with
  **no datasource**. Local and shared properties are **two separate lists**, and
  required/optional lives on the interface property, not the implementation. The
  implementation mapping is **five options, not one** — the prose says "map an
  existing property" while the screenshot's menu also offers *choose backing
  column*, *create edit-only property*, *replace existing* and *skip*. Extensions
  are n:m and transitive; link and action type constraints each have a full field
  list only the modals give. `searchable` caps implementers at **50, versus 1,000
  when off**. Interfaces have **no visibility field** — ours is undocumented and
  should go — and **four statuses, not five** (`promoted` is object-types-only, said
  outright). Nine contradictions logged, including `_index` = `overview` again, and
  a whole `Interface action control` card that appears in **no sentence in the
  corpus**.

- `value-types.md` — the six value-type pages as the **E4 spec**, and the whole public
  documentation is under 100 lines of prose against five screenshots, four of which
  carry a field no sentence names. A value type is **space-scoped, not ontology-scoped**
  (and the Default ontology has none because it *has no space*); its base type is
  immutable from save; **a version is minted by a constraint change and nothing else**,
  while name/description/apiName mutate freely. **The ontology never pins** — non-breaking
  versions auto-propagate to every use — but **code repositories do**, and two versions
  of one value type cannot coexist in a repo. Eight constraint kinds, two of which
  (**Nested**, **Element constraints**) make the value type graph **self-referential**.
  `use-value-type.md` lists three binders; the corpus attests **seven**. Enforcement is
  **index-time** in the ontology (the whole object type fails) and **null-on-cast** in
  Builder — action-submission enforcement is *not* attested, and `mandatory-control-properties.md`
  proves Palantir writes that clause when it applies. Image-only: a **Failure validation
  message** field, a per-value-type **Usage tab**, `Length` as the UI name for Range on a
  String, and case-sensitive-by-default enums.

- `object-explorer.md` — **the whole 17-page section plus all 90 images**
  (re-mirrored; the old mirror had stripped every one), as the spec for the
  surface that proves object types, links and actions are real. The app is
  internally **hubble**; everything operates on the **object set**; an
  Exploration is a **dynamic** object set and a List a **static** one — and
  `generate-urls.md` attests both as `ri.object-set.main.*` RIDs. Charts are
  per-property aggregations, one per **prominent** property by default; hidden
  types and properties never appear anywhere in OE. Layouts are filesystem
  resources with a `Path` but no attested RID; search stands on five Lucene
  analyzers behind **Searchable/Sortable render hints**
  (`metadata-render-hints.md`, mirrored, unread). Verified against the live
  left-nav: 17 of 17.

- `render-hints.md` — the one-page prerequisite `object-explorer.md` named. Ten
  per-property hints; **Searchable is the parent of five** (Selectable, Sortable,
  Low cardinality, leading wildcards, regex); six add a second raw index and
  require a reindex; the image shows the pane sits between TYPE CLASSES and
  PROPERTY VISIBILITY, and that availability is base-type-dependent (Long text
  greyed for a date).

- `security-phase.md` — 13 core pages + the deep-dive course, 22 images closely,
  25 ops/enterprise pages consciously deferred. The mandatory/discretionary
  model is BUILT already; the three gaps are **groups** (the missing grant
  target), **granular policies + restricted views** (one grammar — eight
  comparisons, documented weights, compiled to a query — stored as a resource
  that can back an object type), and the **Check access** panel. Image finds:
  a FIFTH simulation legend state (`Unknown`), Row-level policies as its own
  settings section, the three-permission marking model confirmed. CBAC
  deferred whole; the two deprecated settings never to be built.

- `enrollments-and-organizations.md` — the four enrollment/organization pages
  + six screenshots, read because two security-phase follow-ups point here.
  The load-bearing find: **an organization IS a marking** ("The default
  Organization markings for new Projects and groups…"; the Guest membership
  card manages who can view files "marked with this organization"), with
  primary membership (exactly one) and guests (users or groups). Decisions:
  no enrollment table (the deployment IS the enrollment), a backing marking
  per org in a system category (ours), organization_guests as a principal
  pair, `organization_marking_ids` binding to primary+guest org markings;
  guest reach into RLS org-gates is deliberately a later slice.

- `builds-and-schedules.md` — the pipeline layer, read because it is the
  largest structural absence left (dataset_inputs declares, nothing
  computes). The three nouns: a Build computes datasets, jobs carry the
  work through seven documented states, JobSpecs pair declared InputSpecs
  with logic; schedules run builds on triggers (five-field cron time
  triggers + four event types + arbitrary AND/OR nesting), with
  Succeeded/Ignored/Failed history and pause-resets-observation. Decisions:
  SQL logic with Postgres standing in for Spark (442's precedent),
  InputSpecs ARE dataset_inputs, staleness = inputs' transactions + JobSpec
  version, two slices (B1 engine, B2 schedules).

- `compass-folders.md` — the filesystem: folders organize and never gate
  (Foundry deprecated the one setting that made them a boundary), markings
  flow through the folder chain, move-out takes Owner, trash restores in
  place, and the catalog layer (tags/collections/Promoted) sits above.
  Decisions: placement is a column beside project_id, trash is a timestamp,
  two slices (C1 tree, C2 catalog).

- `functions.md` — typed, versioned server logic on the Ontology: queries
  are the read-only subset ('cannot have any side effects'), edit functions
  RETURN edits that only a function-backed action applies, semver with six
  published breaking-change checks, and execution reads with the END USER's
  permissions. Foundry's own TSv2 consumption syntax is our generated
  client's shape already. Decisions (REVISED on the operator's correction —
  build it the way Foundry builds it): the logic is TypeScript in an
  isolated Deno worker with no ambient permissions, reaching the ontology
  only through the injected generated client, which the host mediates with
  the CALLER's JWT; declared ontology imports are the sandbox; queries
  first, then edit batches; semver with the six checks refusing rather than
  warning; no RID until attested.

Thirty-six readings against 1,809 mirrored pages is the honest running position. `../MAP.md` is
how the rest stay findable in the meantime — with the caveat that 19 sections
are missing from it (see `home-and-navigation.md` §7.8).

## `verify: strict` — which readings are checked, and when the rest will be

`pnpm check:readings` traces every quotation back to the mirror. A reading opts
in with `verify: strict` in its frontmatter. **33 of 40 are opted in and pass;
986 quotations trace.**

The seven that remain are **not a backlog to grind**. Each one belongs to a
phase that has to reopen the same pages anyway, and **re-reading a page is
exactly what fixes a citation** — so the sweep is free when it rides along with
the build, and duplicated effort when it does not.

| reading | fragments | swept when |
|---|---|---|
| `control-panel-and-banners` | 12 | **DELIVERABLE-MAP §4** — cross-organization principal visibility, which already says it "needs its own reading" of `manage-groups`, `manage-roles` and the Organization permissions surface. That is this reading's subject. |
| `capabilities-value-types-and-groups` | 8 | §4 for the groups half; the **value types** phase for the other. |
| `projects-roles-and-portfolios` | 13 | **portfolios**, the unbuilt half of Compass — C1/C2 shipped folders and the catalog, and a portfolio is neither. |
| `materializations-links-media-and-rids` | 9 | the **media and attachment property types**, listed under "Property base types beyond the 22". Materializations themselves shipped in 515/516; the media half is what remains. |
| `capabilities-typeclasses-and-branching` | 9 | **typeclasses and render hints** — `metadata-typeclasses` and `metadata-render-hints` are mirrored and unbuilt. |
| ~~`data-lineage`~~ | ~~13~~ | **SWEPT 2026-08-18.** The allocation was wrong about its own trigger: the surface was already built (engine, canvas, simulation, `lineage.test.ts`), so the sweep had no phase left to wait for. All 13 traced, `verify: strict` on. |
| `deep-dive-ontology` | 43 | **never** — see below. |

**Two readings had no phase to attach to and were swept immediately**
(`spaces-and-the-resource-path`, `statuses-and-coupling`): spaces, RIDs and the
status cascades are built and settled, so no future re-read would ever have
caught them. That is the test for whether allocation makes sense — if nothing
will reopen the page, the sweep has to happen on its own.

**`deep-dive-ontology` cannot be checked at all**, and that is not a defect: it
quotes the learn.palantir.com course PDFs under `docs/foundry-deep-dives/source/`,
which the guard cannot read. The markdown capture beside them is explicitly
"their own words, **condensed**", so it is not a verbatim source either. It
stays unchecked, on purpose.

## What the sweep found, so the next one knows what to look for

Roughly 250 fragments were repaired across fifteen readings. **None was an
invented citation.** They fell into five families:

1. **A quotation ending in a full stop where the source continues** — a real
   elision, unmarked. The commonest by far, and the only one safe to fix by
   rule (the text traces the moment the period becomes `…`).
2. **A page's list quoted as a sentence**, or renumbered, or merged.
3. **UI text from a screenshot written as prose quotation.** Either attribute it
   with `— section/images/file.png`, or drop the quote marks and describe it.
4. **The reading's own words in quotation marks** — its corrections, the
   operator's questions, and our own rules from CLAUDE.md.
5. **Structure the checker reads differently than a human does**: consecutive
   blockquote lines join into ONE quotation, so quote marks between bullets land
   inside the text; an inline quote that wraps across two lines is invisible
   (it matches per line); and a `— page.md` attribution inside a blockquote
   becomes part of the quote, because that form is understood only for images.

**Three fidelity errors were worth the whole exercise**: `rid-grammar` had
silently corrected a typo in the source, `create-object-type` had quoted the
API-name rule as "between 1 and 100 characters" where the page says
"characters **long**", and `markings` cited two diagrams that **were never
mirrored** — a claim nobody could have checked.

## The same check, where a citation becomes schema

`check:readings` guarded `readings/` only — and **the founding failure it exists
to prevent did not happen in a reading.** `object_type_impact` was built into the
schema on a quote that did not exist. Migrations carry ~1,150 quotations in their
headers and not one had ever been checked.

**It now checks the migrations a pull request ADDS**, and only those. Applied
migrations are immutable and run once, so a citation in one can be corrected
forward but never edited: failing on 540 files would be failing on a backlog
nobody can fix, and that guard gets switched off within a week. Checking what is
being added stops it getting worse, which is the half actually available.

**The audit of what is already applied: 365 of 1,142 quotations do not trace,
across 201 migrations.** Read that number carefully — it is not 365 invented
citations. Sampling it, and reading every one in the migrations from the session
that measured it, the families are the same five as the readings plus one new:

- **our own rules and error tokens in quotation marks** — "compose predicates,
  never restate" is CLAUDE.md, not Foundry, and `Phonograph2:…` is ours;
- **API field descriptions carrying the page's own list decoration**
  (`version · string — …`), which the page prints as a bulleted definition;
- and **angle-bracket placeholders**: `<major>.<minor>.<patch>` is eaten by the
  HTML-tag strip on both sides, and survives only when both sides are mangled
  identically.

The three that matter are indistinguishable from the harmless ones without
opening the page, which is the argument for the gate rather than the sweep: the
next one gets caught while it is still editable.
