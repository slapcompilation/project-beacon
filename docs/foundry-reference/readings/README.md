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
- `virtual-tables-and-dynamic-security.md` — a virtual table is connection +
  locator, and an object type can be backed by one straight from Ontology Manager.
  Rubix is NOT dynamic security; that question is still open and
  `object-permissioning/` (8 pages) is unmirrored.
- `ontology-core-concepts.md` — the dataset analogy (object type = dataset, row =
  object, column = property, join = link type), semantic vs kinetic elements, and
  the airline diagram showing two link types over the same pair of object types.

One reading against 1,184 pages is the honest starting position. `../MAP.md` is
how the other 1,183 stay findable in the meantime.
