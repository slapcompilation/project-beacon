# The ontology build map

What to build, in order, from four readings. **Everything here is quoted or
read off a screenshot.** Anything I could not attest is in the open questions at
the end, not in the map.

Readings this consolidates:
- `foundry-reference/readings/deep-dive-ontology.md`
- `foundry-reference/readings/compass-branching-and-views.md`
- `foundry-reference/readings/capabilities-value-types-and-groups.md`
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

### A1 · `ontologies`, one per space

> "value types are associated with a **space** in the platform. **A space can
> hold a single ontology.**" — `value-types-overview`

`ontologies(id, space_id UNIQUE, organization_id, api_name, label, description,
rid)`, then `ontology_id` on `object_types`, `link_types`, `shared_properties`,
`ontology_interfaces`.

**API-name uniqueness moves from per-org to per-ontology.** That is what the
course's `[OFT]` prefix works around: *"the object types include an OFT prefix to
avoid any naming conflicts with any similar types found in your ontology."*

Carries the Ontology picker (which is a space picker), and the `Ontology:` field
on every object type's Overview.

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

An object type **nominates** which of its properties fulfil a platform
capability. The shape is `(object_type, capability, slot, property)`.

`object_type_capabilities(object_type_id, capability, slot, property_id)` with a
unique key on the first three.

Attested slots:

| capability | slot | constraint stated |
|---|---|---|
| geospatial | `radius` | "any **numeric** property measured in meters" |
| geospatial | `h3_cell` | "a **string** property contains H3 cell IDs" |
| geospatial | `track_latitude`, `track_longitude` | "must be **numeric time series** properties" |
| event | `event_start_time`, `event_end_time` | "**timestamp** properties" |
| media | `media_source` | "the media set that the media references point to" |

**The set of capabilities is open** (see Q1) — so the table stores the capability
as a value and validates the *slot's type constraint*, rather than hardcoding a
column per capability.

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
status)` — `main` always exists — plus per-resource change tracking so a branch
can answer "what did I touch".

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

### D3 · Protection

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

### E3 · Value types

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

## Phase F — dependents

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

# Open questions

## Blocking — I would ask before building the phase

**Q1 · The full set of capabilities.** The Capabilities tab has **no page of its
own**; Geospatial, Event and media source are assembled from five consumers
(`map/integrate-objects`, `map/integrate-searcharounds`, `map/selection`,
`map/events`, `object-link-types/base-types`). If a canonical list exists I have
not found it. *Blocks B4's vocabulary, not its shape.*

**Q2 · Action parameters and submission criteria in detail.** I have the concept
— a common input form, renameable fields, default values, hidden fields, choices
"entered manually or **derived from a dataset**", and "who can invoke the action
at all" — but not the field-level definition. `action-types/submission-criteria`
and the parameter pages are mirrored and unread. *Blocks C's detail.*

**Q3 · How a branch stores a working change.** Foundry shows `189 edits` and a
per-resource diff, but no page read says whether a branch holds a copy of each
changed resource or a delta. Either works; the choice is structural and hard to
reverse. *Blocks D1.*

## Non-blocking — would improve the work but a sensible default exists

**Q4 · RID forms not yet attested.** Object type (`ri.ontology.main.object-type.…`)
and type group (`ri.ontology.main.type-group.…`) are confirmed from screenshots.
**Ontology itself, value type, link type, shared property, action type** are not.

**Q5 · Object type `ID` vs `API name`.** Both exist and differ
(`generated-6a437f16-8843-4b82-8…` vs `Generated59a386a3ddbf…`). The ID looks
generated and stable; the API name looks derived from the label. No page states
the relationship or which one links resolve against.

**Q6 · "Semantic search 🧪"** — a sidebar entry in one Ontology Manager version,
flask-marked, explained nowhere read.

**Q7 · Ontology configuration** — the bottom-left settings entry. `type-groups`
references it for legacy migration; nothing describes it in full.

**Q8 · Health issues / Cleanup** — two permanent sidebar entries. Health issues
is now clearly related to index-time validation failure (E3), but
`ontology-manager/cleanup.md` is mirrored and unread.

**Q9 · Materializations** — a rail entry in the deep dive, greyed out for that
object type. Unread.

**Q10 · Interfaces and shared properties as branch-protectable resources.** Both
are in the protected-five, so both need whatever D1 gives object types. Our
interfaces still carry `properties jsonb`, which O2 removed from object types —
the same fix is owed there.

## Deliberately deferred, not open

- **Functions** (8,944 in one screenshot) are an ontology resource, but
  "Modifications to the function can only be made within the **Functions Code
  Repository**" — a separate system we have no counterpart for.
- **Object Views** are Workshop-built; standard views are derived and we already
  generate ours from a registry.
- **Portfolios, tags, Trash, References, Pinned, promoted status** are Compass
  features orthogonal to the ontology. Only **folders** (A2) is on the path.
