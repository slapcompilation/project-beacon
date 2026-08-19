# The ontology build map

What to build, in order, from six readings. **Everything here is quoted or
read off a screenshot.** Anything I could not attest is in the open questions at
the end, not in the map.

Readings this consolidates:
- `foundry-reference/readings/deep-dive-ontology.md`
- `foundry-reference/readings/compass-branching-and-views.md`
- `foundry-reference/readings/capabilities-value-types-and-groups.md`
- `foundry-reference/readings/materializations-links-media-and-rids.md`
- `foundry-reference/readings/capabilities-typeclasses-and-branching.md`
- `foundry-reference/readings/create-object-type.md`, `properties-and-keys.md`,
  `spaces-and-the-resource-path.md`, `rid-grammar.md`

## The irreversibility gate

**Almost everything here is cheap to change.** The ontology holds zero object
types and every table is empty, so a wrong CHECK vocabulary, a wrong column, a
wrong trigger message costs one migration. Submission criteria went from a flat
list to a tree in a single file with no data to migrate.

So rigour is not spent uniformly. It is spent here:

| decision | why it is expensive |
|---|---|
| **A stored generated column** — a RID's `<type>` segment | rewrites every row, and external systems hold the string. This is why link types and action types have **no RID column**: the form is unattested, and a missing RID is a gap while a wrong one is a lie in every row. |
| **A table's grain** — what one row means | conflict resolution is per *datasource*, not per object type. Getting that backwards is not an ALTER. |
| **A uniqueness scope** | API names moved from per-organization to per-ontology while empty. Once populated, the same move means resolving collisions in someone's data. |
| **The identity of an object instance** | the primary key *value*, not a synthetic id. Everything downstream keys on it. |
| **The shape of an append-only log** | `object_edits` cannot be rewritten by design, so a column added later has no history to backfill into. |
| **Anything holding a client's data** | once a client dataset is materialised, the shape is theirs, not ours. |

**Only these get a second opinion, and the second opinion is the operator's.**
Everything else ships and gets corrected forward.

The review question is one sentence, not a re-reading: *which sentence is this
design resting on — show me it.* That is what has actually caught things here.

## What already exists

32 tables. The substrate is real and verified: **datasets** (files,
transactions, branches, schemas, materialization), **markings** and scoped
sessions, **spaces** and `space_organizations`, **projects** with role grants,
**object_types** + `object_type_properties` + `object_type_datasources`,
**link_types**, **shared_properties**, **ontology_interfaces**, **object_sets**.

The ontology holds **zero object types**, by design — they come from client
datasets.

---

## Phase A — the container

### A1 · `ontologies`, one per space — **BUILT** (migrations 412–414)

> "value types are associated with a **space** in the platform. **A space can
> hold a single ontology.**" — `value-types-overview`

`ontologies(id, space_id UNIQUE, organization_id, api_name, label, description,
rid)`, then `ontology_id` on `object_types`, `link_types`, `shared_properties`,
`ontology_interfaces`. The RID form is attested:
**`ri.ontology.main.ontology.<id>`** (`ontology-sdk/add-osdk-to-bootstrapped-repository`).

**Built 2026-08-07** as 412 (the table, `ontology_id` on the four resource
tables via a composite FK, API names per-ontology, the `rid_locator` fix), 413
(`default_ontology()` and every write path naming its ontology) and 414 (an
ontology must live in a space its organization actually serves — a hole the
end-to-end verification found).

**Shipped with a correction.** The RID spec
(`github.com/palantir/resource-identifier`) gives the locator as
`[a-zA-Z0-9\-\._]+` — **dots are legal in a locator**. `rid_locator()`
(migration 391) is `split_part(p_rid, '.', 5)`, which truncates such a locator to
its first segment. Every locator we generate is a uuid so nothing is broken
today, but the function is wrong against the grammar it claims to implement: it
must take everything after the fourth separator.

**API-name uniqueness moves from per-org to per-ontology.** That is what the
course's `[OFT]` prefix works around: *"the object types include an OFT prefix to
avoid any naming conflicts with any similar types found in your ontology."*

Carries the Ontology picker (which is a space picker), and the `Ontology:` field
on every object type's Overview.

**A second reason, from release management:** *"**Spaces** are a flexible
primitive… that allow for **environment separation**… Development, Test,
Production, **each represented as a 'space'**."* So one-ontology-per-space is
also what gives each environment its own ontology. Branching works *within* an
environment; promotion *between* them is Marketplace. They are "**complementary
solutions to different problems**", and only the latter offers rollback.

### A2 · `folders` — **BUILT** (497–498)

> "**Filesystem** — Manage **spaces, projects, folders**, and resource roles."
> — `dev-toolchain/overview`

The path in the Compass screenshot is
`/Governance Documentation Namespace-d86595/Documentation Example/Example Notepad`
— space, then nested folders, then the resource. `resource_location()` (397)
already builds a path; it has no folder level to walk.

**Why now:** every resource added after this — groups, action types, value types
— has to live somewhere, and "somewhere" is a Compass path.

---

## Phase B — the object type, completed (B6 excepted, on purpose)

### B1 · The metadata the Overview shows — **BUILT** (415)

From the annotated screenshot, exhaustively: **plural name · aliases[] · point of
contact · contributors · id** (distinct from api_name — `generated-6a437f16-…`
vs `Generated59a386a3…`) **· index_status · edits_enabled ·
track_edit_history**.

`index_status` is **branch-aware** — the field reads `Not indexed on branch`.

### B2 · Link ends — **BUILT** (417)

A link type is **two named ends**, each with its own API name and visibility:

| direction | sentence | API Name |
|---|---|---|
| `Flight Alert → Flight` | "Each Flight Alert has **one** Flight" | `FlightAlert.`**`oftFlight`**`.get()` |
| `Flight → Flight Alert` | "Each Flight has **many** Flight Alerts" | `oftFlight.`**`FlightAlerts2`**`.all()` |

**Built as two columns, not a child table — a deliberate change from this
plan.** The screenshot puts the RID on the *link type* and both sections inside
its own Overview; neither end is separately addressable, so a child table would
imply the end is a resource. It is a direction. `link_types` already carried
`source_api_name`/`target_api_name` half-built; 417 completes the pair with
`source_visibility`/`target_visibility` and derives the accessor via
`link_accessor(link, side)` — `.get()` where that side sees one, `.all()` where
it sees many, **never stored**.

417 also deleted four columns belonging to no page: `backing_hotel_column`,
`backing_time_column` (hospitality) and `edge_type`, `projected` (the old
reality-graph edge model).

Join method is one of two: **Foreign key** or **Dataset**.

**Status is a gate, and both rules are enforceable** (`edit-link-types`): "link
types with an `active` status **cannot be deleted**", and "you **cannot change
the API name** for link types with an `active` status".

**The key-mapping rules are constraints, not advice.** Many-to-many: "the columns
in the backing datasource **must map to the primary keys** of the object types",
and a type mismatch "**will prevent you from saving**". Any other cardinality:
"the key of one of the object types must map to the **Primary key** of that
object type, **ensuring that the 'one' side of the Cardinality is unique**".

Visibility has stated behaviour: `prominent` "will prompt applications to **show
this link type first**"; `hidden` "will **not appear** in user applications".

### B3 · Type groups — **BUILT** (416)

> "Object type groups are a **classification primitive** that help users better
> search and explore their ontology."
>
> "users must have **viewer** permission on **the project that the object type
> group is in**."

`type_groups(id, ontology_id, project_id, name, description, rid, display)` +
`object_type_group_members`. RID form is attested:
**`ri.ontology.main.type-group.<uuid>`**.

Detail panel is **Content · Display · Permissions**; membership is editable from
either end; it is a search and filter facet.

### B4 · Capabilities — **BUILT** (415)

**Capabilities is what type classes became.** `metadata-typeclasses` carries a
column reading *"Configure in **Capabilities** page of object type"*, and:

> "object types now have a **Capabilities** page to configure features
> **historically defined as type classes**. The configuration of **all supported
> type classes will move to the Capabilities page**."

That is why the tab has no page of its own — it is a migration target, and the
predecessor's table enumerates its contents.

**A capability is a panel** (icon · title · one-line description · *Learn more* ·
collapse), and there are **two shapes**:

**Slot-based** — named slots, each a `Choose a property ▾`. Geospatial, verbatim
from the screenshot:

| slot | stated constraint |
|---|---|
| **Altitude** | "Numeric (or numeric time series) property specifying altitude/elevation… in meters" |
| **Radius** | "Numeric property specifying the radius in meters… **must also have a 'Geopoint' property** indicating the center of the circle" |
| **H3 cell** | "**String property, or array of strings**, containing H3 cell IDs" |
| **Track Latitude** / **Track Longitude** | "**Time series property**, representing the Object's Latitude / Longitude" |

`object_type_capabilities(object_type_id, capability, slot, property_id)`, unique
on the first three, with the slot's type constraint validated rather than a
column per capability.

The **Event** slots come from the same table: `event_id` ("globally unique across
all event objects"), `event_start_time`, `event_end_time` ("a time value, e.g. a
`TIMESTAMP`"), `event_description` ("**required** if the event object type will be
used for annotation writeback"), `event_root_object_id`, `event_linked_series_id`
("**String arrays as well as single strings** are supported").

**List-based** — a table with its own columns, not slots. **Time series** is
`Time series properties [n]` with **+ Add property** / **Analyze**, columns
**PROPERTY NAME · TIME SERIES SYNC · BASE FORMATTER**.

**We already have `time_series_properties` (12 columns).** It *is* the
list-shaped capability, built before I knew it was one. What it owes: a **sync**
reference and a **base formatter**, plus the fields the type-class table names —
`timeseries_id` ("the **only** type class that is **required** for your object to
be discoverable in Quiver"), `measure`, `units`, `internal_interpolation`
("how Quiver **infers series values between adjacent data points**"),
`root_object_id`, `is_enum`, `is_deprecated`.

The **media** slot names the media set the references point to.

Setup flow, for the record: *Capabilities (**beneath Observability**) → panel →
Get started → object type property → time series sync → Standard time series
property → Add property*.

### B5 · Interface link type constraints — **BUILT** (450)

> "An **interface link type constraint** defines an object-to-object relationship
> **common across all object types implementing an interface**… concrete link
> types on the object type are used to **fulfill** interface link type
> constraints."

Four parameters: **link target type** (an interface *or* an object type),
**target**, **cardinality** (`ONE` | `MANY`), and whether the link is
**required** for implementation.

Built across **two** migrations, and this line said one until the 2026-08-19 gap
run caught it. **450** builds `interface_link_constraints` with the four
parameters and `interface_action_satisfactions` beside it. The parameter half —
`interface_action_parameter_constraints` and `interface_action_parameter_mappings`
— lands seventeen migrations later in **467**, whose own header calls itself "the
unbuilt half of `interfaces/interface-action-type-constraints.md`, found by the
nightly gap run."

The citations under both tables were sound; only the number here was wrong. It is
worth correcting rather than shrugging at, because **this map is what gets
grepped for "which migration built this"** — a wrong number here is believed.
(This section once read as future work — the 2026-08-13 gap run caught that
missing marker, and the 2026-08-19 run caught this one.)

### B6 · Type classes — **DELIBERATELY NOT BUILT**, and this section said otherwise

`DELIVERABLE-MAP.md` has recorded the decision for some time; this map went on
describing it as pending, which is how someone ends up building it. The reason
is not cost:

> "The configuration of all supported type classes will move to the Capabilities page"

A generic `kind`/`name` bag would be **building the thing Foundry is retiring**.
And `metadata-render-hints` frames the whole feature in **Object Storage v1
(Phonograph)** terms — the backend whose status scalar we already had to undo.

What *is* built is the specific half that has a consumer: the render hints
`searchable`, `sortable` and `selectable` live as columns on
`object_type_properties`, with the published dependency rule enforced as
`hints_need_searchable` and readers in `object_set_where`,
`evaluate_object_set`, `aggregate_object_set` and `search_index_payload`. Seven
of the ten published hints stay unbuilt, each waiting for a surface that would
read it.

**Take hints one at a time, from a consumer that needs one.** Do not build the
bag.

> "Type classes can be applied to **properties, link types, and action types**."

**Not to object types directly** — the legacy group type class went on "the
**primary key property** of an object type", which is how an object-level fact
was expressed through a property. Two user-set fields, **Kind** and **Name**.

Inert application metadata, **with one exception**: "With the exception of the
`analyzer` type class kind, **which affects indexing behavior**…"

`type_classes(resource_kind ∈ property|link_type|action_type, resource_id, kind,
name)`. A **render hints** mechanism sits beside it (`selectable`, `sortable`,
`searchable`) and now owns what `analyzer.not_indexed` used to.

### B7 · Derived properties — **BUILT** (576–577)

> "Derived properties are properties that are calculated at runtime based on values from linked objects. Instead of storing data directly, a derived property pulls information from objects connected through link types, optionally applying aggregations like averaging, counting, or collecting values into lists."

`object_type_properties.source` is a closed `CHECK (source IN ('column',
'user_input'))` (408). Foundry has a **third** kind, and it is not a variant of
either: it stores nothing and is computed per read across a link.

**The gap run found this because it was invisible.** `readings/derived-properties.md`
exists and its Decisions block ends "Not built from this reading yet" — but
neither this map nor `DELIVERABLE-MAP.md` mentioned derived properties at all,
so it was not on any build order. A reading with no map entry is not deferred
work; it is forgotten work, and the difference only shows when something goes
looking.

`object_type_properties.source` gains `linked_objects`, matching the Source type
control's third radio ("Use a property from another object type").
`derived_property_hops` carries the ordered chain, one row per link as the panel
draws it, capped at 3 — **the cap counts links, not object types**, settled from
the step wording ("levels of connections", "Repeat up to 3 levels total") and
from both screenshots drawing two rows for the two-link worked example.

**The two pages describe two surfaces, and only one of them is the ontology.**
`ontology/derived-properties` defines them broadly and lists exactly one place
they are available — the TypeScript OSDK's `withProperties`, a query-time
construct. `object-link-types/derived-properties` is the Ontology Manager
property. So the same-object derivation the broad wording allows belongs to the
SDK surface; what is modelled here is the whole of the half that lives in the
ontology, not a narrowed version of it.

**A derived property names neither a column nor a datasource** — the third arm
of 545's constraint asserts both are absent, because "Derived properties use the
security of all objects involved in the calculation".

Rules land on three rungs and the split is the point: CHECKs for what a property
row says about itself, a trigger for whether a hop reaches where the chain
stands, and `ontology_violations()` for what only a complete chain can answer.
That last one is not laziness — **Foundry authors the chain incrementally**, with
the panel sitting on an empty "Select linked object", so a trigger demanding
completeness would make the documented authoring order impossible.

---

## Phase C — action types — **BUILT** (418)

> "Action types… refer to predefined operations that you can perform on objects
> within your data model. These actions can **create, modify, and delete
> objects**."
>
> "Because we've only defined one action that touches only the Root Cause
> property, **this is the only property that users can edit**."

`action_types(id, ontology_id, api_name, name, description, status, rid)` ·
`action_type_rules(action_type_id, verb ∈ create|modify|delete, object_type_id)`
· `action_type_rule_properties(rule_id, property_id | interface_property_id)` ·
`action_type_parameters(...)` — the Form · submission criteria.

**The declared property set is the edit permission.** That sentence is the whole
design: nothing else may write.

**All twelve rule kinds** `rules.md` lists are now registered — create/modify/
create-or-modify/delete object, create/delete link, the function rule, and
since **569** the five `…of interface` variants, which waited on B5 (450). The
three side-effect rules (notification, webhook, schedule) each name a system we
have no counterpart for, so they are absent rather than stubbed.

The five interface variants are **expressible and constrained, not executable**,
and each note says which thing it waits for: the object kinds need the
parameter Foundry generates ("an 'interface reference' parameter will be
generated, constrained to the selected interface"), the link kinds need the
link instance store `create_link` already waits for.

> "you can use interface action rules only to modify the *interface shared
>  properties*"  — `actions-on-interfaces`

which is the design sentence one level up: an interface rule may only write the
interface's own properties, so the edit applies to every implementing type.
**570** is what makes that enforceable — 569's check joined two columns of
different types and could not run — by giving `action_type_rule_properties` an
`interface_property_id` beside `property_id`, exactly one set per row.

`action_editable_properties(action)` makes the design sentence answerable: every
property an action can write, and nothing else can.

~~No RID column — an action type's form is unattested, same call as B2.~~
RID added in 488 (Q1 answered): existence attested by action-log's
`Action type RID` field, token inferred and marked.

---

## Phase D — branches and proposals — **BUILT** (419–420)

This **replaces** the edit-session/version pair in my first map. That was
invented from `save-changes` alone; branching is the real mechanism, and
protection *forces* it.

### D1 · Branches — **BUILT** (419)

> "You can **only branch from the main ontology**, also known as `main` branch."

`ontology_branches(id, ontology_id, name, title, description, created_by,
status)` — `main` always exists.

**How a branch stores a change is settled:** *"For true conflicts — **where the
same property of the same resource was edited on both `main` and your branch**"*
— so state is **per-resource, per-field**, not a whole-resource copy, which could
not tell a conflicting edit from a neighbouring one. Confirmed from the other
side: *"Removing a resource from a branch **returns its state to the version of
the resource on the `main` branch**."* A resource is either on the branch with
its changed fields, or not on it and therefore main's.

**And an asymmetry:** *"creating or deleting Foundry resources on a branch **will
affect `main`**. **This does not apply to ontology resources**: you can create,
modify, or delete entities on the branch without affecting `main`."*

**Lifecycle — four states, and Merged is terminal.** Active (self-loop on
activity) → Merged / Archived ("archiving is always **manual**") / Inactive
(after a configurable idle period; "ontology resources are **de-indexed**…
Builds… will **immediately fail**"). Inactive returns to Active by "manually
activate **or action on branch or action on proposal**", and can merge or archive
directly. Archived restores to Active. Defaults: **35 days** to inactive, **7
more** to data deletion, set per-space. Recovery needs "a **no-op change**… to
trigger re-indexing".

**Rebase:** take main's changes; conflicts resolve **per resource** with three
choices — *Use Main branch changes* · *Keep current branch changes* · a **custom
change** that dissolves the conflict.

### D2 · Proposals — **BUILT** (420)

> "**Each ontology resource is considered an individual task.**"
>
> "adding a reviewer to one ontology resource effectively **adds that reviewer
> across all ontology resources**."
>
> "Users with approval rights **can approve proposals even if not added as
> reviewers**. Use the reviewers list to **track** who should review, not to
> **restrict** approvals."

`ontology_proposals(branch_id, name, description, status)` ·
`proposal_tasks(proposal_id, resource_kind, resource_id, approval_status)` ·
`proposal_reviewers(proposal_id, user_id)` — **at the proposal, not the task**,
which is what the quote above requires.

**Merge checks are a separate column from approval.** The screenshot shows a row
that is `Auto-approved` and still carries a red ✕.

**Proposal states: Open · Merged · Closed.** And the rule that shapes the schema:
*"A **single rejection from any user**… will cause the resource's changes to be
`Rejected`. This will **prevent the entire proposal from merging**."*

Merging offers three build options — **all affected / modified only / none** —
and *"You **cannot currently revert a partially-failed merge**."*

### D3 · Protection — **BUILT** (419–420)

**Branch roles are not resource permissions**, and the separation is worth
copying: *"Branch roles control access to **branch management actions only** and
**do not grant permissions to edit resources** on the branch."* `Owner` (≥1, the
creator by default) manages metadata, roles, organizations, archive/restore and a
**Do not merge** setting.

And merge rights are deliberately **wider** than edit rights: *"**Any user who can
view a proposal can merge it**… The person who merges may be submitting changes
to resources that **they cannot edit themselves. This is by design**… merging only
applies **pre-authored and approved** changes."*

Approval policies are set at the **project** level and satisfied either
"**Automatically**, when the contributor's own permissions cover the policy" or
"**Through review**".

Exactly five resource types are protectable — **object, action, link, interface,
shared property** — and explicitly **not** type groups, **not** rule sets ("the
protection status of the containing object type will be enforced"). Protection
forces `Create and save to branch`.

---

## Phase E — object storage

### E0 · The picker, so any of A–D can be reached — **BUILT** (424–425)

Four phases of schema had no surface at all: `grep -rn "ontolog" apps/web/src`
matched nothing, so creating an object type raised `Ontology:NoOntology` with no
way to answer it. `features/ontologies/` is the answer — the drop-down "**to
select between different Ontologies (if more than one is available)**", showing
the display name over the folder path as the screenshot does, and creating the
first one when there is none.

Two bugs the surface only had because it wrote in two steps, both found by
running its own sequence as `authenticated`:

| what the surface did | what happens |
|---|---|
| `insert into spaces … returning id` | **refused** — Postgres folds the SELECT policy into a RETURNING clause, and that policy reads through `space_organizations`, which cannot exist yet |
| `insert into space_organizations (space_id)` | **refused** — the WITH CHECK compares `organization_id` to `auth_org_id()`, and a missing column is NULL |

`create_space(name, description)` does both writes and generates the id itself,
so nothing is read back through a policy that is not yet true. Same answer 409
gave for an object type and its properties. **Fifth time this shape has appeared**
(395, 403, 412, 414, 424) and the first four were all found the same way — the
owner connection bypasses RLS and shows none of it.

### E0b · The save session — **BUILT** (426–429)

The layer between an edit and the ontology, which we had never had: every
surface wrote straight through.

> "Any changes you make in the Ontology Manager are stored **locally in a
> work-in-progress state**. For these Ontology changes to be available for
> others and reflected in user-facing applications, **you must save your
> changes**."

Shaped like `branch_resource_changes` because it is that thing one level down —
419 overlays a branch on main, this overlays a **user on a branch**. The base is
captured on first touch and never re-read, which is what lets a save auto-merge:

> "Workshop **auto-merges changes that do not overlap**. A change is only flagged
> as a merge conflict when the **same** widget, variable, section, or layout
> position was edited on both `main` and your branch."

| migration | what it added |
|---|---|
| 426 | `working_state_changes`, `stage_change`, `working_state_conflicts`, `discard_working_state`, `save_working_state`, `ontologies.version` |
| 427 | `save_object_type` stages · `apply_object_type` writes · properties and datasources travel inside the entry |
| 428 | an absent section means unchanged — a one-field edit had been deleting every property |
| 429 | `update_working_state`: re-base, resolve per entity, `latest` or `mine` |

**Where it is deliberately narrower than Foundry.** Saving onto a branch raises
`BranchSaveNotImplemented` rather than pretending. Rebase-time's third option —
"navigate directly to that resource and apply **custom changes**" — has no
button, though editing the resource by hand already does it. Conflicts on
properties are entity-level, not per property, which asks too often and never
loses an edit.

### E1 · Instances, and edits beside them — **BUILT** (422)

> "**Each row** of data in the backing datasource will produce **one object**…
> **Each column typically maps to a property**."
>
> "By using actions, it is possible for users to **create additional objects that
> do not exist in the backing datasource**… over time, **the mapping from rows to
> objects may not always exist for all rows**."

An instance table per object type, plus the edit store. And the resolution rule,
which is the whole model in three sentences:

> "**Resolution happens on a property-by-property basis.** Properties that have
> not received user edits will continue to use latest pipeline data. **Regardless
> of resolution, all values are still written.** Edit-only properties without a
> backing column always use the latest user edit."

Both values stored; one chosen per property.

### E2 · The index — **BUILT** (442)

> "**Only once this indexing pipeline completes successfully** will you be able
> to see your new objects."
>
> "If Foundry encounters any issues — **such as non-unique primary keys** —
> you'll be able to get to detailed job details and error messages."

An object type is **not live when saved — it is live when its index is built**.
And **indexing is a modification**: it belongs inside a branch (Phase D), shows
as `Indexed 5 days ago` on a proposal task, and needs approval to merge when the
resource is protected.

### E3 · Materializations — **BUILT** (453, 515–516)

> "materializations of indexed data from the Ontology that contains the **latest
> state of each object by combining data from both input datasources and user
> edits**."

The loop closes: dataset → object type → **materialized dataset**. Gated on
`edits_enabled` — "Navigate to the **Materializations** tab by **toggling the
Edits configuration**", which is why that rail entry was greyed out in the deep
dive screenshot.

- **Multiple** materializations per object type, each able to cover **a subset of
  the properties**.
- Propagation is **automatic** ("latency of a few minutes") or **periodic**
  ("whenever the input datasources have new data or **every 6 hours**").
- **The schema comes from the ontology**: "the **API Name** metadata of each
  property is used as the schema of the materialized dataset."
- Retention is fixed: "**only the latest snapshot is guaranteed**".
- Reserved metadata columns are `__`-prefixed (`__is_deleted`, `__patch_offset`).
- **Not creatable or editable on a branch**, though branch changes do write
  through.

### E4 · Value types — **BUILT** (452, 575)

> "**semantic wrappers around a field type** that include metadata and
> constraints."
>
> "If you apply a value type to an object property that contains property values
> that **fail validation, that object type will fail to index**."

**They belong here because their bite is at index time.** `value_types(id,
space_id, api_name, name, description, base_type, constraint jsonb, version)`,
attachable to a property or a shared property.

Constraint vocabulary, each with its stated valid base types: **Enum** (String,
Boolean, Decimal, Double, Float, Integer, Short; String optionally
case-insensitive) · **Range** (numerics, Date, Timestamp, String→length,
Array→size) · **Regex**, **RID**, **UUID** (String) · **Uniqueness**, **Nested**
(Array) · **Element constraints** (Struct).

---

## Phase F — semantic search, cleanup, dependents

### F1 · Semantic search

> "AI models transform the text into vectors… called '**embeddings**'… Finding
> related entities… is simply **finding the nearest vectors** in N-dimensional
> space."

A `vector` property (already one of our 22 base types) plus nearest-neighbour.
**pgvector is already installed.** Two documented paths — a Palantir-provided
model or a custom one.

### F2 · Cleanup — **BUILT** (578)

Three verbs — **Snooze** (per-user), **Deprecate** (with a deadline, "shown as
deprecated in every context that displays object type status"), **Delete**
("remove associated data from object storage") — and six **computable flags**:
past deprecation date · trashed datasource · datasource not updated in *[x]*
days · description missing · display name matches a regex (default
`[test|deprecated]`) · deindexed. Flags are per-user configurable with a priority
order, and "deprecation and deletion are **staged the same way as normal Ontology
modifications**".

**That framing was half right and the half that was wrong mattered.** It is not
`ontology_violations()` grown a severity — it is a second list, because Foundry
keeps them separate: `cleanup-filters.png` shows `Health issues 1,939` and
`Cleanup 5,633` as distinct sections with distinct counts. A blank description
is not a violation.

And "every one of those flags is a query we can already write" was wrong twice
over. There are **seven** flags, not six — the seventh, `No registered usage in
30 days`, appears only in a screenshot and is the strongest signal in the tool.
Two of the seven cannot be computed here at all: `phonograph_deindexed` because
the page applies it only to Object Storage v1 and says there is no v2
equivalent, and `no_registered_usage` because it needs the Ontology metrics
ledger `ontology-manager/view-usage` defines. Both are registered and refused
with their own reason rather than quietly absent.

Priority is `high|medium|low` (only a screenshot says so), configuration is
per-user as (mode, overrides) rather than a row per flag, snooze is the one new
state, and the queue is **stored** — Foundry prompts to recalculate rather than
recomputing silently. Deprecate and Delete already existed; staging is Phase D's
Review edits modal, unchanged.

### F3 · Dependents

> Section 5 of the object type Overview: dependent **kinds** with counts —
> Workshop 9, Function 2, Graph Template 1, Quiver Dashboard 1, Use cases 1,
> Automation 0, Developer Console App 0, Map Layer 0 — **including the zeroes**.

This is the index CLAUDE.md keeps invoking: *"the platform indexes ontology
resources, so 'what uses this' is a query against the resource graph."* We have
no equivalent, and it is what makes `check:surfaces` deletable.

**Last, deliberately** — it is a query over everything above, so it can only be
built once there is something to index.

---

## Order, and why

```
A1 ontologies ─┬─ A2 folders
               │
               ├─ B1 metadata · B2 link ends · B3 groups · B4 capabilities
               │
               ├─ C action types ──┐
               │                   │
               ├─ D branches + proposals
               │                   │
               └───────────────────┴─ E storage + index + value types
                                              │
                                              └─ F dependents
```

A is the container; nothing else has a home without it. B completes what an
object type *is*, and each item is independent of the others. C must precede E
because an action is what writes an edit. D can start any time after A but is
most useful once B and C give it resources worth branching. E needs C. F needs
everything.

---

## Also in scope

These were "deferred" in the first map. They are not — they are just later, and
each has a stated dependency that puts it there.

**G1 · Object Views.** Standard views "**automatically reflect an object type's
configuration**… available for all object types **without any configuration**",
and "remain accessible **even after** a configured Object View is built". Two
form factors, **Full** and **Panel** ("intended for integration with other
applications"). We already generate ours from a registry — that is the standard
half. The configured half is a Workshop artefact and lands once there is
Workshop-equivalent authoring.

**G2 · Functions.** An ontology resource (8,944 in one screenshot), in the
sidebar, and an action's alternative to rules — "you can instead back your action
**with a function**". But "Modifications to the function can only be made within
the **Functions Code Repository**", which we have no counterpart for.
**`@beacon/platform` is the nearest thing we have** — 44 functions already
exposed as typed values. The gap is *authoring*, not calling, so this waits on a
decision about where function code lives.

**G2b · Ontology Scenarios.** Found by the first nightly foundry-gap run — the
one genuinely new item relative to this map. A scenario forks **data**, where a
branch forks **schema**:

> "a sandbox to apply edits on top of the data in your Ontology, generated by
> applying one or more actions… auto-rebased every 10 minutes… default lifespan
> of 30 days." — `ontology/overview-ontology-scenario.md`

Depends on E1's edit store (a scenario is a scoped set of object edits) and on
actions (C surfaces), so it lands after both. Not building yet; recorded so it
is not re-derived.

**G3 · Compass, the rest of it.** `folders` is A2 because the path needs it. The
others are independent and each is small: **Portfolios** ("groupings of projects…
into a use case or area of interest"), **Tags** (namespace-qualified —
`[Governance] Example Category: Example Tag`), **Trash** ("available for recovery
or permanent deletion"), **References** (file and external — "resources that
**flow into** the project"), **Pinned**, **Promoted items**. F2 already depends
on one: its "**Trashed datasource**" flag is a Compass query.

---

# QA findings (2026-08-08)

A sweep across the whole build, checked against the pages.

**Clean:** no table with policies but RLS off, none with RLS on and no policy,
none granted to `authenticated` without RLS, no `SECURITY DEFINER` function
missing `SET search_path`, no policy negating a membership check (the failure
mode `object-security-policies` warns about), no unvalidated foreign keys, and
all three audits at zero.

**Fixed:** `TRUNCATE` was granted to `anon` and `authenticated` on all 49 public
tables by Supabase's default ACL, and **TRUNCATE is not subject to RLS** — see
423. `grant_violations()` now watches it continuously.

**Fixed:** the property vocabulary existed twice — SQL and TypeScript — with
nothing checking they agreed. `vocabulary.test.ts` now asserts both against the
published table type by type, rather than against each other.

**Verified against `properties-overview#supported-property-types`:** all 22 base
types, and both eligibility rules, match the page exactly in both
implementations.

**Both fixed since** (the 2026-08-13 gap run caught this section lagging):

- ~~An array property does not declare its element type.~~ Fixed in 448:
  `array_element_type` with three CHECKs (`array_declares_element`,
  `array_element_allowed` excluding vector and time series, `array_not_nested`).
- ~~61 foreign keys have no index on the referencing column.~~ Retired in 464;
  the security phase then accrued twelve new unindexed FKs, retired again in
  487. The standing floor lives in `packages/platform/src/catalog.test.ts`
  (both checks, every CI run) — a migration asserts only at its own landing.

# Open questions

## Recorded divergences (deliberate, from the first gap run)

- **Project roles are a closed set of four.** `projects-and-roles.md` matches our
  vocabulary and ranking exactly, then adds: "These defaults can be customized
  to include completely new roles." Ours is a hard CHECK with no extension
  point — narrower than documented, kept until a real need appears, because
  every policy branching on `project_role()` must be re-audited the day a fifth
  role exists.
- **A branch may not be named `main`.** No page reserves the literal; ours does,
  to avoid colliding with the implicit default 419 chose. Declared invention.
- **Object Monitors** are `[Sunset]` in Foundry's own docs — a non-goal, not a
  gap.

## Blocking — I would ask before building that phase

**Q1 · RID forms for five resource kinds — ANSWERED (488, 2026-08-13).** The
operator supplied eight pages; they attest *existence* for every remaining
kind verbatim — link-type-metadata and interface-metadata ("An automatically
generated unique identifier for every resource"), action-log ("Action type
RID"), struct-shared-properties (struct fields keep RIDs across promotion),
value-type-constraints (rid-ness is a constraint kind). A full-corpus sweep
(1,800+ pages) prints no form for the four that were still missing, so the
type token follows the thrice-used inference (`object-set`, `type-group`,
`interface`): `ri.ontology.main.<kebab-kind>.<uuid>`, marked in each column
comment. Interfaces already had theirs; 488 adds link-type, shared-property,
action-type and value-type. Nothing external references RID values yet, so a
wrong token is a cheap generated-column re-add — the rename-across-every-row
risk begins only when RIDs are exported.

## Non-blocking — a sensible default exists

- **Shared ontologies — DECIDED and BUILT (441).** The operator chose
  inherit-from-space. `organization_id` is gone from `ontologies` and every
  resource table; organizations resolve through `space_organizations`, exactly
  as `orgs-and-spaces` puts it: "that restriction will apply to the projects in
  the space **as well as the associated ontology**". Listed organizations
  collaborate (read AND write, roles apply); guests read; outsiders see
  nothing. `object_sets` gained its missing `ontology_id`. Ontology API names
  are now enrollment-unique (inference, recorded in 441's header).

**Q4 · Object type `ID` vs `API name`.** Both exist and differ
(`generated-6a437f16-8843-4b82-8…` vs `Generated59a386a3ddbf…`). No page read
states the relationship, or which one a link resolves against.

**Q5 · Ontology configuration** — the bottom-left settings entry.
`type-groups` references it for legacy group migration; nothing describes it in
full.

**Q6 · Where function code lives** — G2's dependency, and a product decision
rather than a documentation gap.

## Closed by the last two rounds

- ~~The canonical Capabilities list~~ → **B4.** Capabilities is what type classes
  became; `metadata-typeclasses` enumerates it, and
  `geospatial-time-series-ontology` shows the page rendered — including a
  **second panel shape** I had not modelled.
- ~~How a branch stores a working change~~ → **D1.** Per-resource, **per-field**:
  conflicts are "the same **property** of the same resource… edited on both".

## Closed earlier

- ~~Capabilities is undocumented~~ → it is, through five consumers (B4).
- ~~Materializations~~ → E3, fully specified.
- ~~Semantic search~~ → F1; a `vector` property and nearest-neighbour.
- ~~Health issues / Cleanup~~ → F2, six computable flags.
- ~~Value type constraints~~ → E4, the full vocabulary by base type.
- ~~The Ontology's own RID~~ → `ri.ontology.main.ontology.<id>`.
- ~~Interfaces owe the O2 treatment~~ → B5, and they constrain **links** too.
