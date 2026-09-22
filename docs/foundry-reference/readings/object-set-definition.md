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
- **added 2026-09-23, and it should have been first**:
  `object-backend/overview.md` § Object sets — the page that actually publishes
  the object set model, missed on the first pass

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

**The `filter` member's `where` is itself a 27-member recursive union** —
counted by parsing, twice, after a first parse said 26 by starting one line
late. It carries `and`, `or` and `not` beside comparison, text, geo and
temporal operators, and it has no link member: the api expresses a link
constraint as `searchAround`. That is what refutes Decision 3 below.

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

## 4. The limits — and the one I wrongly called ours

Object Storage v2 publishes **ten** object-set limits, of which only four are
hard caps: 10M objects per Search Around leaf, 30M across all datasets in one
query, 100k for the OSDK's `.all()`, and a size *estimate* that fails a query
early when it exceeds the limit by more than 2x. The other six are reroutes to
Spark rather than refusals.

**The figure 100,000 appears four times on one page meaning four different
things** — the OSv1 Search Around cap, the OSv1 `.all()` cap, the OSv2 in-memory
threshold and the OSv2 OSDK cap. Two of those are OSv1 and out of scope.
Conflating them is the trap.

~~**There is no published traversal-depth cap anywhere.** Depth is bounded only
indirectly, per hop, by the leaf and cumulative-load caps. Our
`object_set_traversals_valid` refuses more than three hops, and that three is
ours, not Palantir's.~~

**FALSE — corrected 2026-09-23, see the REVISION below.** The cap is published,
it is three, and it is on `functions/api-object-sets.md`, which this reading's
own header lists as read end to end. Our three is Foundry's three.

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
- ~~**A `list` has nowhere to store its membership.**~~ **FALSE — corrected
  2026-09-23.** `object_set_members (object_set_id, primary_key)` exists and is
  guarded by `guard_object_set_member`. I verified the two defects above against
  the live catalog and did not verify this one. It also answers this reading's
  own Question 5 without my noticing: membership is primary keys.

Neither of the surviving two can fire today, because `object_sets` holds zero rows.

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

---

# REVISION (2026-09-23) — six adversaries against the Decisions block

**Five of the ten Decisions were refuted and three amended.** More seriously,
the attack found **three false claims in the body of this reading**, and two of
them were falsifiable against pages this reading's own header lists as read end
to end. They are corrected in place above; what follows records what was wrong,
because a reading that quietly fixes itself teaches the next reader nothing.

## What I got wrong, and how

1. **The claim that a list has nowhere to store its membership was false.**
   `object_set_members (object_set_id, primary_key)` exists, with
   `guard_object_set_member` on it and both wired. I verified the other two
   defects in §5 against the live catalog and did not verify this one — I
   carried it from a subagent's census, which had missed the table. It also
   silently answered this reading's own Question 5: membership is **primary
   keys**, not object RIDs, and has been all along.
2. **The claim that no traversal-depth cap is published was false**, and
   `functions/api-object-sets.md` is in the Pages-read list:

> "Object sets loaded into memory `.all()` or `.allAsync()` are allowed to have a **maximum of 3 search arounds**. If more than 3 search arounds are used, an error is thrown."

— `functions/api-object-sets.md`

   The same page says it twice, the second time as a runtime rule. Our three-hop
   cap is **Foundry's three**, arrived at correctly and then written up as an
   invention.
3. **The `where` count was 26 and is 27** — my parse began one line after the
   union opened and dropped `lt`. An adversary counting the same block said 28.
   Neither count was re-derived before being stated; this one was.

**And the reading contradicted its own sibling.** It opens *"It deliberately
does not restate `docs/foundry-reference/readings/object-explorer.md`"* and then
took a decision that reading already settles — see Decision 10.

**One page that publishes the model was never read**:
`object-backend/overview.md` § Object sets. It supplies the resource claim this
reading inferred, a second classification axis, and a third RID form.

## The revised Decisions

**1. The resource stays; only the definition changes. STANDS, amended.**
The resource claim is published rather than inferred:

> "Object sets are lists of real-world entities that are saved for future reference and use across Foundry applications that support objects. Object sets are saved as resources for easy sharing with collaborators."

— `object-backend/overview.md`

and the api absence is real: across the mirrored api pages the only `objectSets/`
routes are `createTemporary`, `loadObjects`, `loadObjectsMultipleObjectTypes`,
`loadObjectsOrInterfaces` and `aggregate` — no create, get, list or update of a
saved set. **But the claim that every one of those elements is right was wrong twice.**

- **`set_kind` is one of TWO orthogonal published axes, not one.**

> "Object sets can be described by definition (static or dynamic) and current state in the object backend (temporary or permanent):"

— `object-backend/overview.md`

  Our `exploration | list` encodes the first axis. The second — temporary versus
  permanent, where a temporary set "can only be accessed by the user who created
  them" and carries its own `ri.object-set.main.temporary-object-set.…` form — we
  do not have. Recorded as **unbuilt and out of this arc**, not as absent from
  the docs. This is CLAUDE.md's published-enumeration-rendered-as-fewer failure
  in its exact shape.
- **`project_id NOT NULL` is a declared divergence, not fidelity.** Foundry saves
  an exploration into a home folder or a chosen location, and of action-created
  sets `object-explorer/configure.md` says they are "not exposed in a Project".
  477 already reasoned this, in those words, in `save_object_set`'s own body — so
  the divergence is adopted unchanged, but it should be named as one.

**2. The definition is one `definition jsonb` validated by a recursive
predicate. STANDS — and now by execution rather than argument.** A recursive
`IMMUTABLE` plpgsql validator hung off a `CHECK` accepted `base`, `filter(base)`,
a three-deep union, a four-deep nested union and a **forty-deep** chain, and
refused an unknown member at depth, a malformed child at depth and a two-key
document. So the invariant *every child of a union is itself a valid object set*
sits on the **CHECK rung**, the lowest the ladder offers; a node table would push
it to a trigger, because no per-row foreign key expresses it.
*Amendment:* the recursion means the tree is not queryable by part, so a
question of the form *which object sets reference this link type* needs a jsonb
path query rather than a join. `object_type_dependents` reaches object sets through
`subject_type_id` only, which Decision 4 now keeps.

**3. The flat row lands as `filter(base(t), filters)`. REFUTED.**
The published `where` is a **27-member union that is itself recursive**, carrying
`and`, `or` and `not` alongside comparison, text, geo and temporal operators.
Ours is a flat array of `propertyFilter | linkFilter` under
`object_set_filters_valid`, joined by AND with **no disjunction and no
property-level negation**, in a different vocabulary. Two further breaks: `where`
is `required`, so a row with `filters = '[]'` has **no legal `filter`
encoding** at all; and `where` has no link member, because the api expresses a
link constraint as `searchAround`, so our `linkFilter` has nowhere to land.
*Revised:* the degenerate case is **`base(subject_type)` when `filters` is empty
and a TRANSLATION otherwise, and the translation is not total.** Which way the
translation should run is Question 2 below, now the central open question rather
than a footnote.

**4. `subject_type_id` becomes a cached projection of the RESULT type.
REFUTED as stated.** Today the column means the **root** type: the live
`COMMENT ON COLUMN object_sets.traversals` says the set's members are of the last
hop's type, which is precisely *not* `subject_type_id`. Redefining it as the
result type would silently change the meaning of a column all fourteen consumers
read. And a second published vocabulary bears on it:

> "An **object set** represents an unordered collection of objects of a single type."

— `functions/api-object-sets.md`

*Revised:* **keep `subject_type_id` meaning the root/base type, and say so.** The
result type is a separate derived question, and `object_set_keys`' existing bug
is the proof that conflating the two is already costing us.

**5. A list gets membership storage. MOOT — it already has it.** See above.
Question 5 is closed: primary keys.

**6 and 7. The partial evaluator and `methodInput`. STAND, amended.** The
refusal should use a published error name where the api publishes one, rather
than an invented one. And the `editsOnly` analogy for `methodInput` is weaker
than claimed — `editsOnly` is generally available and `methodInput` is not — so
`methodInput` is represented in the discriminator and always refused, with the
weakness of the analogy recorded rather than leaned on.

**8. The three-hop traversal cap goes. REFUTED.** It is published, it is three,
and it is on a page this reading listed as read. **Keep the cap and cite it** —
`functions/api-object-sets.md`. The same callout confirms the OSv2/OSv1 split
this reading flagged: 10 million instances for OSv2 against 100,000 for v1.

**9. Fix the §5 defects in the same arc. STANDS**, reduced to two: the
`object_set_keys` key mismatch and `evaluate_object_set_by_rid` ignoring
`set_kind`. The third was not a defect.

**10. The configured layout belongs on the resource row. REFUTED.** A **Layout
is its own resource**, per object type, with a name, a description, an initial
perspective, a **Path** in the filesystem, a default scoped *for yourself* or
*for all users*, an admin permission that can rename and delete it, and a
precedence rule where a user's default beats the global one. `explore-charts.md`
calls layouts "shareable views for a specific object type", and the dialog says
so itself:

> "Save the current view configuration (i.e charts, sorts, and table settings) as a layout. Layouts do not save the current filters."
> — object-explorer/images/edit_layout_dialog.png

**This repo already recorded all of
it**, in `docs/foundry-reference/readings/object-explorer.md` §6 — the sibling
this reading said it would not restate and then contradicted. A layout column on
`object_sets` would foreclose per-object-type sharing, the admin permission and
the precedence rule: the half-built foundation, exactly.

## The revised Questions

1. **What `reference` references** — still open, and Decision 1 still leans on it.
2. **Which filter grammar a saved exploration persists** — now the central
   question, promoted from a footnote by Decision 3's refutation. Foundry
   publishes two: the Explorer's complex-search array and the api's 27-member
   `where`. `configure.md` says a dynamic set is "saved as the representation of
   the filters applied" without saying which representation.
3. **Whether the result type is computable for `asType` and `asBaseObjectTypes`**
   without evaluating the set — unchanged, and now scoped to the derived question
   rather than to `subject_type_id`.
4. **The order semantics of `subtract`'s list** — unchanged.
5. **CLOSED**: membership is primary keys, and the table exists.
6. **NEW: the temporary/permanent axis.** Two pages disagree on how long a
   temporary object set lives, so the lifetime is not settled by the corpus even
   though the axis is.
