# Reading — creating an object type, and base types

Pages read in full:
- `mirror/object-link-types/create-object-type.md`
- `mirror/object-link-types/base-types.md`

Image read closely: `images/create-object-type-new-object-overview-page-annotated.png`
— the Ontology Manager object type Overview page. 147 further images mirrored.

---

## The creation sequence

A guided helper, and the same steps available manually:

1. **Choose a backing datasource**
2. **Object type metadata**
3. **Create properties**
4. **Configure the primary key and title key**
5. **Generate actions** (optional)
6. **Save location** — a project
7. **Save change to ontology**

> "Selecting **Create** will only stage your changes and **will not save** them."

Staging is explicit. The screenshot shows "4 edits" pending beside a **Save** button.

### The datasource step

> "If you have an existing datasource in Foundry containing data to back the object
> type then you can select it. This will automatically populate the object type's
> metadata. It will also map every column of the backing datasource to a property."
>
> "If you do not have an existing datasource… you can choose to continue without an
> existing datasource and select a location to **generate a dataset for permissions**…
> **As permissions of the objects of a type are determined by the location of their
> backing datasources**, you will be prompted to choose a location to which you want
> to save an empty dataset."

So the generated dataset is not a formality — it exists so the objects have a
place in the filesystem to derive permissions from.

Two constraints:

- "A backing datasource for an object type may not contain `MapType` or
  `StructType` columns."
- "**a single datasource can only be used to back one object type**."

### Properties are mapped from columns

Mapping runs both directions — column → new property, column → existing property,
property → column — plus "Add all unmapped columns as new properties". In each
case "The property ID, display name, and base type will be **inferred from the
name of the column**."

### Primary key and title key

> **Title key:** "The property that acts as a display name for objects of this type."
>
> **Primary key:** "The property that acts as a unique identifier for each instance
> of an object type. **Each row in the backing datasource must have a different
> value for this property.**"

"Every object type requires at least one property. This is because object types
need a primary key to uniquely identify them."

Three hard warnings, and they are the reason primary key cannot be an afterthought:

1. **Duplicates break the build.** On Object Storage v2 "a duplicate primary key
   will cause Funnel batch pipeline errors leading to a build failure." On v1 "an
   update will appear as successful; however, the duplicate primary keys can cause
   unexpected changes to your Ontology."
2. **Primary keys must be deterministic.** "If the primary key is non-deterministic
   and changes on build, **edits can be lost and links may disappear**… ontology
   edits are associated with the primary key of the object… Avoid using numbered
   row or random key generation."
3. **Changing it destroys edits.** "Edits are permanently attached to the primary
   key value you made them for. Any time you change the primary key of an object
   type, you will be prompted to **delete all existing edits**."

## Base types

"Property base types define the kind of data that can be stored in a property… The
base type of a property determines **the set of operations available for that
property in user applications**. All field types are valid base types except for
`Map` and `Binary` types."

Advanced types, all named: **Vector**, **Geopoint**, **Geoshape**, **Attachment**,
**Time series**, **Geotemporal series**, **Media reference**, **Cipher text**,
**Struct**.

> "All base types may be used in **arrays** to represent multiple values for a
> property, excluding the `Vector` and `Time series` types."

**Media reference** is a JSON value carrying `mimeType` and a `reference` with
three RIDs (media set, view, item). It needs both a media-reference column in the
backing dataset *and* a **media source** configured in the object type's
**Capabilities** tab.

---

## What the image adds, that the prose does not

The Overview page of an object type named `Test`, with 0 objects:

**Three identifiers, not one.** The metadata strip reads `ID  test` · `API  Test`
· `RID  Set on save`. So a lowercase id, an API name, and a platform RID assigned
at save. Our `object_types` has a uuid and an `api_name`.

**Fields the prose never mentions, in the right-hand card:**

- **Status: Experimental** — and it is the *default* for a new object type
- **Visibility: Normal**
- **Index status** — a first-class field on the object type. Indexing is part of
  the type's own state, not a background detail.
- **Edits: Disabled** — whether objects of this type accept edits, as a setting

**The object type's full surface**, from the left nav: Overview, Properties,
Security, **Datasources** (plural), Capabilities, Interfaces, Materializations,
Automations, Usage. The last three are greyed out for an empty type.

**Datasources is plural** — consistent with multi-datasource object types from the
permissioning reading.

**The Ontology is branched.** A `Main` branch selector with a git-branch icon sits
in the header, beside "4 edits" and **Save**. This matches "Branching
compatibility… integrate with Global Branching" from the object-permissioning
reading.

**Link types are drawn as a graph**, not listed — a canvas with zoom/fit controls
showing `[Test] — [+ Create new link type]`, with a toggle to a list view.

---

## Connects to

- **`ontology/core-concepts`** — the dataset analogy. Here it is operational:
  columns become properties, and property base types are inferred from column names.
- **`object-permissioning/object-security-policies`** — "The primary key property
  cannot be a member of any property security policy." Third independent reason
  the primary key is load-bearing.
- **`data-integration/virtual-tables`** — "objects backed by the virtual table will
  reindex". **Index status** on this page is the visible half of that.
- **`object-backend/overview`** — Object Storage v1 (Phonograph) vs v2 gates
  behaviour repeatedly. **Unread, and now clearly needed.**
- **`superrepo/`** — "Ontology-as-code". A programmatic path exists. Unread.
- **Our `object_types`** — has `api_name`, `label`, `properties` jsonb,
  `title_key`, `source_table`, `status`, `visibility`. Missing: **primary key**,
  plural name, aliases, groups, index status, edits-enabled, RID.
- **Our `objectTypes/baseTypes.ts`** — six of the base types; `Geoshape`,
  `Attachment`, `Time series`, `Geotemporal series`, `Cipher text`, `Struct` absent,
  and **arrays of any base type** are absent as a concept entirely.

## Open questions — for the operator, not to be guessed

1. **What is our "dataset"?** Foundry generates one when you create an object type
   without a backing datasource, and permissions derive from *where it is saved*.
   We have Postgres. Does an object type get its own generated Postgres table
   (`obj_<api_name>`), or does something else back it? This is the central design
   question and everything else waits on it.
2. **Do we adopt a RID now?** Foundry gives every resource a platform identifier
   assigned at save, distinct from both the lowercase id and the API name. We have
   a uuid and an api_name.
3. **Object Storage v1 vs v2** changes documented behaviour in several places. I
   have not read `object-backend/overview`. Worth reading before designing, or is
   the distinction irrelevant to a clone with one backend?
4. **"A single datasource can only be used to back one object type."** Is that a
   constraint we want to enforce from the start?

## Not decided

Nothing built from this reading yet.
