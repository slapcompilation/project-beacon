# Reading — Capabilities, Value types, Type groups

Closes the three questions left open by `compass-branching-and-views.md`, and
answers a fourth I had not thought to ask.

Pages read: `mirror/ontology-manager/overview.md` (13 images backfilled and
analysed), `mirror/object-link-types/value-types-overview.md`,
`create-value-type.md`, `use-value-type.md`, `value-type-constraints.md`,
`type-groups.md`, plus `mirror/map/integrate-objects.md` and
`object-link-types/base-types.md` for the Capabilities tab.

---

## 0 — The sentence that settles where an Ontology lives

From `value-types-overview.md`, in a paragraph about something else entirely:

> "Unlike object types, properties, link types, or other types that define and
> build the Ontology, value types are associated with a **space** in the
> platform. **A space can hold a single ontology.** Value types can only be used
> within the space in which they were defined."

**One space, one ontology.** My S1 open question — "is an Ontology inside a
Project, or beside one?" — has a third answer: it is **the space's**. That also
explains the Ontology picker: switching ontology is switching space.

## 1 — Capabilities: answered, but not by the page suggested

`platform-overview/aip-capabilities` is a generative-AI stub and is not this.
The tab **is** documented — indirectly, from the applications that consume it.

> "A circle geometry can be specified on an object type by selecting a **Radius**
> property in the **Geospatial** section of the object type's **Capabilities**
> tab. The radius property can be any numeric property measured in meters."
>
> "To specify that a string property contains **H3 cell IDs**, select that
> property under **H3 cell** in the Geospatial section of the object type's
> Capabilities tab."
>
> "To configure the **track** for the object type, select the **Track Latitude**
> and **Track Longitude** properties in the Geospatial section… Both properties
> must be **numeric time series properties** representing the object's location
> over time."
>
> "Object types can be configured as **events** by specifying **Event start
> time** and **Event end time** timestamp properties in the **Event** section of
> the object type's Capabilities tab."
>
> — `map/integrate-objects.md`

And from `object-link-types/base-types.md`, a third section:

> "…the **Capabilities** tab of the object type. This **media source** should be
> the media set that the media references point to."

`map/integrate-searcharounds.md` and `map/selection.md` name it twice more.

**So: Capabilities is where an object type declares which of its properties
satisfy a platform capability's contract.** It is not a permission and not a
feature flag — it is a **mapping from a capability to the properties that
fulfil it**, and it is what lets Map draw a circle, a hexagon, a track or an
event without the object type knowing anything about Map.

Sections evidenced so far: **Geospatial** (Radius · H3 cell · Track Latitude ·
Track Longitude), **Event** (Event start time · Event end time), and a **media
source**. The tab itself has no page of its own in the corpus — this is
assembled from five consumers, and is marked as such.

That shape is worth naming, because it is the inverse of how we would reflexively
build it: the capability does not read the object type's properties by
convention, **the object type nominates them**.

## 2 — Value types

> "**Value types** are **semantic wrappers around a field type** that include
> metadata and constraints that can enhance type safety, improve expressiveness,
> and provide additional context."
>
> "Dataset field types and property base types reflect the **primitive types
> found in programming languages**. These types are **domain-agnostic and provide
> no domain context**. By contrast, value types **capture the context and
> semantic meaning** of data and centralize data validation. Users define and
> consume meaning directly from the value type, rather than relying on
> surrounding information such as **column names or property descriptions**."

The worked example is the whole idea:

> "a user can define an 'email' value type that has a **regular expression
> constraint**… This value type can then be **reused across multiple object types
> and pipelines without having to duplicate the validation logic**."

And they bite in both places:

> "Value types also **enforce their validation constraints on data in Builder
> pipelines and the ontology**."

**Where they live:** the space, not the ontology (§0). "Value types are **not
available for the Default ontology**." They are **versioned** (breaking and
non-breaking edits) and **permissioned**. Created in a separate application —
the **Value Types Manager** — reached from the platform sidebar, with a space
picker in its top-left.

**Creation is a three-step wizard**, and the image shows the rail: **1 Metadata ·
2 Constraints · 3 Preview**.

1. name, description, **unique API name**
2. a **base type**
3. optionally a **constraint**
4. optionally "an **example preview value**" — recommended

**The constraint vocabulary, by base type** (`value-type-constraints.md`):

| constraint | valid base types |
|---|---|
| **Enum (one of)** | String, Boolean, Decimal, Double, Float, Integer, Short — and for String, "optionally case-sensitive or case-insensitive" |
| **Range** | Decimal, Double, Float, Integer, Short, Date, Timestamp, String, Array — "For String… the **length** of the string is constrained. For Array… the **size** of the array" |
| **Regex** | String — "may optionally pass when matching only a **substring**" |
| **RID** | String |
| **UUID** | String |
| **Uniqueness** | Array — "All elements must be unique" |
| **Nested** | Array — "A value type constraint can be applied to the **elements** of the array" |
| **Element constraints** | Struct — "a **mapping between a struct field identifier and a value type reference**" |

The constraint screenshot confirms the String set as radio buttons — **RID ·
UUID · Length · Regex · Enum** — with a **Case insensitive** toggle and, for
Enum, a **reorderable** list of values (drag handle and ✕ per row): `Salmon`,
`Cod`.

**Where they attach** (`use-value-type.md`): an object type property, a **shared
property**, or a Pipeline Builder property "as a **logical type** using the
`logical type cast` expression".

And the failure mode, which is the load-bearing sentence for us:

> "If you apply a value type to an object property that contains property values
> that **fail validation, that object type will fail to index**. You can view such
> index failures in the **object type health status** in Ontology Manager."

**A value type is a constraint that runs at index time.** That is why "Health
issues" is a permanent sidebar entry.

## 3 — Object type groups

> "Object type groups are a **classification primitive** that help users better
> search and explore their ontology."
>
> "To view object type groups, users must have **viewer** permission on **the
> project that the object type group is in**."

So a group is a resource **in a project**, like everything else in Compass.

The `groups-menu.png` screenshot gives the shape precisely:

- A **Groups** table — `52` — columns **NAME** and **NUMBER OF OBJECT TYPES**,
  with a **⊕ New group** button. Counts across the visible rows run 1…58.
- Selecting one opens a **right detail panel** with three tabs: **Content ·
  Display · Permissions**.
- **Content** lists the member object types (`[Grocery] Purchases`, `[Grocery]
  Customer`, `[Grocery] Returns`, `[Grocery] Product`) with an **Edit content**
  button.
- The panel footer carries the **RID: `ri.ontology.main.type-group.<…>`**.
- Each group's 2×2 icon is **differently coloured** — hence a **Display** tab.

Membership is editable from either end:

> "Groups can also be added directly to object types by selecting **Edit groups**
> in the object type overview page."

And they are a search facet:

> "Groups are **searchable** in Ontology Manager's Search bar… The table of object
> types supports **displaying and filtering by group**. Groups are also displayed
> on the **Object Explorer home page**."

**History worth keeping:** groups replaced a tag-based system on 22 May 2024, and
the names of un-migratable legacy groups "remain stored as **type class
metadata** on object types." Also: group visibility was changed so that "**all
groups will now be discoverable to any user that can view the ontology**", where
previously a group of invisible types was itself invisible. That is a deliberate
choice of transparency over need-to-know, at the *name* level only.

## 4 — Ontology Manager, and what the annotated images add

`ontology-manager/overview.md` names the top bar's three jobs — "search for
Ontology resources, create new Ontology resources, and **navigate between or
create new branches**" — and the search placeholder in the image is
**"Search by name, RID, aliases…"**, which is why an object type has an Aliases
field at all.

**The sidebar** (two versions seen; both agree on the spine): Ontology picker →
**Discover**/**Overview** · **Proposals** · **History** · *(newer: **Semantic
search** 🧪)* → **Resources**: Object types · Properties · Shared properties ·
Link types · Action types · **Groups** · Interfaces · *(sometimes **Value
types**)* · Functions → **Health issues** · **Cleanup** → and at the very
bottom, **⚙ Ontology configuration**.

Counts in the wild are large: Object types 9,401 · Link types 7,008 · Action
types 7,533 · Functions 8,944.

**Discover** is "a highly customizable landing page… By default… favorite object
types, recently-viewed object types, and favorite groups", and for a new user two
fallback sections: recently modified, and prominent. The cards carry: icon, name,
**object count**, **dependents count**, **group chips with each group's total
size**, description, a favourite star, and the word **Prominent**. A **favourite
type group** card renders **the group's object types and the links between them**
as a small graph — which is the clearest statement of what a group is.

**The object type Overview has exactly seven sections**, numbered in the
annotated image:

| # | section | what the image shows |
|---|---|---|
| 1 | **Object type metadata** | Plural name · Description · Aliases (chips) · Point of contact (avatar + ✉ + ✏) · Contributors · Ontology · API name — and on the right **Status `Active`** · **Visibility `Normal`** · **Index status `Not indexed on branch`** · **Edits `Disabled`** · **ID** · **RID** |
| 2 | **Properties** `15` | the two key holders float to their own group at the top (`Display Name [Title]`, `Tail Number [Primary key]`), then the rest, with base-type icons (`99` string, `123` number, 📅 date) |
| 3 | **Action types** `1` | grouped by relationship — a sub-header **`References [Example Data] Aircraft`** `1` |
| 4 | **Link types** `4` | a **graph** centred on this type, with a **list/graph toggle** and a **⊕ Create new link type** button inside the canvas |
| 5 | **Dependents** `14` | left column of dependent **kinds** with counts — Workshop 9, Function 2, Graph Template 1, Quiver Dashboard 1, Use cases 1, Automation 0, Developer Console App 0, Map Layer 0, Map Template 0 — right column the actual dependents, plus **⊕ Create new** |
| 6 | **Data** | a log of sync events per datasource: `aircraft synced 7 weeks ago` … **See all** |
| 7 | **Usage** | a bar chart over months, **See more** |

**Two findings from section 1.**

**`Index status: Not indexed on branch`** is a field on the object type, and it
is **branch-aware**. Combined with "indexing counts as a modification" from the
branching page, indexing is not a background detail — it is a tracked, branch-
scoped property of the type.

**`RID: ri.ontology.main.object-type.d5d…`** — and that is *exactly* what our
`rid_of()` already emits (`ri.ontology.main.object-type.<uuid>`, verified live).
The RID grammar reading was right.

**Section 5 is the index CLAUDE.md keeps referring to.** "The platform indexes
ontology resources, so 'what uses this' is a query against the resource graph" —
this is that query, rendered: by kind, with counts, **including the zeroes**.

The other entity views, from the same page: a **link type view** has Overview and
Datasources; an **action type view** has Overview, **Logic** and
**Observability**; a **function type view** has Overview, **Configuration** and
Observability, where "Modifications to the function can only be made within the
**Functions Code Repository**". Observability "shows the near real-time usage…
over the last 30 days as well as any **monitoring rules** and their status".

---

# What this changes

### S1 gains an answer and loses a question

An Ontology belongs to a **space**, one per space. `spaces` exists (397). So S1
is `ontologies` with a `space_id` **unique**, not a folder reference — and the
Ontology picker is a space picker.

### Two new resources, and they sit in different places

| | belongs to | RID form | notes |
|---|---|---|---|
| **Type group** | a **project** (viewer permission on it) | `ri.ontology.main.type-group.<uuid>` | Content · Display · Permissions; membership editable from either end |
| **Value type** | a **space** | unattested | versioned, permissioned, its own manager app; **constraints run at index time** |

### Capabilities is a table, not a column

An object type nominates properties against named capability slots. The shape is
`(object_type, capability, slot, property)` — e.g. `(Aircraft, geospatial,
track_latitude, lat)`. Sections evidenced: Geospatial, Event, media source.

### The seven Overview sections are the build target for the object type page

And #5, **Dependents**, is the one we have no equivalent of at all.

## Open questions

1. **The Capabilities tab has no page of its own.** Everything above is assembled
   from five consumers. If there is a canonical list of capability sections, it
   is not in the corpus — the full set may be larger than Geospatial + Event +
   media.
2. **Value type RID form** — unattested, like link types and shared properties.
3. **"Semantic search 🧪"** appears in one sidebar and no page read explains it.
4. **Ontology configuration** — the bottom-left settings entry. `type-groups.md`
   references it for legacy migration; nothing read describes it in full.
5. **Health issues** — now clearly related to index-time validation failures
   (value types), but the page is unread.
