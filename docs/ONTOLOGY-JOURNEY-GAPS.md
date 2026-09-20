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
| **Property security policies** — column-level, whose documented failure mode is the same row returned with a null in one cell | ~~no representation~~ — **shipped, 826/827.** `property_security_policies` plus a membership table whose `UNIQUE (object_type_id, property_id)` is the documented one-policy-per-property rule; `property_policy_nulls` compiles a per-row `CASE` into the projection of all three readers. **Three denial shapes now coexist and do not share a code path**: the object policy withholds the ROW, `visibility='hidden'` removes the KEY, a failed property policy keeps the key and nulls the VALUE. 827 also closed a measured leak — `indexed_objects` emitted bare `to_jsonb(o)` while both siblings stripped hidden, so a hidden property was served by that reader alone. ~~Still open on both policy kinds: the markings and organizations slots~~ — **the Markings slot shipped, 829/830.** Both kinds now inherit their datasources' markings as a delta (stops keyed per source, adds keyed per policy), with the two denial shapes preserved: the object policy's markings yield NO ROWS, a property policy's null the covered cells. 830 also fixed a refusal whose reason had expired — `property_policy_nulls` skipped any markings-only policy, which is exactly the worked example's step 7 |
| **The Organizations slot of a security policy** | **NOT BUILT — and my stated reason was false.** Corrected 2026-09-20 by the post-build reconciliation. I wrote that no capture of its sub-view exists and that the only published organization removal is per pipeline input. Both are wrong. Step 3 of `object-security-policies.md` says "You have the option to add a granular policy and **edit the organization and markings**", and the Configure mandatory controls section enumerates organizations among the three kinds its two operations range over. The evidence I used was two **crops** — 2004×600 and 1998×602 against the same dialog at 2002×1392 — which simply end above the row I was claiming was absent. There is also an Organizations sub-view capture in the corpus (`pipeline-builder/images/markings-organizations.png`) and four captures of the slot with an affordance, one of them inside `object-permissioning/images/` itself. **Blocked on something real**: the two permissions that gate the operations, `Apply organization` and `Expand access`, do not exist anywhere in this platform. Also measured: an inherited organization marking does not currently reach a policy's baseline at all, because nothing mints one into `resource_markings` |
| ~~The Organizations slot, as first recorded~~ | **superseded by the row above.** Both Markings slots refuse organization markings, per the api's named error `OrganizationMarkingNotSupported` — "Adding an organization marking as a regular marking is not supported. Use the organization endpoints on a project resource instead." An inherited organization marking still reaches a policy's baseline and is still enforced (828 made the category disjunctive); it simply cannot be stopped or added through the Markings slot. The only published organization removal is per **pipeline input**, not on a policy — and removing one inherited organization removes them all, with the listed set routing approvals rather than selecting what is removed. `osp-permissions-ui-overview.png` shows an `Organizations` card with its own `Manage ›` on the policy side, so the slot exists; no capture of its sub-screen is in the mirror |
| **A marking on an object type** | ~~the CHECK does not admit `object_type`~~ — **shipped, 819/820.** The kind is admissible, `effective_object_type_markings` inherits from the project, and the read policy conjoins `satisfies_markings`, so a marking now actually hides the type |
| **Test the policy before saving, as a named user** | nothing to test, because of the three rows above. Consequent, not separate |
| **The Check access panel for an object type** | `check_access` RAISES on `object_type` |
| **A marking on an object type applies to its instances** | ~~the four instance readers gate on `auth_in_ontology` alone~~ — **shipped, 823-825.** `object_type_instances_readable` now gates `indexed_objects`, `evaluate_object_set`, `list_linked_objects` (both ends) and `search_objects`, so a marking hides the instances as well as the type |
| **Placement applies to instances too** | **OPEN, and deliberately.** 823 briefly enforced the full rule — ontology, placement and markings — on the instance readers, and 825 narrowed it back to ontology and markings. `can_see_placed` is `project_role(p) IS NOT NULL` and `project_role` has no org-admin arm, so *any* caller without an explicit grant was refused, including the automation recipient reader, which holds no grant and whose contract is that an unindexed type is not an error. 21 tests across 4 suites said so. Closing this needs an answer for system callers first — either a grant for them or a separate trusted path — and that is a bigger decision than a marking check |

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


### Post-build reconciliation, 2026-09-20

The first one of this arc. CLAUDE.md's rule is *adversary before building, re-read the
source pages whole after*; across 821–832 I did the first half and skipped the second,
updating the readings from what I already believed — which can only confirm it. The
operator asked whether I reconcile after each build, and whether the documentation
answers the questions I had called open. It does, more often than I said.

**Corrected, not merely noted.** Two claims I had written into an applied migration and
rendered to the user were false (the Organizations row above), and one was a live leak:
`search_objects` returned and matched on a title value a property policy hides — fixed
in **832**.

**Filed as unpublished, actually only unbuilt** — the distinction I had been blurring:

| item | what the docs already decide |
|---|---|
| nested-group authoring | the capture shows `+ Add a condition or a logical operator`; 483 stores one nesting level; both guards walk it |
| the Test security policies modal | the whole section plus two captures — including that it tests the **unsaved** policy, which constrains the seam |
| `check_access` on an object type | settled three ways: the panel works on "a Project, folder, or file", an object type **is** a file, and `ontology-in-project.png` shows it as a peer row of a dataset |
| the MDO baseline for a property policy | a **third** identity claim on `pipeline-builder/outputs-add-ontology-output.md`, naming *mandatory control* by name. 830 chose correctly; recording it as undecided was the error |

**Unbuilt and previously unrecorded**, found by reading the pages whole rather than
chasing a known question: materialization permissions (a mandatory-control leak), the
migrate-from-restricted-views tool and its five named unsupported configurations,
per-datasource `Viewer` nulling (a **fourth** denial shape), streams as a datasource
kind — the API enumerates twelve, our CHECK has four — branching compatibility for
policies, classifications in the mandatory-control slot, `Viewer` on the backing
datasource when no policy exists, and download permissions.

**`Viewer` on the backing datasource — shipped, 833.** The refusal arm, which was the
larger half. Four readers now ask `object_type_data_readable`, and a caller who can read
**none** of a type's datasources is refused under the api's own name,
`Ontology:ViewObjectPermissionDenied`, rather than the `ObjectTypeNotFound` we already
had — the api classifies it PERMISSION_DENIED, and the page keeps the object type itself
visible while its data is not. The deciding word is the error's own `any`: one readable
datasource is enough, so refusing is the zero case and not the partial one. A configured
object or property policy lifts it, per the exemption sentence. Three things the build
measured rather than assumed: our `Viewer` is (same organization) AND markings AND the
scoped session, with **no** project role in it, so the only thing that actually denies is
a marking on the datasource; the dataset arm takes `can_read_dataset_data`, not
`can_read_dataset`, because the page says *the dataset and its transactions*; and the
restricted-view arm is decided by a two-item enumeration where **v1 does not require
seeing the view and v2 does**, which overturned the bare existence check I first wrote.
Latent on today's data — `resource_markings` is empty — so the proof mints its own
marking and unwinds it in a subtransaction, markings being undeletable by design.
**Still unbuilt: the per-datasource nulling**, which is the same rule's other half and
needs a multi-datasource object type; the platform has one type with one datasource.

**Two eras again.** `osp-testing-entry-point.png` shows a newer Security policies
section — a table with a `Test policies` button — than the card list we built from.
Whichever era we follow should be named in the surface.

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
