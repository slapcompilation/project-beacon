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

### A2 · `folders`

> "**Filesystem** — Manage **spaces, projects, folders**, and resource roles."
> — `dev-toolchain/overview`

The path in the Compass screenshot is
`/Governance Documentation Namespace-d86595/Documentation Example/Example Notepad`
— space, then nested folders, then the resource. `resource_location()` (397)
already builds a path; it has no folder level to walk.

**Why now:** every resource added after this — groups, action types, value types
— has to live somewhere, and "somewhere" is a Compass path.

---

## Phase B — the object type, completed

### B1 · The metadata the Overview shows

From the annotated screenshot, exhaustively: **plural name · aliases[] · point of
contact · contributors · id** (distinct from api_name — `generated-6a437f16-…`
vs `Generated59a386a3…`) **· index_status · edits_enabled ·
track_edit_history**.

`index_status` is **branch-aware** — the field reads `Not indexed on branch`.

### B2 · Link ends

A link type is **two named ends**, each with its own API name and visibility:

| direction | sentence | API Name |
|---|---|---|
| `Flight Alert → Flight` | "Each Flight Alert has **one** Flight" | `FlightAlert.`**`oftFlight`**`.get()` |
| `Flight → Flight Alert` | "Each Flight has **many** Flight Alerts" | `oftFlight.`**`FlightAlerts2`**`.all()` |

`link_type_ends(link_type_id, side, api_name, visibility)`; the `.get()`/`.all()`
suffix is **derived from cardinality, never stored**. Replaces the single
`api_name` on `link_types`.

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

### B3 · Type groups

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

### B4 · Capabilities

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

### B5 · Interface link type constraints

> "An **interface link type constraint** defines an object-to-object relationship
> **common across all object types implementing an interface**… concrete link
> types on the object type are used to **fulfill** interface link type
> constraints."

Four parameters: **link target type** (an interface *or* an object type),
**target**, **cardinality** (`ONE` | `MANY`), and whether the link is
**required** for implementation.

Our interfaces constrain only properties. This is the other half, and it is why
`ontology_interfaces.properties jsonb` needs the same treatment O2 gave object
types — a constraint table, with links beside properties.

### B6 · Type classes

> "Type classes can be applied to **properties, link types, and action types**."

**Not to object types directly** — the legacy group type class went on "the
**primary key property** of an object type", which is how an object-level fact
was expressed through a property. Two user-set fields, **Kind** and **Name**.

Inert application metadata, **with one exception**: "With the exception of the
`analyzer` type class kind, **which affects indexing behavior**…"

`type_classes(resource_kind ∈ property|link_type|action_type, resource_id, kind,
name)`. A **render hints** mechanism sits beside it (`selectable`, `sortable`,
`searchable`) and now owns what `analyzer.not_indexed` used to.

---

## Phase C — action types

> "Action types… refer to predefined operations that you can perform on objects
> within your data model. These actions can **create, modify, and delete
> objects**."
>
> "Because we've only defined one action that touches only the Root Cause
> property, **this is the only property that users can edit**."

`action_types(id, ontology_id, api_name, name, description, status, rid)` ·
`action_type_rules(action_type_id, verb ∈ create|modify|delete, object_type_id)`
· `action_type_rule_properties(rule_id, property_id)` ·
`action_type_parameters(...)` — the Form · submission criteria.

**The declared property set is the edit permission.** That sentence is the whole
design: nothing else may write.

Rules can also "send a Foundry notification… invoke a webhook… or create and
delete other objects", or the action can be "backed **with a function**". Build
`modify` first; the rest are the same table.

---

## Phase D — branches and proposals

This **replaces** the edit-session/version pair in my first map. That was
invented from `save-changes` alone; branching is the real mechanism, and
protection *forces* it.

### D1 · Branches

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

### D2 · Proposals

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

### D3 · Protection

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

### E1 · Instances, and edits beside them

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

### E2 · The index

> "**Only once this indexing pipeline completes successfully** will you be able
> to see your new objects."
>
> "If Foundry encounters any issues — **such as non-unique primary keys** —
> you'll be able to get to detailed job details and error messages."

An object type is **not live when saved — it is live when its index is built**.
And **indexing is a modification**: it belongs inside a branch (Phase D), shows
as `Indexed 5 days ago` on a proposal task, and needs approval to merge when the
resource is protected.

### E3 · Materializations

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

### E4 · Value types

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

### F2 · Cleanup

Three verbs — **Snooze** (per-user), **Deprecate** (with a deadline, "shown as
deprecated in every context that displays object type status"), **Delete**
("remove associated data from object storage") — and six **computable flags**:
past deprecation date · trashed datasource · datasource not updated in *[x]*
days · description missing · display name matches a regex (default
`[test|deprecated]`) · deindexed. Flags are per-user configurable with a priority
order, and "deprecation and deletion are **staged the same way as normal Ontology
modifications**".

Every one of those flags is a query we can already write. This is
`ontology_violations()` grown a second severity: *not wrong, but probably dead*.

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

**G3 · Compass, the rest of it.** `folders` is A2 because the path needs it. The
others are independent and each is small: **Portfolios** ("groupings of projects…
into a use case or area of interest"), **Tags** (namespace-qualified —
`[Governance] Example Category: Example Tag`), **Trash** ("available for recovery
or permanent deletion"), **References** (file and external — "resources that
**flow into** the project"), **Pinned**, **Promoted items**. F2 already depends
on one: its "**Trashed datasource**" flag is a Compass query.

---

# Open questions

## Blocking — I would ask before building that phase

**Q1 · RID forms for five resource kinds.** Attested: ontology
(`ri.ontology.main.ontology.<id>`), object type, type group, folder, dataset,
transaction, media set/item/view, object set, source, scenario. **Unattested:
link type, shared property, action type, interface, value type.** The RID *spec*
is now known exactly (`palantir/resource-identifier`), so the only unknown is the
`<type>` segment's spelling. *Weakly blocking — a RID that has to be renamed
later is a stored generated column across every row.*

## Non-blocking — a sensible default exists

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
