# Reading — creating an object type, its keys, and mandatory control properties

Rewritten 2026-08-07 after reading the whole page rather than the parts that
answered the question in front of me. The first pass took the datasource and
primary-key sections and skipped the manual path, API naming, groups, and the
troubleshooting list — which turns out to hold the tightest specification on the
page.

Pages read in full:
- `mirror/object-link-types/create-object-type.md` (319 lines, all of it)
- `mirror/object-link-types/mandatory-control-properties.md`
- (context) `properties-overview.md`, `base-types.md`, `object-types-overview.md`

Images read closely:
- `images/create-object-type-configure-keys-helper.png` — **the wizard's key step**
- `images/create-object-type-configure-keys-manual.png` — **the property editor**
- `images/create-object-type-edit-backing-dataset.png` — an object type with no datasource
- `images/create-object-type-new-object-overview-page-annotated.png` — the Overview page
- `images/marking-inputs-install.png` — mandatory control inputs at install

---

## Two paths, and a third

> "The primary way to create and configure a new object type is with a **guided
> step-by-step helper**… but if you exit the helper before completing the object
> creation process, you can also **manually** complete the process by specifying
> the metadata, backing datasource, property mappings, and keys."

And a programmatic one, which is a whole system we have not looked at:

> "If you want a programmatic way of creating an object type, use a **SuperRepo**.
> SuperRepos define object types in code with **Ontology-as-code**, and object
> types created in the Ontology Manager can be **imported** into a SuperRepo."

## The helper: five steps

`create-object-type-configure-keys-helper.png` shows the rail: **1 Datasource ·
2 Metadata · 3 Properties · 4 Actions · 5 Save location**.

**1 — Datasource.** Two branches:

> "If you have an existing datasource… This will automatically populate the object
> type's metadata. It will also **map every column of the backing datasource to a
> property**, but you can discard added properties in the Properties step."
>
> "A backing datasource for an object type **may not contain `MapType` or
> `StructType` columns**."
>
> "If you do not have an existing datasource… you can choose to continue without
> one and select a location to **generate a dataset for permissions**. This option
> **is not available if you are using Object Storage v1**. As permissions of the
> objects of a type are determined by the location of their backing datasources,
> you will be prompted to choose a location to which you want to save an **empty
> dataset**."

The `MapType`/`StructType` exclusion lines up exactly with `base-types`: "All field
types are valid base types except for `Map` and `Binary`."

**2 — Metadata.** Icon, **Name**, **Plural name**, **Description**, **Groups**.
Plural is a first-class field: "The name shown to anyone accessing **multiple**
objects of this type." Groups are "a mechanism for organizing your ontology".

**3 — Properties.** "Every object type requires at least one property. **This is
because object types need a primary key** to uniquely identify them." And a
limitation: "property types that **require advanced configuration, such as media,
cannot be generated as part of the bootstrapping wizard** and must be added after
you have exited it."

**4 — Actions.** "You can optionally generate a **standard set of actions** to edit
objects of this type and assign a specific user or group that can run them." Also
OSv2-only.

**5 — Save location.** A project. And the staging rule:

> "Selecting **Create** will only stage your changes and **will not save** them."

Then, separately: "Back in Ontology Manager, select **Save** in the upper right
corner."

### What the wizard's key step actually shows

Two pickers at the top — **Primary key** and **Title** — over a two-column
**Source → Property** mapping table. And the Source column is the surprise:

```
Source                        Property
📅 › primary-key              "" Aircraft id          [Primary key]
👤 User input / actions       "" Owner id
👤 User input / actions       📅 Date of manufacture
👤 User input / actions       "" Display name         [Title]
+ Add property
```

**A property's source can be `User input / actions` rather than a dataset column.**
So not every property is backed by data — some are populated purely by edits. That
is the other half of "generate a dataset for permissions": the generated dataset is
empty, and the values arrive through Actions.

This sits oddly beside the troubleshooting list, which says a property's **Backing
column** must not be empty. Read together, the most likely reconciliation is that
the backing-column requirement applies to dataset-backed properties and the
`User input / actions` source is the edit-only case
(`mandatory-control-properties` refers to "an **edit-only object type** that
already has edits"). **Marked as inference; not stated on either page.**

Chips: the primary key property carries a **purple `Primary key`** chip, the title
key a **green `Title`** chip.

## The keys

> **Title key:** "The property that acts as a **display name** for objects of this
> type." Example: `full name` on `Employee` → "Melissa Chang".
>
> **Primary key:** "The property that acts as a **unique identifier** for each
> instance of an object type. **Each row in the backing datasource must have a
> different value for this property.**" Example: `employee ID`.

**Both are designations on a property, not fields on the object type.**
`create-object-type-configure-keys-manual.png` makes this unmissable — the property
editor's right pane has a **KEYS** section with two checkboxes, each naming who
currently holds it:

```
KEYS
  ☐ Primary key   (current: Tail Number)
  ☐ Title key     (current: Display Name)
```

Checking one on a different property moves it. In the property list on the left,
the holder is marked with an icon: **⭐ star = primary key**, **🔖 bookmark = title
key**. (The Data Lineage panel uses a key glyph for the primary key and the same
bookmark for the title key — the bookmark is consistent across both apps.)

### The three warnings, and they are the reason the key cannot be an afterthought

1. **Duplicates break the build.** "a duplicate primary key will cause **Funnel
   batch pipeline errors leading to a build failure**" on OSv2. On v1 "an update
   will appear as successful; however, the duplicate primary keys can cause
   unexpected changes to your Ontology."
2. **Primary keys should be deterministic.** "If the primary key is
   non-deterministic and changes on build, **edits can be lost and links may
   disappear**… ontology edits are associated with the primary key of the object.
   Links between objects can disappear if builds are not coordinated to update link
   IDs… **Avoid using numbered row or random key generation.**"
3. **Changing it destroys edits.** "Edits are permanently attached to the primary
   key value you made them for. Any time you change the primary key of an object
   type, you will be **prompted to delete all existing edits**."

A fourth, from `object-permissioning`: "The primary key property **cannot be a
member of any property security policy**."

### What else lives on a property

The same editor pane shows fields the prose never lists: **STATUS**
(`Experimental`), **API NAME**, **KEYS**, **DATE AND TIME FORMATTING** (a toggle),
**CONDITIONAL FORMATTING** (`+ Add a rule`), **PROPERTY BASE TYPE** (a dropdown),
**TYPE CLASSES** (`+ Add new type class`), and **RENDER HINTS** — where
`☑ Selectable` carries an amber **`Requires resync`** chip.

*Requires resync* is the interesting one: some property settings cannot take effect
without reindexing. Each row in the property list also carries a **visibility eye**
and a **base-type icon** (`""` string, `123` number, `📅` date).

## The manual path adds four things the helper does not

**Aliases** — "Additional terms that will find this object type when users search
for them." Not in the wizard.

**ID, and its rules** — "A unique identifier of the object type, primarily used to
reference objects of this type when configuring a user application." Lowercase
letters, numbers and dashes; must start with a lowercase letter. And the warning
that recurs three times on this page:

> "Once a property's ID is saved and the property is referenced in user
> applications, **any change to the property ID will break the application**."

**Groups**, in more detail — labels, creatable inline by typing a new name,
searchable in Ontology Manager's search bar, filterable in the object type table,
and displayed on the Object Explorer home page. With a migration note: "Groups as
labels in object type metadata **replace the previous method** of adding
`oe_home_page_object_type_group` type class to the primary key property."

**Three ways to map a property to a column**, which is a small grammar:

- *Column → new property*: "The property ID, display name, and base type will be
  **inferred from the name of the column**."
- *Column → existing property*: "If a property already exists with a property ID
  that **matches the column name**, the column will be mapped to the existing
  property."
- *Property → column*: pick from a dropdown.
- Plus **Add all unmapped columns as new properties** in bulk.

And the constraint that governs the whole binding:

> "**a single datasource can only be used to back one object type.**"

## API names — two different casings, and reserved words

> An **object type's** API name must "Begin with an **uppercase** character…
> written in **PascalCase**… **unique across all object types**… between 1 and 100
> characters."
>
> A **property's** API name must "Begin with a **lowercase** character… written in
> **camelCase**… **unique across all properties belonging to the same object
> type**… between 1 and 100 characters."

Note the different uniqueness scopes: object type API names are globally unique,
property API names only within their type.

> "there are a number of **reserved keywords** that cannot be used for API names.
> They are: `ontology`, `object`, `property`, `link`, `relation`, `rid`,
> `primaryKey`, `typeId`, and `ontologyObject`."

The troubleshooting section restates the ID and API rules slightly differently —
property **IDs** allow "lowercase or uppercase letters, numbers, dashes, and
underscores", and an object type API name there is "alphanumeric characters **and
underscores**" where the main section said alphanumeric only. **The two sections
disagree; the stricter reading is the safe one.**

## The completeness contract — the tightest thing on the page

> To save a new object type, these **object type** fields must not be empty:
> **ID · Display name · Plural display name · Backing datasource · API name**
>
> And these **property** fields must not be empty:
> **Property ID · Property display name · Backing column · Property API name ·
> Title key · Primary key**

That is the validation rule, given as a list. `create-object-type-edit-backing-dataset.png`
shows what violating it looks like: an object type named `test` with `0 objects`, a
**red warning triangle**, `❗4 errors` in the header, `Properties (0)`, and a
**DATA** card reading **"No dataset added"** with an `Add a backing datasource`
button. Beside it a **USAGE** card — "No usage for the last 30 days. Information
about how and where this object type is being used will soon be available here."

And the error for the cardinality rule:

> `Phonograph2:DatasetAndBranchAlreadyRegistered` — "the datasource backing the
> object type you are trying to save is **already backing a different object
> type** in the Ontology and cannot be used again."

Note it names a **dataset and branch** pair. The same error appears on
`create-link-type` for link types.

---

## Mandatory control properties

> "Mandatory control properties are object type properties that allow for granular
> access control to the data stored in objects. You can use mandatory control
> properties to restrict access to **all other properties in the same datasource**
> for a given object."
>
> "Mandatory control properties are **only available on Object Storage v2**."

**The base type is called `Mandatory Control`**, not `Marking` — `properties-overview`'s
table row says `Marking`, this page says "Set the base type of the property type to
**Mandatory Control**". Same thing, two names.

Three kinds, and they compose differently:

| kind | rule |
|---|---|
| **Markings** | "If a resource has multiple markings, the user must have **all** of them" |
| **Organizations** | "the user must be a member of **at least one**" |
| **Classifications** | "Every user can only access data that is classified **at or below** their own classification level" |

> "Markings and organizations **can be used together** on the same mandatory
> control property. In this case, a user must satisfy **all** the markings and **at
> least one** of the organizations."
>
> "Classifications **can not** be used together with markings or organizations on
> the same mandatory control property."

### The mechanism, and why we cannot build it yet

> "Mandatory control properties **must be mapped to a marking column on a
> restricted view**. The mandatory controls are enforced by **backing the object
> type with a restricted view** which has a policy that requires users to satisfy
> the markings in the mapped column to be able to view a row."

**It is implemented as a restricted view**, which is the mechanism
`object-permissioning` described as the older, dataset-level row filter. We have no
restricted views, so this is blocked on a thing we deliberately did not build.

### Datasource-level, which is the design

> "A mandatory control property secures **all other properties in the same
> datasource**… for multi-datasource-backed object types, **each datasource could
> have its own** mandatory control property. Only the properties backed by a
> specific datasource will be secured by the mandatory control in that datasource."
>
> "it is possible for a user to only have permission to see a **subset of
> properties** on an object… **Other properties will appear as null.**"
>
> "the backing datasources **should be structured in such a way that only
> properties that should share a mandatory control are in the same datasource**."

**That is what multi-datasource object types are actually for.** The MDO reading
called it "column-level access controls"; this is the mechanism — you split
properties across datasources so each can carry its own control.

### Validations

- **Must be required.** "All mandatory control properties must not be null.
  However, markings and organization values **can be set to an empty array**. In
  such cases, **all users will meet the marking requirements**."
- A documented workaround for adding one to an existing edit-only type: add a
  nullable string array property → backfill via an Action → change the base type to
  Mandatory Control.
- **Every datasource must declare a constraint** — allowed markings, allowed
  organizations, or a max classification. "**enforced on the object storage
  level**, so even though you may be able to use Ontology Manager to save an object
  type that violates this constraint, the object type will **fail to index**."
- The constraint propagates to exports: "These allowed markings… will be used to
  **mark any exported dataset that is materialized** from this Object type. This
  ensures that only users who can view all rows will be able to view the
  materialized dataset."
- **Hidden by default** — "mandatory control properties are meant to be used as
  markings for other fields, so there is usually no need for [them] to appear in
  object views or tables."

### In actions, and at install

"You can add a mandatory control **parameter** to your action type… **Organization
parameters are currently not supported.**" A max classification can be set at the
parameter level, which fails the action *before* submission rather than at index
time.

`marking-inputs-install.png` shows Marketplace declaring them as installation
inputs: an **Allowed Markings** multiselect (`test-marking`) and two **Max
Classification** rows (`MTS//MNF`, `MS//REL TO USA, FVEY`), each labelled with what
it is *Affecting*.

---

## Connects to

- **`properties-and-keys`** — the eligibility table for both keys; only `String`,
  `Integer`, `Short` are unreservedly valid as a primary key.
- **`datasets-rid-and-object-storage`** — "generate a dataset for permissions" is
  why our `datasets` table exists; the primary key is Funnel's join key.
- **`markings`** — mandatory control properties are the object-layer form of what
  399–404 built, and they run on **restricted views**, which we lack.
- **`object-permissioning`** — MDOs "including column/property level permissions"
  is this feature.
- **Our `object_types`** — has `api_name`, `label`, `properties` jsonb, `title_key`,
  `source_table`, `status`, `visibility`. Missing: **primary key**, plural name,
  aliases, groups, per-property API name, per-property visibility, type classes,
  render hints — and the datasource binding.

## Open questions

1. **Can a property have no backing column?** The wizard shows `User input /
   actions` as a Source; the troubleshooting list says Backing column must not be
   empty. Inference above; not stated.
2. **Composite primary keys.** Every sentence is singular, and the MDO page says
   "the primary key of the object type is auto-selected since **there is only one
   primary key for each object type**". Reads as single-column; never denied
   outright.
3. **What is an Archetype?** A top-level tab beside `Ontology` in the header of
   `create-object-type-edit-backing-dataset.png`. Unmet anywhere else.
4. **SuperRepo / Ontology-as-code.** A programmatic definition path, unread.

## Decisions

Recited to the operator 2026-08-07. Build map below; nothing built from this
reading yet.
