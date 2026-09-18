# The ontology journey, end to end — what is missing to build it Foundry's way

Measured 2026-09-17 by four readers over `ontologies/`, `ontology/`,
`ontology-manager/`, `object-backend/`, `object-indexing/`, `object-link-types/`,
`interfaces/`, `action-types/`, `object-edits/`, `functions/`,
`object-permissioning/`, `object-views/`, `object-explorer/` and `ontology-sdk/`
— **62 journey steps in four stages**, each re-run by an adversary whose only
job was to overturn it.

**Read the ranking before the list.** "Blocks" means a user literally cannot get
from nothing to a working, queryable object type. Everything else is a fidelity
gap, and this document is worth nothing if the two are confused.

---

## The headline: the journey is passable, and it was passable by one thread

**Eleven blockers were claimed. The adversaries demoted ten.**

The proof that the far end works is live, not argued: schema `objects` holds
`ot_47516b65f96547b5bab10a31901b641c` with 8 rows, reached through a
`COMPLETED` build job against a `SUCCEEDED` build. A type was created, bound to
a datasource, indexed, and queried.

**The one blocker that survived review is fixed** (migration 815, #992): an
object-backed link type could not be created by any sequence of UI actions,
because `save_link_type` dropped the two edge ids 765 had made mandatory. No
object-backed link type had ever existed here. The test that should have caught
it declared itself "front door only" and then tested that one kind through a
direct insert.

So the answer to "what blocks the end-to-end journey" is, today: **nothing.**
What follows is the answer to the harder question — what makes it *not Foundry's
way*.

---

## 1. The security layer of the ontology is absent, not partial

The largest single category, and the only one where a whole documented mechanism
has no representation in any layer.

**Corrected 2026-09-19, and the first row was the wrong one to get wrong.** It
said the only row-level path "is bound to no object type". That is false, and I
wrote it without asking the catalogue — the failure `feedback_proving_absence`
exists to prevent. `restricted_view_predicate(p_object_type, p_alias)` takes an
object type, finds its datasource carrying a `restricted_view_id`, compiles that
view's policy through `granular_policy_sql`, and returns an `EXISTS` joined on
the primary key; five readers apply it on every read. It was **wired but
unexercised** — one datasource, none backed by a restricted view, no restricted
views at all — which reads like absence from the data and is not absence in the
code. The practical consequence was the opposite of what the row implied: the
rule language, its compiler and the per-type predicate pattern were all already
there to reuse, so 821 was a smaller build than this table predicted.

| what Foundry has | ours |
|---|---|
| **Object security policies** — the recommended, non-legacy row-level control on an object type | ~~nothing in any layer~~ — **shipped, 821.** `object_security_policies`, one per object type, compiled by `object_security_predicate` and applied through `object_read_predicate` at all 13 reader call sites. Its granular policy reuses 483's grammar, plus the `satisfies` comparison Foundry's own worked example needs. Markings and organizations on the policy are the remaining slots |
| **Property security policies** — column-level, whose documented failure mode is the same row returned with a null in one cell | no representation. `evaluate_object_set` can already drop hidden properties (`to_jsonb(o) - $1`), so the projection half exists and the policy half does not |
| **A marking on an object type** | ~~the CHECK does not admit `object_type`~~ — **shipped, 819/820.** The kind is admissible, `effective_object_type_markings` inherits from the project, and the read policy conjoins `satisfies_markings`, so a marking now actually hides the type |
| **Test the policy before saving, as a named user** | nothing to test, because of the three rows above. Consequent, not separate |
| **The Check access panel for an object type** | `check_access` RAISES on `object_type` |
| **An object type's own visibility applies to its instances** | **OPEN, and the next thing to take.** `indexed_objects`, `evaluate_object_set`, `list_linked_objects` and `search_objects` are all `SECURITY DEFINER` and gate on `auth_in_ontology` alone — verified 2026-09-19 by reading all four definitions. `object_types`' read policy has three terms (`auth_in_ontology AND can_see_placed AND satisfies_markings`), and the two the readers skip are exactly the ones 819 added. So a marking hides an object type from the type list and **not** from anyone who asks for its instances by uuid. Pre-existing, not introduced by 821; the fix is one `object_type_visible(uuid)` used by both the policy and the four readers, so there is a single definition to drift |

Each of these degrades rather than blocks — a user reaches a working object type
without ever opening a security policy. But this is the part of the ontology a
regulated customer buys, and it is the emptiest.

**And one verified inversion underneath it.** `auth_in_ontology(p_ontology)` is:

```sql
SELECT EXISTS (SELECT 1 FROM ontologies o
  JOIN space_organizations so ON so.space_id = o.space_id
 WHERE o.id = p_ontology AND auth_in_org(so.organization_id))
```

Organization membership, and nothing else. **The project role governs reading
the object type's definition and governs nothing on the object DATA path** —
placement in a project does not gate the data. The documented model is
project-scoped (`If you are an Editor in project A, you can edit the Building
object type`). This was scored "parity" by the reader and promoted by the
adversary, correctly: it is the claim most likely to stop someone looking.

## 2. Nothing can be edited after it is created

A theme, not an item. It recurs in every stage and the recovery in each case is
delete-and-recreate.

- **An action type** cannot be edited or deleted after creation — the engine
  supports both and no screen calls either.
- **A link type** cannot be edited at all: a side's API name is whatever
  `toCamel` produced, forever, and the page's own `you can modify it if needed`
  is unreachable.
- **An interface's shape is frozen at creation** — no property added, removed or
  re-required afterwards.
- **An object type's API name** cannot be edited, and since a wrong one is
  permanent this is the expensive half.
- **An implementation** can only be unticked and rebuilt, which destroys and
  recreates the mapping rows rather than editing them.

Foundry treats all of these as ordinary edits. We treat them as immutable
decisions, which makes the first authoring attempt load-bearing in a way the
product does not intend.

## 3. The staging model is bypassed where it should not be

`ontology-manager` is explicit that changes are stored locally until you save.
Three paths write live instead:

- `setObjectTypeStatus` and `deleteObjectType` update `object_types` directly,
  never through `stage_change`.
- `implement_interface` INSERTs straight into `object_type_interfaces`;
  `interfaces/implement-interface.md` ends its Ontology Manager path with
  **§5 Save changes**.
- Migration 725 patched the **applier** and not the **stager**, so some metadata
  edits land by a different route than the rest.

This matters more than it reads: the save session is where the linter refuses,
and a write that skips it skips the refusal.

## 4. Authoring an action is possible; constraining one is not

- **Parameter constraints do not exist** — no column, no screen. Every parameter
  is an unconstrained free-text box, and the canonical guide's second step is
  exactly to constrain one.
- **An object reference parameter's property cannot be read anywhere in the
  product**, which the adversary called the real top finding of that stage: the
  guide builds its submission criterion out of exactly that, and three things
  scored near-parity depend on it.
- **An object reference is typed by primary key**, in a plain input. A user must
  read the key off the Object Explorer and type it. Every `create_link` /
  `delete_link` action needs two.
- **Conditional form behaviour** — the whole point of an override — is honoured
  by the resolver and has no author.
- **Three parameter payload kinds are unmodelled**: attachment upload, media
  upload, and struct parameters, none in our `data_kind` CHECK.
- **`edits_enabled` defaults false** and is a hard gate the journey map missed
  entirely; the guide lists it under Prerequisites.

## 5. The create flow is a card where Foundry's is a wizard

- One flat card instead of the five steps (`Datasource → Metadata → Properties →
  Actions → Save location`), and no top-bar `New` menu.
- **Per-property source at creation** is Foundry's step 3 and ours cannot do it:
  `source='column'` is unavailable until the type exists, which is why a
  multi-property type takes two saves.
- **`Generate action types`** — Foundry's step 4, three pre-checked rows that
  make a new type editable immediately — does not exist, though the engine does.
- **Save location** is a shell-level mode, not the last step of the flow.
- **`generateBackingDataset`** is generated into `@beacon/platform` and **no file
  imports it** — the documented `continue without a datasource` branch has an
  engine and no caller.
- The **save refusal has no recovery surface**: no greyed Save, no Errors tab,
  no open-the-offending-property shortcut. `useObjectTypeProblems` exists and is
  called by nothing.
- **A save with no project raises** from `guard_object_type_placement`, for a
  reason that appears nowhere in the create card.

## 6. Who may do any of this is wrong

Only an organization owner or admin can create an object type. A **project
Editor cannot**, which contradicts the documented model directly. The same
persona gap appears in action types, where view/edit rights reduce to one
org-wide role.

## 7. The diagnosis surfaces are missing

Everything here is "it works, silently":

- **No indexing pipeline graph.** Foundry draws dataset → Changelog → Merge
  changes → Indexing → Object Storage V2 with per-node state, a `90% complete`
  progress bar, `Data: 2 hours ago` / `Schema: Updating…` chips, and a `...`
  menu holding `Copy diagnostic logs` and `Reindex`. We have reindex and a
  state, and none of the diagnosis.
- **A join-table link that returns `Ontology:LinkNotIndexed`** gives the user no
  status to read and no button to press.
- **No test run before release** for an action type.
- **No export or download**, on a decision whose stated premise — *we have no
  export or download path* — is now false. A refusal outliving its reason, the
  779 pattern again.

## 7b. One latent fragility the fix itself exposed

`save_working_state` applies staged changes in **no specified order**. Staging
two edge link types and the object-backed link that references them in one
working state lets the link be inserted before its edges exist, and it dies on
`link_types_source_edge_link_type_id_fkey`.

Found the hard way: the first version of 815's regression test staged all three
together, passed locally, and failed in CI on identical code. The test now saves
the edges first — which is the order a user works in anyway — but **the engine
still has no dependency ordering**, and any staged resource that references
another staged resource of the same kind is exposed to it.

## 8. Smaller, and named so they are not lost

Optional interface properties; shared properties on an interface (a literal step
that cannot be performed); the conformance obligation never re-checked when a
constraint is added or flipped to Required; `interface_properties.description`
written and unreadable; the backing datasource import prompt; per-side link
authoring visible only from the direction you happened to open; the link type
Configuration card blank for every foreign-key link; the OSDK surface being a
stringly-typed call rather than `client(Aircraft).where({…})`.

---

## What this says about sequencing

1. **Security policies** (§1) are the largest coherent missing product, and the
   `auth_in_ontology` inversion belongs with them because it is the same
   subject: what actually gates object data.
2. **Edit-after-create** (§2) is the cheapest large win — the engines mostly
   exist and the screens do not call them, which is this repo's dominant defect
   shape and its most reliably fixable one.
3. **Parameter constraints and object-reference pickers** (§4) are what stand
   between an action type that exists and an action type a non-author can use.
4. **The wizard and the diagnosis surfaces** (§5, §7) are fidelity, and can wait
   behind all three.

Nothing in this document is a blocker. The journey runs end to end today, and
one thread has walked it.
