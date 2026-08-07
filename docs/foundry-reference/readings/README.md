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

Twenty-two readings against 1,184 pages is the honest starting position. `../MAP.md` is
how the other 1,183 stay findable in the meantime.
