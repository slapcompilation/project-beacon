---
verify: strict
---

# Reading — the object set DEFINITION, and what a saved object set stores

**Why this reading exists.** Shape audit round 1 (#1030) returned `object_sets`
as the highest-cost wrong encoding in the platform, and as the one that is free
to correct *today*: the table holds zero rows, nothing reads `traversals`, and
nothing reads or writes `subject_interface_id`. Every consumer added by tiers 3,
4 and 6 makes it dearer. This is the reading that has to be approved before any
of it is built.

**It deliberately does not restate `docs/foundry-reference/readings/object-explorer.md`.** That reading
already covers the Explorer surface, the save dialog and the RID grammar. This
one is about the *definition* — the shape the api publishes — which no reading
here has ever quoted.

## Pages read

End to end, this session:

- `api/v2-ontologies-v2-resources-ontology-object-sets-load-object-set.md` (1,446 lines) — **the primary**
- the four sibling endpoints: `create-temporary-object-set`,
  `load-object-set-multiple-object-types`, `load-object-set-objects-or-interfaces`,
  `aggregate-object-set`, and the three-line `ontology-object-set-basics`
- `functions/api-object-sets.md`, `object-explorer/compare-object-sets.md`,
  `object-explorer/pivot-linked.md`, `object-explorer/filter-results.md`
- `object-explorer/save-explorations.md`, `save-lists.md`, `getting-started.md`,
  `overview.md`, `search-objects.md`, `configure.md`, `generate-urls.md`
- `ontologies/oss-limitations.md`, `automate/condition-objects.md`

**Images.** Four were opened in this session, all full-view and none a crop:
`explorations_saved_exploration.png` (1515x646),
`explorations_saved_list.png` (1515x646),
`explorations_explorations_dropdown_all.png` (914x948) and
`explorations_list_dropdown_all.png` (916x830) — the last two have result rows
running off the bottom edge, so nothing is asserted about how many entries they
hold. `pivot_flights.png` was opened for §3. The api pages reference no images.

**Counts in this reading were parsed, not eyeballed.** The member list and the
recursion count below come from a script over the page's own indentation, and
the number it returns is 15 members and 10 recursive. A subagent reading the same
page reported "9 of those members" in its headline while its own breakdown listed
ten; the parse is the authority and the discrepancy is recorded because a count
nobody re-derived is exactly what CLAUDE.md rule 7 is about.

---

## 1. The api's `ObjectSet` is a DEFINITION, and it is a tree

The page says what the thing is, eleven times over, in the same words:

> "Represents the definition of an `ObjectSet` in the `Ontology`."

— `api/v2-ontologies-v2-resources-ontology-object-sets-load-object-set.md`

Not a stored result, not a resource — a **definition**, posted inline as the
body of a request. Fifteen members, of which **ten carry an `objectSet` (or a
list of them) and five do not**:

| | members |
|---|---|
| **leaves (5)** | `base` · `interfaceBase` · `static` · `reference` · `methodInput` |
| **one nested child (7)** | `filter` · `searchAround` · `interfaceLinkSearchAround` · `withProperties` · `nearestNeighbors` · `asType` · `asBaseObjectTypes` |
| **a list of children (3)** | `union` · `intersect` · `subtract` |

`union`, `intersect` and `subtract` take `objectSets · list`, so they are
**n-ary, not binary** — and `subtract`'s list order is load-bearing.

**There is an eleventh recursion site one level deeper**, inside
`withProperties` → `derivedProperties` → `selection`, and a builder encoding only
the fifteen top-level members will miss it.

**The union is byte-identical across all five endpoints** — diffed, 1,279 lines,
zero difference. The endpoints differ only in what they do with the expression.

**Nothing in the union binds a set to one object type.** `base` names one,
`interfaceBase` names an interface, and `union`/`intersect`/`subtract`/
`searchAround`/`asType` compose across types freely. That is why a separate
**Load Object Set Multiple Object Types** endpoint exists at all.

**Two members are flagged experimental by the page itself** — `withProperties`
("This feature is experimental and not yet generally available") and
`methodInput`. Experimental is the newest generation, not an obsolete one, so
both are in scope under *build the latest generation only*; recorded so the next
reader is not surprised when they move.

**`methodInput` carries no fields at all.** That is the `editsOnly` shape from
the datasource union, where 835 learned that a member with no pointer cannot be
encoded by which pointer is set — the same lesson, and it decides §6 below.

## 2. A saved object set is a RESOURCE, and the definition reaches it by `reference`

> "A saved exploration allows you to revisit the same set of search parameters while retaining the applied filters and the configured layout."

— `object-explorer/save-explorations.md`

> "A saved list allows you to revisit a static list of objects; the saved list will not change unless manually updated."

— `object-explorer/save-lists.md`

> "Dynamic object sets are saved as the representation of the filters applied."

— `object-explorer/configure.md`

And the save dialog states the storage contract in the two strings the prose
never quite gives, one under each tile of a single exclusive choice:

> "Save filters as a dynamic exploration that updates with new results"
> — object-explorer/images/explorations_saved_exploration.png


> "Save current results as a static list matching filters at this moment"
> — object-explorer/images/explorations_saved_list.png


**So `exploration | list` is a published storage distinction and ours is right.**
An exploration persists the *definition* and re-evaluates it; a list persists
*materialised membership* and does not. `docs/foundry-reference/readings/object-explorer.md` §10 already
records the two RID forms — `ri.object-set.main.versioned-object-set.<uuid>` for
a saved exploration and `ri.object-set.main.object-set.<uuid>` for an ad-hoc set.

**The bridge between the two worlds is the union's `reference` member**, which
carries a single string. A saved resource is not the union; it is something a
union can point at.

## 3. Object sets are closed under every operation

The result of a filter, a search-around or a set operation is itself an object
set that can be operated on again — which is the same statement as the union
being recursive, said to a person instead of to a program.

**A pivot retypes the set to the far end of the hop**, which is what our own
comment on `object_sets.traversals` claims. `pivot_flights.png` goes further than
the comment: the pre-pivot filters are **not discarded** — they are rewritten as
link-qualified filters through the inverse link on the new main type.

## 4. The limits, and the one we invented

Object Storage v2 publishes **ten** object-set limits, of which only four are
hard caps: 10M objects per Search Around leaf, 30M across all datasets in one
query, 100k for the OSDK's `.all()`, and a size *estimate* that fails a query
early when it exceeds the limit by more than 2x. The other six are reroutes to
Spark rather than refusals.

**The figure 100,000 appears four times on one page meaning four different
things** — the OSv1 Search Around cap, the OSv1 `.all()` cap, the OSv2 in-memory
threshold and the OSv2 OSDK cap. Two of those are OSv1 and out of scope.
Conflating them is the trap.

**There is no published traversal-depth cap anywhere.** Depth is bounded only
indirectly, per hop, by the leaf and cumulative-load caps. Our
`object_set_traversals_valid` refuses more than three hops, and that three is
ours, not Palantir's.

## 5. Three live defects, verified against the live catalog

- **`object_set_keys` reads the wrong key.** It resolves the primary key column
  as `p.api_name` and indexes the emitted row with it, while the engine emits
  rows keyed by `property_id` — `indexBuild.test.ts` shows it, where the property
  is `property_id = 'pk'`, `api_name = 'id'`, and the row comes back as `pk`. The
  lookup yields NULL, the `WHERE k IS NOT NULL` filter drops it, and the function
  returns an empty array **silently**. Its caller is the Automate condition path.
- **`evaluate_object_set_by_rid` ignores `set_kind`.** It passes
  `subject_type_id` and `filters` into the evaluator and never asks which kind
  the set is, so a saved *list* is re-evaluated as a filter rather than served
  from its stored membership.
- **A `list` has nowhere to store its membership.** There is no membership table
  and no column. So `set_kind = 'list'` is a label with no mechanism — the third
  instance of *vocabulary with no engine* this month, after `conflict_resolution`
  (842) and the CBAC tables.

Neither of the first two can fire today, because `object_sets` holds zero rows.

## Connects to

`docs/foundry-reference/readings/object-explorer.md` §10 (the save surface and
the RID grammar), `docs/foundry-reference/readings/object-set-parameters.md` (the action parameter that takes one),
`docs/SHAPE-AUDIT.md` (why this is first), and 835's lesson about a union member
with no fields.

---

## Decisions (mine, not Palantir's, unless quoted)

**Read this block before any of it is built.**

1. **The resource stays; only the definition changes.** `object_sets` is a saved
   resource with a rid, a name, a project and a kind, and every one of those is
   right. This is **not** a rewrite of the table — it is replacing what the
   *definition* half of the row holds. I want to be explicit because the shape
   audit's own phrasing — a flat row where the API publishes a recursive union —
   reads like the whole table is wrong, and it is not.
2. **An exploration's definition becomes the published union, stored as one
   `definition jsonb` validated by a recursive predicate.** Not a table of nodes:
   the union is a tree with no identity of its own, it is never queried by part,
   and it arrives and leaves as one document. *Inference*, and the one I would
   most like attacked — `filters` and `traversals` are already jsonb under
   `object_set_filters_valid`, so this is the same rung of the ladder, not a new
   one.
3. **The flat row lands as its own degenerate case**, `filter(base(subject_type),
   where)`, so all fourteen consumers keep working through the migration. That is
   what makes this additive rather than a rewrite, and it is only possible while
   the table is empty.
4. **`subject_type_id` stays, as a CACHED projection of the definition's result
   type, maintained by a trigger and documented as derived.** Eleven of the
   fourteen consumers read nothing but `id` and `subject_type_id`. The union has
   no such field and a `union` of two base sets has no single answer — so the
   column must become nullable-by-meaning, and the readers that assume it is
   present need the refusal `evaluate_object_set_by_rid` already raises for the
   interface case. *Inference.*
5. **A `list` gets membership storage** — one row per member — because the page
   says a list "will not change unless manually updated" and we currently re-run
   the filters instead. Without it, `set_kind` stays a label with no mechanism.
6. **The evaluator ships partial, and every unimplemented member refuses by
   name.** Round one: the five leaves plus `filter`, `union`, `intersect`,
   `subtract`. `searchAround` and `interfaceLinkSearchAround` next, since the
   traversal grammar already exists. `withProperties`, `nearestNeighbors`,
   `asType`, `asBaseObjectTypes` and `methodInput` raise a namespaced error until
   built. **A shape must be complete; an engine may be partial** — CLAUDE.md.
7. **`methodInput` is represented and never accepted.** It has no fields, so by
   835's lesson it cannot be encoded by which pointer is set; it is a named
   member of the discriminator that always refuses.
8. **The three-hop traversal cap goes.** It is ours, no page states it, and
   CLAUDE.md forbids being stricter than Foundry. If a bound is wanted it should
   be one of the published caps instead.
9. **The three defects in §5 are fixed in the same arc, not after it**, because
   the shape change rewrites two of the three functions anyway.
10. **The Explorer's "configured layout" is NOT part of the definition.** The
    api union has no slot for it and the save page names it as a third thing
    beside the filters. It belongs on the resource row. *Inference.*

## Questions I could not answer from the pages

1. **What `reference` actually references.** It is a bare `reference · string ·
   required` with no description and no stated grammar. It is almost certainly
   an object-set RID — the two forms are published in `generate-urls.md` — but no
   page joins the two, and Decision 1 leans on that join.
2. **Whether a saved exploration stores the union or the Explorer's own
   complex-search JSON.** `configure.md` says "the representation of the filters
   applied", which is not the same words as the api's union, and the Explorer's
   filter grammar is published separately. If they are two encodings of one
   thing, which is canonical for a saved resource?
3. **Whether `asType` and `asBaseObjectTypes` change the result type in a way a
   cached `subject_type_id` can follow.** Decision 4 assumes the projection is
   computable for every union we admit; for these two I am assuming and not
   quoting.
4. **The order semantics of `subtract`'s list.** The page gives a list, not a
   left/right pair, and never says whether it is fold-left or something else.
   `DerivedPropertyDefinition.subtract` on the same page *does* have `left` and
   `right`, which suggests the object-set arm's list order matters — but that is
   an inference from a sibling union.
5. **Whether a list's membership is object RIDs or primary keys.** `static`
   carries `ObjectRid`, and we have no object RIDs — our index is keyed by
   primary key. Decision 5 does not say which, deliberately.
