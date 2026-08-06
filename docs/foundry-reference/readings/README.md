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
- `create-object-type.md` — the creation sequence, the three primary-key warnings,
  base types including arrays, and an Overview page carrying ID/API/RID, status,
  visibility, **index status** and **edits**.
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

Twelve readings against 1,184 pages is the honest starting position. `../MAP.md` is
how the other 1,183 stay findable in the meantime.
