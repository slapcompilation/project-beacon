---
verify: strict
---

# Reading — value types (the whole six-page set), as the E4 spec

**Pages read in full (6/6):** `object-link-types/value-types-overview.md`,
`object-link-types/create-value-type.md`, `object-link-types/use-value-type.md`,
`object-link-types/value-type-constraints.md`,
`object-link-types/value-types-versions.md`,
`object-link-types/value-types-permissions.md`.

They are short — 14, 25, 18, 26, 12 and 8 lines. **The entire public
documentation of value types is under 100 lines of prose**, and four of the five
screenshots carry fields that appear in no sentence. That ratio is the single
most important fact about this reading: for value types, the images are not
illustration, they are most of the specification.

**Images parsed (5/5):** every `value-type-*.png` in
`object-link-types/images/` — `value-type-create-metadata.png`,
`value-type-create-constraint.png`, `value-type-create-preview.png`,
`value-type-use.png`, `value-type-versioning.png`. Inventory and per-field
analysis in §8.

**Sublinks followed and read:** `object-link-types/base-types.md` (whole),
`security/orgs-and-spaces.md` (whole), `platform-security-management/manage-orgs-and-spaces.md`
§Spaces, `object-link-types/type-reference.md` (whole, = `object-link-types/_index.md`).

**Read, and nothing below quotes them:** `object-link-types/properties-overview.md`
§Supported property types, `data-integration/datasets.md` §Supported field types.
They fixed the boundary — which base types exist, and which dataset field types
they land on — without contributing a sentence this reading rests on.

**Corpus swept for every other mention of the phrase** (`grep -rn -i "value type"`,
24 files) and the ones that bear on structure read: `functions/resource-imports-sidebar.md`
§Import resources with value type dependencies, `object-link-types/derived-properties.md`,
`object-link-types/struct-shared-properties.md`, `ontology/persisted-scenario.md`,
`map/integrate-objects.md`, `pipeline-builder/transforms-geospatial.md` §Logical types,
`pipeline-builder/functions-index.md` §Logical type cast,
`object-link-types/mandatory-control-properties.md` §Validations,
`object-link-types/metadata-statuses.md`,
`ontologies/ontologies-overview.md`, `global-branching/branch-security.md`,
`security/projects-and-roles.md`.

Also read with nothing here quoting it: `object-link-types/edit-properties.md`
— it says which properties an editor may change, which bounds where a value
type can be attached, and no sentence of it is load-bearing below.

**Read and discarded as a different concept with the same name:**
`workshop/widgets-metric-card.md`, `workshop/widgets-iframe.md`,
`workshop/object-set-filter-variables.md`, `quiver/cards-vega-plot.md`,
`time-series/time-series-properties-use-case-operational.md`,
`action-types/getting-started.md`, `action-types/submission-criteria.md`,
`pipeline-builder/outputs-add-ontology-output.md`. See §9.6 — in these,
*value type* means which kind of value a widget input or variable holds, not the
ontology resource, and one of them (`outputs-add-ontology-output`) is genuinely
ambiguous.

**Not read:** `pipeline-builder/` beyond the two sections named above (the
authoring surface for the Builder half of enforcement is out of E4's scope);
`marketplace/` (value types are packageable — `map/integrate-objects.md` proves
it — but no mirrored Marketplace page names them); `security/restricted-views.md`;
`ontologies/shared-ontologies.md`. `ontology-manager/` has **no** page describing
the Value Types Manager application or the object type health status the failure
mode points at — I checked all eleven files in that section, and §9.4 records it
as a hole in the corpus rather than a hole in my reading.

---

## 1 — What a value type IS

The definition, twice, in two different pages that do not quite agree with each
other (§9.1):

> **Value types** are semantic wrappers around a [field type](/docs/foundry/data-integration/datasets/#supported-field-types) that include metadata and constraints that can enhance type safety, improve expressiveness, and provide additional context. Value types encapsulate domain-specific data types and enforce data validation in a manner reusable across the platform.

> Dataset [field types](/docs/foundry/data-integration/datasets/#supported-field-types) and property [base types](/docs/foundry/object-link-types/base-types/) reflect the primitive types found in programming languages. These types are domain-agnostic and provide no domain context. By contrast, value types capture the context and semantic meaning of data and centralize data validation. Users define and consume meaning directly from the value type, rather than relying on surrounding information such as column names or property descriptions.

The load-bearing half of that second paragraph is the last clause. A value type
exists so that meaning stops living in a **column name** or a **description** —
which is to say, it is the mechanism that turns a naming convention into a
row. That is the same move CLAUDE.md keeps making against hardcoding, and it is
worth saying out loud before the schema is designed.

The worked example is the whole idea in three sentences:

> For example, a user can define an “email” value type that has a regular expression constraint to ensure any property that uses the value type represents a valid email address. This value type can then be reused across multiple object types and pipelines without having to duplicate the validation logic for every such property. Additionally, each property that uses this value type is explicitly understood to contain an email address.

And the sentence that says value types have their own lifecycle machinery, which
is what the last two pages exist to describe:

> Since value types are intended for reuse across multiple pipelines and object types, they are [permissioned](/docs/foundry/object-link-types/value-types-permissions/) to ensure users can apply them where needed and [versioned](/docs/foundry/object-link-types/value-types-versions/) to handle both breaking and non-breaking edits.

### 1.1 The anatomy, field by field

`create-value-type.md` is a numbered eight-step list and it is the closest thing
to a field list the prose gives:

> 1. Navigate to the **Value Types Manager** application from the platform sidebar.
> 2. From the top left corner, use the dropdown menu to select the space in which you would like to create a value type.
> 3. Select **Create New Value Type** from the upper right corner.
> 4. Provide a clear name, description, and unique API name for your value type.

> 5. Choose a [base type](/docs/foundry/object-link-types/base-types/) for your value type.
> 6. (Optional) Define a constraint for your value type. Validators can be regular expressions for `String` types, enums, ranges, or other validation methods depending on the base type.

> 7. (Optional but recommended) Provide an example preview value for your value type.

> 8. Save your value type.

So, from prose alone:

| field | source | notes |
|---|---|---|
| name | step 4 | *clear*; the image calls it unique (§8.1) |
| description | step 4 | |
| API name | step 4 | stated **unique** |
| base type | step 5 | required; links to `base-types.md` |
| constraint | step 6 | **optional**, singular |
| example preview value | step 7 | optional, *recommended* |

The images add three more — a **failure validation message**, a per-value-type
**Usage tab**, and the fact that base type is **immutable from save**. §8.

**Step 8 is a bare `Save your value type.`** There is no branch, no proposal, no
save session, and no mention of the Ontology Manager working state anywhere on
any of the six pages. Contrast every ontology resource, which goes through
`ontology-manager/save-changes`. This is an argument from absence and is marked
as such — see Question 6.

---

## 2 — The constraint vocabulary, whole and verbatim

`value-type-constraints.md` is the page the build needs most, and it has a
two-part structure that is easy to misread: a **general** list (constraints that
span many base types) and then an **additional** list keyed by base type.

> Each value type may optionally define a constraint to enforce data validation. You can configure these constraints when [creating a new value type](/docs/foundry/object-link-types/create-value-type/) in the **Value Type Manager** application. The available value type constraints, along with what base types they can be applied to, are below:

### 2.1 The two general constraints

> * **Enum (one of):** A constraint representing a static set of allowed values.
>   * **Valid base types:** String, Boolean, Decimal, Double, Float, Integer, or Short.
>   * For String properties, the enum values may optionally be case-sensitive or case-insensitive.

> * **Range:** A minimum value, maximum value, or range of allowed values.
>   * **Valid base types:** Decimal, Double, Float, Integer, Short, Date, Timestamp, String, or Array.
>   * For String properties, the length of the string is constrained.
>   * For Array properties, the size of the array is constrained.

Two things to notice, because they change the schema:

1. **Range is one constraint with three modes** — min only, max only, or both.
   The versioning screenshot renders exactly that as two independent checkboxes,
   `Minimum size` and `Maximum size`, with the unchecked one disabled (§8.5).
2. **Range is polymorphic in what it measures.** On a numeric or temporal base
   type it bounds the *value*; on String it bounds the *length*; on Array it
   bounds the *size*. Same constraint kind, three different operands. A schema
   that stores `min`/`max` as numbers cannot also store a `Date` bound, and a
   schema that stores them as text loses ordering — this is Decision 4.

### 2.2 The type-specific constraints

> Additionally, the following property types have additional type-specific constraints available:

> * **String:**
>   * **Regex:** A regex pattern that the string must match. The regex validation may optionally pass when matching only a substring of the property value.
>   * **RID:** The string must be a valid rid.
>   * **UUID:** The string must be a valid UUID.

> * **Array:**
>   * **Uniqueness:** All elements of the array must be unique.
>   * **Nested:** A value type constraint can be applied to the elements of the array. For example, a regex constraint could be applied to every string in an array.

> * **Struct:**
>   * **Element constraints:** A mapping between a struct field identifier and a value type reference, where the struct field identifier indicates the struct component to which the referenced value type should be applied.

### 2.3 The vocabulary as a table, and what each one needs stored

Eight constraint kinds. Nothing else in the corpus adds a ninth.

| kind | valid base types (verbatim from §2.1/§2.2) | payload it must store |
|---|---|---|
| **Enum (one of)** | String, Boolean, Decimal, Double, Float, Integer, or Short | an **ordered** set of allowed values + a case-sensitivity flag, String only |
| **Range** | Decimal, Double, Float, Integer, Short, Date, Timestamp, String, or Array | min and/or max; measures value, string length, or array size depending on base type |
| **Regex** | String | the pattern + a *substring match* flag |
| **RID** | String | nothing |
| **UUID** | String | nothing |
| **Uniqueness** | Array | nothing |
| **Nested** | Array | **a reference to another value type's constraint** |
| **Element constraints** | Struct | **a map: struct field identifier → value type reference** |

**The last two rows are the structural surprise of this page.** Nested and
Element constraints make the value type graph **self-referential**: a value type
for an array of emails holds a reference to the email value type, and a value
type for a struct holds one reference per struct field. Whatever E4 builds, it
cannot be a flat table of scalars — there is an edge from a value type to a value
type, and for structs it is keyed by struct field identifier.

Note also that Nested is worded as `A value type constraint can be applied to the
elements` while Element constraints is worded as `a value type reference`. The
first says *constraint*, the second says *value type*. Whether an array's element
rule points at a whole value type or at a bare constraint is not settled by the
page — Question 3.

**RID appears here as a String constraint**, which means Foundry considers "is a
valid rid" a first-class semantic type. We have a RID grammar already
(`project_dataset_layer` memory); this is where it becomes a *reusable
declaration* rather than a regex written twice.

---

## 3 — Space-scoped, and why that is not a detail

The sentence, which is also the sentence this project took its one-ontology-per-space
fact from:

> Unlike object types, properties, link types, or other types that define and build the Ontology, value types are associated with a [space](/docs/foundry/security/orgs-and-spaces/#spaces) in the platform. A space can hold a single ontology. Value types can only be used within the space in which they were defined. Value types are not available for the Default ontology.

Read it as four separate claims, because they are:

1. **A value type is not an Ontology-building type.** It is explicitly contrasted
   with the four that are.
2. **It hangs off a space.**
3. **Its usability is bounded by that space** — not by a project, not by a
   folder, not by markings.
4. **The Default ontology gets none.**

`type-reference.md` says it a second way, and this is the one that names the
mechanism:

> While field types and base types are defined statically, value types are customized within the context of a given [space](/docs/foundry/security/orgs-and-spaces/). As a result, users cannot create new field types or base types but are able to create **value types** dynamically.

**Static versus dynamic is the real distinction.** Field types and base types are
a closed vocabulary compiled into the platform; value types are *rows a tenant
writes*. Ours are: `property_base_types()` is a hardcoded 22-element array in
migration 408, which is correct precisely because base types are static. Value
types are the opposite and must be a table.

Structural corroboration nobody states directly: in `type-reference.md`, the
`## Value types` heading sits **outside** the `## Ontology resources` section
that holds object type, property, shared property, link type, action type, object
type groups and interfaces. It is a sibling of `## Ontology resources`, after
`## Difference between object types and objects`. The page's own outline agrees
with its prose.

### 3.1 Why claim 4 is true, from a page in another section

`global-branching/branch-security.md`, on creating a branch:

> In most cases, no additional configuration is required — the branch will automatically be assigned to the space associated with the selected ontology. However, if you select the default ontology, you will need to manually select a space.

**The Default ontology has no space.** That is why it can have no value types —
not a product decision, a consequence. Nothing in the six pages says this; it
falls out of a sentence three sections away.

### 3.2 And why it barely matters for us

`ontologies/ontologies-overview.md`:

> An ontology is mapped 1:1 with a [space](/docs/foundry/security/orgs-and-spaces/#spaces). When a new space is created, a corresponding ontology with the same name is simultaneously created with the same organization [markings](/docs/foundry/security/markings/) as the space.

So `space_id` and `ontology_id` are informationally interchangeable in our
schema — migration 441 already made `ontologies.space_id` unique. **They are not
interchangeable in meaning**, and the tie-breaker is a consumer: Pipeline Builder
pipelines use value types (§5, §7.2) and pipelines are not ontology resources. A
value type whose foreign key points at `ontologies` would be unable to explain
why a Builder pipeline can see it. Decision 1.

---

## 4 — Versioning

The whole page, taken clause by clause because every clause is a rule:

> Value types are versioned to handle breaking and non-breaking edits. Value type versions include two parts: metadata and constraints. The metadata values for name, description, and apiName can be changed whenever necessary. The base type metadata and the constraints that define the validation rules for the type are immutable.

> If you choose to update the constraints of a value type, a new version of the value type is created. If your value type has no consumers, you can freely change these constraints. However, if you make breaking changes to the constraints and your value type has consumers, we recommend deprecating the current value type and creating a new one instead. This approach avoids potential runtime errors and data inconsistencies.

> When you make non-breaking changes to a value type, a new version is also created. This new version will automatically propagate to the Ontology, ensuring that all uses of the value type across the Ontology are updated to the latest version.

### 4.1 What a version carries

`Value type versions include two parts: metadata and constraints.` — and then the
metadata splits in two:

| field | mutable? | mints a version? |
|---|---|---|
| name | `can be changed whenever necessary` | not stated → no |
| description | `can be changed whenever necessary` | not stated → no |
| apiName | `can be changed whenever necessary` | not stated → no |
| **base type** | `immutable` — and the create modal says `Once saved cannot be modified` (§8.1) | never; it cannot change at all |
| **constraints** | `immutable` within a version | **yes**, explicitly |

The apparent contradiction — constraints are `immutable`, and also `If you choose
to update the constraints… a new version… is created` — resolves to: **immutable
*within a version*; editing them mints the next one.** That is inference, but it
is the only reading under which both sentences are true, and the versioning
screenshot's banner (`You are updating the constraints of this value type`, §8.5)
confirms that updating is a real operation.

**Base type is in a third category.** It is called metadata, it is called
immutable, and the modal greys it after save. It never varies across versions,
which means it belongs on the value type header row, not on the version row.

### 4.2 What bumps a version

Exactly one thing, said twice: a constraint change. Breaking or non-breaking,
`a new version of the value type is created`. The distinction between breaking
and non-breaking changes **what the docs recommend**, not what the system does —
both mint a version.

**Nothing in any of the six pages defines which changes are breaking.** Tightening
a regex, adding an enum value, removing one, narrowing a range: none are
classified. The pages hand the judgement to the author and give a warning banner.
Question 1.

### 4.3 What consumers pin — two different answers for two kinds of consumer

**The Ontology does not pin.**

> This new version will automatically propagate to the Ontology, ensuring that all uses of the value type across the Ontology are updated to the latest version.

Every ontology use tracks latest, automatically. A property therefore stores a
reference to *the value type*, not to a version of it. This is the single most
buildable sentence on the page and it settles the shape of the binding column
(Decision 5).

**Code repositories do pin**, and the proof is in a completely different section —
`functions/resource-imports-sidebar.md`:

> Some resources depend on [value types](/docs/foundry/object-link-types/value-types-overview/) to define the datatypes used to interact with them, for example, function interfaces. For these resources, their value type dependencies are imported into the repository automatically so that they are available to use along with the resource.

> In some cases, importing a combination of such resources can result in a value type dependency conflict. This occurs when different resources have a common value type they depend on at differing versions. It is not possible to have both versions of the same value type imported, and this causes a compilation error. This error is accompanied by a warning in the sidebar, allowing you to view the resources with conflicting dependencies.

`at differing versions` and `both versions of the same value type` only make
sense if an import records a specific version. So: **ontology consumers float,
repository consumers pin, and the pin can conflict.** That asymmetry is not
mentioned on the versioning page at all and would have been invisible without the
corpus sweep.

### 4.4 What a version is *called*

Not stated. Not on any of the six pages, not in `resource-imports-sidebar.md`, not
in any of the 24 files that mention the phrase. No integer, no semver, no
screenshot showing one. Question 2 — and it blocks nothing, because the ontology
side needs only ordering.

### 4.5 What happens to a property bound to an old version

For non-breaking changes: it is updated to the latest, per the quote above. For
breaking changes with consumers, the page **declines to say** — it recommends not
doing it. The versioning screenshot's banner says `might break if their values
are incompatible with the new constraints`, which implies the new version
propagates and the data then fails validation (→ §7, the object type fails to
index). That chain is inference assembled from a screenshot and a different page;
it is not written down anywhere as a sequence. Question 4.

---

## 5 — Binding: how a property uses one

`use-value-type.md` in full, opening typo included:

> Once you have [created a value type](/docs/foundry/object-link-types/create-value-type/), you can use it in as a data type across Foundry. Value types can be supported for the use cases listed below.

> * Assigning a value type to an object type property.
> * Assigning a value type to a shared property.
> * Assigning a value type to a Pipeline Builder pipeline property as a logical type using the `logical type cast` expression and selecting the value type on the property when you write to the objects target.

> To assign a value type to a property, select the value type from the dropdown menu during property configuration.

**Three use cases, enumerated as a closed list** — and the corpus attests at least
three more that this list omits.

### 5.1 The four bindings the corpus attests beyond the list

| binder | attestation | strength |
|---|---|---|
| object type property | `use-value-type.md` list + `value-type-use.png` + `map/integrate-objects.md` | prose + image |
| shared property | `use-value-type.md` list | prose |
| Pipeline Builder pipeline property | `use-value-type.md` list | prose |
| **struct shared property field** | `struct-shared-properties.md` step 3 | prose, one clause |
| **action type parameter** | `ontology/persisted-scenario.md` step 2 | prose, a worked tutorial |
| **interface property** | `interfaces/images/edit-interface-properties.png`, logged in `readings/interfaces-phase.md` §18 | **image only** |
| **object type primary key property** | `ontology/persisted-scenario.md` step 3 | prose, a worked tutorial |

The struct one:

> Configure the base type, value type, visibility, and whether to require values for the property.

The action parameter one, from a tutorial four sections away — and note it lands
in a card called **Constraints**, which is the action-parameter surface, not the
value-type surface:

> Within the **Create Object** action configuration, add an additional parameter of type **String**. In the **Constraints** card, set the value type to **Scenario Reference Value**. Then disable the **Visibility** toggle to hide the parameter from end users.

And the primary-key one, from the same tutorial:

> Once the new object type is created, open the **Properties** tab and confirm that the **Primary Key** property has a value type of **Scenario Reference** assigned to it.

Two distinct value types in one tutorial — `Scenario Reference` on the property and
`Scenario Reference Value` on the parameter — which is itself evidence that the
property side and the parameter side take **different** value types even when they
describe the same datum.

**`action-types/parameter-overview.md` contains the word `constraint` zero times**
(grepped), and no page in `action-types/` mentions value types in the ontology
sense. So the action-parameter binding is attested exactly once, in a tutorial,
and nowhere in the section that owns action parameters. Question 5.

### 5.2 Does the property's base type come from the value type?

**No — the evidence says the property's own type is set first and independently.**
`value-type-use.png` shows, top to bottom: `Type` = `Timestamp`, then
`Allow multiple` (off), then `Value type` = `Values in the past`. The base type
selector sits **above** the value type selector and is a separate control (§8.4).

`struct-shared-properties.md` says the same thing in a different voice by listing
them as two configuration items in one step: `Configure the base type, value
type, visibility…`.

**What is not stated anywhere: whether the dropdown is filtered to value types
whose base type matches the property's.** It plainly must be for the constraint
to be applicable — a Range-on-length constraint cannot run against a Timestamp —
and the screenshot's `Values in the past` is a plausible Timestamp value type.
But no sentence says it and no screenshot shows the dropdown open. Marked as
inference; Decision 6 takes the strict reading anyway.

### 5.3 What binding forecloses

`derived-properties.md`, in a list of conditions:

> * **Value types:** Properties with value types cannot be converted to derived properties.

One property cannot be both. Worth carrying into whatever phase builds derived
properties.

### 5.4 Value types arrive pre-made, from Marketplace

`map/integrate-objects.md` is the only page in the corpus showing a value type
being *consumed* rather than authored, and it shows them shipped as a product:

> These identifiers are configured by attaching a specific [Value Type](/docs/foundry/object-link-types/value-types-overview/) to a property on the object type you want to map.

> To configure boundary identifiers, first search for and install the "Choropleth Value Types" product in Marketplace. This product contains the ontology value types that the map application knows how to render as choropleths.

> If your object type already has a property the contains one of these identifiers, select the corresponding value type in the **Value Type** dropdown menu for that property in Ontology Manager.

Three things this adds. **(a)** The binding dropdown is in **Ontology Manager**,
while creation is in the Value Types Manager — two applications, two surfaces,
confirmed by two independent pages. **(b)** Value types are packageable and
installable, so a space's value types are not necessarily authored in it. **(c)**
A platform application (Map) **branches on the identity of a value type** — the
map knows how to render a property because of *which* value type it carries. That
is the strongest statement in the corpus of what value types are actually for:
they are how an application recognises a datum without knowing the object type.

---

## 6 — Permissions

The whole page is eight lines:

> Permissioning for value types is managed through platform [space](/docs/foundry/platform-security-management/manage-orgs-and-spaces/#spaces). Any value types in a space are automatically imported and made available for the associated ontology. Other consumers can import the value types into their project scopes, similar to how users can import transforms profiles or inputs to pipelines.

> Users who have View (read) permissions to a space can assign value types to property types or shared property types in that space and associated ontology. An Editor or Owner of a space can create, edit, or delete value types in that space.

### 6.1 The role model, and what it maps to

| capability | required on the **space** |
|---|---|
| assign a value type to a property type or shared property type | View (read) |
| create, edit, delete a value type | Editor or Owner |

**There is no per-value-type permission.** No owner, no grant, no ACL on the row
itself — the space is the whole permission surface. That is different from type
groups, which `type-groups.md` puts in a project (logged in
`readings/capabilities-value-types-and-groups.md` §3), and different from every
ontology resource, which inherits project roles.

`security/projects-and-roles.md` corroborates that space-level Editor/Owner is a
real, pre-existing thing rather than loose wording:

> Users need `Editor` or `Owner` permissions on a space to create Projects in that space.

and gives the vocabulary:

> From most powerful to least powerful, the default roles in Foundry are: Owner, Editor, Viewer, and Discoverer.

Note the mismatch: the permissions page writes `View (read) permissions` where the
roles page names the role `Viewer`. I read them as the same thing. Minor, but it
is a naming inconsistency and it is recorded rather than smoothed.

### 6.2 Two distribution mechanisms, not one

> Any value types in a space are automatically imported and made available for the associated ontology.

**Automatic**, one direction, space → its ontology. No opt-in, no import step.

> Other consumers can import the value types into their project scopes, similar to how users can import transforms profiles or inputs to pipelines.

**Manual**, for everyone else, into a *project scope*. This is the same mechanism
`functions/resource-imports-sidebar.md` describes doing automatically for
function interfaces, and it is where version pinning bites (§4.3).

So there are three tiers: **defined in** a space, **automatically available to**
that space's ontology, **importable into** project scopes.

### 6.3 The organizations question

The permissions page never mentions organizations. It does not have to:
`security/orgs-and-spaces.md` makes the space carry them —

> A space is a high-level container of projects, with one common ontology, for work with a common purpose that is shared between a set of organizations. Spaces are restricted by an organization (or set of organizations), and that restriction will apply to the projects in the space as well as the associated ontology.

and `platform-security-management/manage-orgs-and-spaces.md` states it as the
space's first creation setting —

> * **Access requirements:** Users need permission from at least one organization to access this space. Projects in this space can only be visible by organizations in this list.

— so a value type is reachable by exactly the organizations of its space, through
the same inheritance every other space-contained thing gets. **Our
`space_organizations` (migration 397) and `auth_in_ontology` (441) already
express this**; a `value_types.space_id` inherits the whole model with no new
policy logic. That is a happy consequence of Decision 1 and worth stating: the
faithful column is also the cheap one.

---

## 7 — Enforcement: three surfaces, three different failure modes

The overview claims two:

> Value types also enforce their validation constraints on data in Builder pipelines and the ontology, so data integrators and ontology managers can ensure proper semantic typing in their data flows and models.

### 7.1 In the ontology: at **index** time, and it fails the whole object type

> If you apply a value type to an object property that contains property values that fail validation, that object type will fail to index. You can view such index failures in the object type health status in Ontology Manager, where you can correct your data or update your value type to fix the issue.

This is the sentence E4 hangs on, and three things in it are precise:

1. The unit of failure is the **object type**, not the row and not the property.
   One bad value stops the type indexing.
2. The failure is visible in the **object type health status** — the corpus's
   only mention of that surface by name (grepped; the other four hits are about
   data connection and patient care).
3. **Two remedies, symmetric**: correct the data, *or* update the value type.
   The constraint is not sacred; loosening it is an offered fix, and that is the
   operation that mints a version (§4.2).

It aligns exactly with the index gate migration 442 already built — an object
type is live when its index builds — so value type validation is a **new class of
index failure**, not a new mechanism.

### 7.2 In Pipeline Builder: at cast time, and it **nulls** the value

The third use case names the mechanism (`logical type cast`), and Pipeline
Builder's own pages define what that does. `pipeline-builder/functions-index.md`:

> Cast expression to given logical type. Unlike the regular cast expression, this expression will not change the underlying base representation of the data, but rather enforce the constraints associated with the specified logical type, so that the output can be used as the input to downstream expressions which specifically demand an instance of that logical type.

and `pipeline-builder/transforms-geospatial.md`, which is the only page in the
corpus that defines *logical type* as a concept:

> Pipeline Builder models geospatial data internally using the concept of a logical type, which is a base type (string, integer, boolean, array, struct) with additional constraints on the data represented.

> All logical types in Pipeline Builder are inheritors of their base types; for instance, a geometry can be used as input to an expression which expects an input of type string, but not vice versa. To cast from a base type to a particular logical type which extends that base type, you can use the “Logical Type Cast” expression, which will apply the constraints associated with that logical type to the data and null any values which fail this validation.

**A base type with additional constraints on the data represented** is the value
type definition, word for word, arrived at from the geospatial side. And the
failure mode is the opposite of the ontology's: **nulls the value** rather than
failing the build. Same constraints, two enforcement points, two semantics. That
is a genuine finding and it is nowhere in `object-link-types/`.

### 7.3 At action submission: **not attested**

I looked for it specifically, because it is the obvious third place. It is not
there. `use-value-type.md` mentions only indexing; `action-types/` mentions value
types only in two unrelated senses (§9.6).

The contrast that makes the absence meaningful is
`mandatory-control-properties.md`, which spells out all three enforcement points
for a *different* constraint:

> * This constraint is enforced on the object storage level, so even though you may be able to use Ontology Manager to save an object type that violates this constraint, the object type will fail to index if existing values in the dataset do not satisfy the constraints, or if the values in the dataset are updated to include invalid values for the mandatory controls. Also, any edits made that try to set an invalid value to the mandatory control property will be rejected and the Action will fail to submit.

Same page pattern, same failure vocabulary — and it says the action fails to
submit. The value type page had every opportunity to say the same and does not.
**I will not build action-time enforcement on this evidence.** Question 5 asks
the operator; Decision 8 says what E4 does in the meantime.

### 7.4 Save time: explicitly *not* enforced

Also from the mandatory-control quote, and true of the value type page's shape
too: `even though you may be able to use Ontology Manager to save an object type
that violates this constraint`. Validation is not a save-time check. Saving a
value type binding that the data violates is **allowed**; the index then fails.
Any E4 design that rejects the binding at write time is stricter than Foundry.

---

## 8 — What the images add that the prose does not

Five images, and four of them carry at least one field that appears in no
sentence anywhere in the corpus.

### 8.1 `value-type-create-metadata.png` — step 1 of 3

A modal titled `Create new value type`, ✕ at top right, with a **three-step left
rail**: `1 Metadata` (active, blue), `2 Constraints` (grey), `3 Preview` (grey).
Panel heading `Metadata`, subheading, then four controls. Footer: `Close` on the
left, `Next` on the right, rendered pale — i.e. disabled with the form empty.

> Create new value type · 1 Metadata · 2 Constraints · 3 Preview · Metadata · Give your value type a searchable name, description and base type. · Name · Give your value type a unique name · Description · Describe what the value type does · API name · Give your value type an api name to allow references in code · Base type · Once saved cannot be modified · String · Close · Next
> — object-link-types/images/value-type-create-metadata.png

| control | value/placeholder | state |
|---|---|---|
| Name | `Give your value type a unique name` | empty text input |
| Description | `Describe what the value type does` | empty text input |
| API name | `Give your value type an api name to allow references in code` | empty text input |
| Base type | `String` | dropdown, default `String`, prefixed with the `99` quote-mark base-type icon |

**What it adds:**
- **`Base type  Once saved cannot be modified`** — an inline helper beside the
  label. The versioning page calls base type immutable in the abstract; this is
  the UI committing to it at creation, which is what makes it a **header column,
  not a version column**.
- The subheading calls the name **searchable** — value types are searched by
  name, so E4 needs the same lookup affordance the OMA search bar has.
- The API name helper says `to allow references in code`, which is the same
  justification `functions/resource-imports-sidebar.md` gives for API names
  generally. The API name exists for the repository consumer, not the UI one.
- **The wizard has exactly three steps**, and step 2 is singular: `Constraints`
  as a stage name, `Constraint` as the card title (§8.2).
- Default base type is `String`, and the base-type dropdown carries **the same
  icon vocabulary as the property list** (`99` for string) — one icon set across
  two applications.

### 8.2 `value-type-create-constraint.png` — step 2 of 3

Rail now `1 Metadata` (grey, done), `2 Constraints` (blue, active), `3 Preview`
(grey). The panel is a card headed `Constraint` with a **trash icon** at its top
right, then a `Constraint type` radio group in a 2-column grid, then the selected
kind's own controls. A vertical scrollbar is visible at the right edge and a
third list row is cut off at the bottom. Footer: `Close`, `Back`, `Next` (blue,
enabled).

> Create new value type · Metadata · 2 Constraints · Preview · Constraint · Constraint type · RID · UUID · Length · Regex · Enum · Case insensitive · Salmon · Cod · Close · Back · Next
> — object-link-types/images/value-type-create-constraint.png

Radio options, in grid order: `RID` | `UUID`, `Length` | `Regex`, then `Enum`
spanning the full width. `Enum` is selected (filled blue radio, blue border, pale
blue fill). Below it: a `Case insensitive` **toggle**, off. Below that, an
editable list — each row a **drag handle** (⣿), a text input, and an **✕**:
row 1 `Salmon`, row 2 `Cod` (focused, caret visible), row 3 cut off.

**What it adds:**
- **`Length` is the UI name for `Range` on a String base type.** The constraints
  page never uses the word Length; it says `For String properties, the length of
  the string is constrained` under **Range**. Anyone building a UI from the prose
  alone would render a control called Range on a String value type, which is not
  what Foundry shows.
- **Radio buttons, not checkboxes.** One constraint *kind* per card. The prose's
  singular `a constraint` is confirmed at the kind level.
- **The card has a trash icon**, which implies cards are removable and therefore
  possibly addable — the only hint in any source that a value type might carry
  more than one constraint card. Not resolvable from a static image; Question 3.
- **This is the String menu and it has five options** — RID, UUID, Length, Regex,
  Enum — exactly matching §2's String set (Range→Length, Regex, RID, UUID, Enum).
  The menu is base-type-dependent, which the prose implies (`depending on the base
  type`) and this confirms.
- **`Case insensitive` is a toggle, defaulting to OFF** → enum matching is
  **case-sensitive by default**. The prose says only `may optionally be
  case-sensitive or case-insensitive` and gives no default. The image gives it.
- **Enum values are an ordered list** — drag handles exist to reorder, and order
  cannot matter for validation. So order is *display* order, which means it must
  be stored. A `text[]` or a child table with an ordinal, not a `set`.
- The example (`Salmon`, `Cod`) is a domain enum, reinforcing §1's point.

### 8.3 `value-type-create-preview.png` — step 3 of 3

Rail: `1 Metadata`, `2 Constraints` both grey/done, `3 Preview` blue. Panel
heading `Preview`, subheading `Check inputs against your constraints`. One text
input labelled `Value` containing `Salmon` (focused, ✕ clear button). Below,
labelled `Preview`, a result row: `Salmon` on the left, a green pill reading
`Passing validation` and a green ✓ on the right. Footer: `Close`, `Back`,
`Create value type` (blue, enabled).

> Preview · Check inputs against your constraints · Value · Salmon · Preview · Passing validation · Close · Back · Create value type
> — object-link-types/images/value-type-create-preview.png

**What it adds:**
- The prose calls step 7 `Provide an example preview value`, which reads like a
  documentation sample. **The image shows it is a live validator**: you type a
  value and the modal tells you whether your own constraint accepts it. Two
  different features hide behind the same words — a stored example, and a test
  harness.
- **`Passing validation` is a state with a rendered pill**, so a failing state
  exists and is presumably red. Not shown. The failure copy is not attested here;
  §8.5 shows a separate authored `Failure validation message`.
- The final button is `Create value type`, so creation is a single atomic commit
  at the end of the wizard — consistent with `Save your value type.` and with the
  absence of any save-session step.
- Whether the previewed value is *stored* on the value type is not shown. The
  prose says provide an example preview value, which implies stored; the image
  shows a scratch input. Decision 3.

### 8.4 `value-type-use.png` — the binding control

A cropped property configuration panel, three controls stacked:

> Type · Timestamp · Allow multiple · Value type · Values in the past
> — object-link-types/images/value-type-use.png

| control | value | state |
|---|---|---|
| `Type` | `Timestamp` | dropdown, clock icon |
| `Allow multiple` | — | toggle, **off**, with a `?` help bubble |
| `Value type` | `Values in the past` | dropdown, calendar icon, with a `?` help bubble |

**What it adds:**
- **The ordering settles §5.2.** Base type is chosen first, arrayness second,
  value type third. The value type does not supply the type; it qualifies one
  already chosen.
- **A real value type name: `Values in the past`.** A Timestamp with a Range
  constraint bounded above by now — which, note, is a **dynamic** bound the
  Range vocabulary in §2.1 (`A minimum value, maximum value, or range of allowed
  values`) does not obviously express. Either Foundry supports relative bounds,
  or this is a built-in value type outside the documented constraint set. Neither
  is stated. Question 7.
- The value type dropdown has its **own icon** (a calendar), distinct from the
  base type's clock — so value types carry an icon, or icons are derived from the
  constraint. Not stated.
- Both `Allow multiple` and `Value type` have `?` tooltips and `Type` does not,
  which is a small signal that the value type control needs explaining in-product
  and matches how thinly it is documented.
- The image is cropped so tightly that nothing identifies the surrounding
  application. The alt text in the markdown reads `Constraint update warning`,
  which is **the alt text of a different image** — see §9.5.

### 8.5 `value-type-versioning.png` — editing constraints on an existing value type

A constraint editor, scrolled so the top row of radio options is cut off, plus a
grey banner beneath the card.

> Length · Regex · Enum · Minimum size · Maximum size · Failure validation message · Constraint failed
> — object-link-types/images/value-type-versioning.png

> You are updating the constraints of this value type. Resources that depend on this value type (see Usage tab), might break if their values are incompatible with the new constraints. You may want to consider deprecating this value type and create a new one instead
> — object-link-types/images/value-type-versioning.png

Controls: `Length` selected (filled blue radio, blue border), `Regex` beside it,
`Enum` on its own row below — the same grid as §8.2 with the RID/UUID row scrolled
off. Then a bordered sub-card: `Minimum size` **checked**, value `3` in a number
input with stepper arrows; `Maximum size` **unchecked**, its input greyed showing
placeholder `0` with its stepper disabled. Then a second bordered sub-card:
`Failure validation message` with a text input containing `Constraint failed` and
an ✕.

**What it adds — this is the richest image of the five:**
- **`Failure validation message` is a field on the constraint**, author-supplied,
  with a default of `Constraint failed`. **It appears in no sentence in the
  corpus** (grepped). E4 cannot store a constraint faithfully without it.
- **Range is two independent optional bounds**, each with its own checkbox, and
  the unchecked bound's input is disabled. This is `A minimum value, maximum
  value, or range of allowed values` rendered — three states from two checkboxes.
- The bounds are called **`Minimum size` / `Maximum size`** on a String, not
  Minimum/Maximum *value*. Combined with the radio being called `Length`, the
  String flavour of Range is consistently spoken of as a size, never a range.
- **A `Usage tab` exists on a value type.** Named only inside this banner. This
  is the value type's dependents index — the same shape as the object type
  Overview's `Dependents` section logged in
  `readings/capabilities-value-types-and-groups.md` §4. It is also what makes
  `If your value type has no consumers, you can freely change these constraints`
  operable: the author is told to go look.
- The banner is a **warning, not a block** — no disabled Save, no confirmation
  step. `might break`, `You may want to consider`. Foundry lets you do it.
- Number inputs carry **steppers**, so the bound is integral here (a length).

---

## 9 — Corpus cross-checks, contradictions and gaps

### 9.1 Field type or base type? The two definitions disagree

`value-types-overview.md` and `type-reference.md` both say a value type wraps a
**field type** (the 15-name dataset vocabulary: `BOOLEAN`, `BYTE`, `SHORT`,
`INTEGER`, `LONG`, `FLOAT`, `DOUBLE`, `DECIMAL`, `STRING`, `MAP`, `ARRAY`,
`STRUCT`, `BINARY`, `DATE`, `TIMESTAMP`). `create-value-type.md` step 5 says
choose a **base type** and links to `base-types.md`. `value-type-constraints.md`
says **base types** throughout. The create modal's label is **`Base type`**.

These are not the same vocabulary. `base-types.md`:

> **Base types** are used to define properties on objects. The base type of a property determines the set of operations available for that property in user applications. All field types are valid base types except for `Map` and `Binary` types.

So base types = field types − {Map, Binary} + the advanced ontology types
(Vector, Geopoint, Geoshape, Attachment, Time series, Geotemporal series, Media
reference, Cipher text, Struct). Three pages and one screenshot say base type;
two definitional sentences say field type. **Weight of evidence, and the
screenshot, say base type.** Decision 2.

Worth noting what this excludes either way: every base type named in §2's
constraint lists (String, Boolean, Decimal, Double, Float, Integer, Short, Date,
Timestamp, Array, Struct) is in **both** vocabularies. The disagreement is only
about base types with no listed constraint — can you make a value type over
`Geopoint` or `Attachment` with no constraint at all, purely for its semantic
name? Constraints are optional (§1.1), so structurally yes. Unstated.

### 9.2 Value types carry no status, but the docs tell you to deprecate them

`metadata-statuses.md` opens with an enumeration, and value types are not in it:

> Every object type, property, link type, action, or interface in the Ontology has a **status** that indicates developmental state.

Yet `value-types-versions.md` says `we recommend deprecating the current value
type`, and the versioning banner repeats it. **There is no documented deprecation
mechanism for a value type.** Either it has a status field nobody documents, or
"deprecate" here means an informal convention (rename it, stop assigning it).
Question 8.

This also dissolves what would otherwise be a contradiction: `metadata-statuses.md`
says `The API name of an active resource cannot be changed. Changing an API name
is only possible for those marked as `experimental`.` while
`value-types-versions.md` says apiName `can be changed whenever necessary`. Both
are true **if value types are not status-bearing resources** — which the
enumeration above supports. Recorded rather than resolved.

### 9.3 The application is named two ways

`create-value-type.md` step 1 says `Value Types Manager`.
`value-type-constraints.md` says `Value Type Manager`. Two adjacent pages, two
names, no screenshot showing the app's own title bar (all five images are modals
or crops). Trivial for the schema, not trivial for a UI label. Question 9.

### 9.4 The Value Types Manager has no page

There is no mirrored page describing the application: not in `ontology-manager/`
(all 11 files checked), not anywhere else. There is no page describing the
**object type health status** that `use-value-type.md` sends you to, either —
grep returns that one sentence and four unrelated hits. Both surfaces exist only
as references from elsewhere.

Meanwhile value types **do** appear in the Ontology Manager sidebar as a counted
resource, from `readings/home-and-navigation.md` §6.3:

> Value types 45
> — ontology-manager/images/oma-discover-view.png

and at `11` in a second tenant's capture logged in
`readings/compass-branching-and-views.md`. So the resource is listed in OMA while
being authored in a different application — the OMA entry is presumably a
read-only index or a deep link. Not stated anywhere. It is also why
`ontologies/` and `global-branching/` contain **zero** mentions of value types
(grepped): nothing suggests a value type change travels through a branch or a
proposal. See Question 6.

### 9.5 Two images share one alt text

`use-value-type.md` line 13 renders `value-type-use.png` with
the alt text `Constraint update warning`, which is verbatim the alt text carried
by `value-type-versioning.png` on `value-types-versions.md` line 9. A copy-paste in
the source docs. Mentioned because an alt text is sometimes the only label an
image has, and here one of them is wrong — do not treat `use-value-type.md`'s
image as being about constraints.

### 9.6 The phrase is overloaded, and one case is genuinely ambiguous

In `workshop/widgets-metric-card.md`, `workshop/widgets-iframe.md`,
`workshop/object-set-filter-variables.md`, `quiver/cards-vega-plot.md`,
`time-series/time-series-properties-use-case-operational.md` and
`action-types/getting-started.md`, **value type** means the datatype of a widget
input or a variable — `if the value type is set to String, the user will have to
select a string variable`. Unrelated to this reading. Anyone grepping the corpus
for `value type` will hit these first; they outnumber nothing but they do
outweigh in noise.

The one that is not obviously either, from `pipeline-builder/outputs-add-ontology-output.md`:

> Note that to create a policy based on the **Marking or classification** user property, ensure that the value types are set to **Marking** or **Classification**.

`Marking` is a real base type in `properties-overview.md`'s table, and this page
is about writing to an ontology target, so this may be the ontology sense used
loosely for base type. Not settled; it changes nothing in E4.

---

## 10 — The delta against what we have

We have **no** `value_types` table and no binding column. `docs/ONTOLOGY-BUILD-MAP.md`
§E4 sketches:

`value_types(id, space_id, api_name, name, description, base_type, constraint jsonb, version)`

That sketch is right about the two hardest calls — **`space_id`, not
`ontology_id`**, and E4's placement after the index — and it is short in five
places this reading can now fill:

| the sketch | what the pages/images require |
|---|---|
| `version` as a column on the value type | a version is a **thing with parts** (`metadata and constraints`), constraints are immutable *within* one, and name/description/apiName mutate *across* all of them → a header row plus a version row, with base type on the **header** |
| `constraint jsonb` | eight kinds, two of which (**Nested**, **Element constraints**) hold **references to other value types** — a self-edge and, for structs, a keyed map |
| — | **example preview value** (step 7) is missing |
| — | **failure validation message** (image-only, §8.5) is missing |
| attachable to a property or a shared property | the corpus attests **seven** binders (§5.1), three of them outside `use-value-type.md`'s own list |

Everything else the reading needs already exists:

- `spaces` + `space_organizations` (397) and `ontologies.space_id` unique (441) —
  §6.3's inheritance comes free.
- `object_type_properties.base_type` with the 22-value `property_base_types()`
  (408) and `array_element_type` (448) — the value type's own base type draws
  from the same vocabulary, and §5.2 says the property's base type stays where it
  is.
- Migration 442's index gate — §7.1 is a new *class* of index failure, not new
  machinery.
- `ontology_violations()` — the natural home for "this property's value type
  constraint is unsatisfiable against its backing column", which is a
  well-formedness question, not a data question.

**What must not happen:** a `value_type_bindings(entity_kind, entity_id,
value_type_id)` table. Seven binders is exactly the count that makes a universal
table tempting, and it is the fourth version of the mistake CLAUDE.md lists three
times. Each binder gets its own nullable FK.

---

## Decisions I had to make

1. **`value_types.space_id`, not `ontology_id`.** The pages say space five times
   and never say ontology-owned; `ontologies.space_id` is 1:1 so no information
   is lost either way. The tie-breaker is Pipeline Builder — a Builder pipeline
   consumes value types and is not an ontology resource, so an ontology FK could
   not explain the third use case. Cheap side effect: `space_organizations`
   already carries the org access requirement (§6.3).

2. **The type column draws from base types (our 22), not dataset field types.**
   Three pages and the create modal's own label say base type; two definitional
   sentences say field type (§9.1). I went with the majority plus the screenshot.
   If the operator knows otherwise this is a one-line CHECK change.

3. **Store the example preview value as a column on the version row.** Step 7 says
   *provide* one, which implies persistence; the screenshot shows a live
   validator, which does not. I chose stored because the docs call it
   *recommended* and a scratch input cannot be recommended. **Inference — the
   pages do not say it is saved.**

4. **Range bounds as two nullable `numeric` columns plus two nullable
   `timestamptz` columns, with a CHECK that only the pair matching the base type
   is populated.** The alternative — one `text` pair — loses ordering, and jsonb
   loses the CHECK. Range is polymorphic across value/length/size and across
   numeric/Date/Timestamp (§2.1), and I would rather the disjointness be a
   constraint than a convention. Foundry does not describe its storage; this is
   my shape for their semantics.

5. **A binding stores the value type, not a version of it.** Straight from
   `all uses of the value type across the Ontology are updated to the latest
   version` — the ontology floats. Repository-style pinning (§4.3) is real but
   belongs to code repositories, which we do not have.

6. **The binding dropdown filters by base type; the FK does not enforce it.** The
   docs never say the dropdown is filtered (§5.2), but a Length constraint
   against a Timestamp is meaningless. I chose to enforce base-type agreement in
   the **UI query** and to add it as an `ontology_violations()` row rather than a
   database CHECK, because §7.4 shows Foundry lets you save a binding the data
   violates — being stricter than Foundry at write time is the error this project
   keeps making in the other direction.

7. **Enum values as a child table with an ordinal, not `text[]`.** The drag
   handles in §8.2 mean order is authored and therefore meaningful for display.
   An array would work; a child table makes the ordinal explicit and makes the
   per-value edit surface obvious. This is a preference, not a doc requirement.

8. **E4 enforces at index time only.** §7.1 is stated; §7.3 is not, and the
   mandatory-controls page proves Palantir writes the action-submission clause
   when it applies. Building action-time rejection would be inventing a mechanism.
   Recorded so the omission is visible rather than accidental.

9. **A version row per constraint change; metadata edits mutate in place.** The
   page mints a version for constraints explicitly and says name/description/
   apiName change `whenever necessary` with no version language. **Inference**,
   and it is the reading under which both halves of `Value type versions include
   two parts: metadata and constraints` and `The metadata values… can be changed
   whenever necessary` are simultaneously true.

10. **No `status` column on `value_types`.** `metadata-statuses.md`'s enumeration
    excludes them (§9.2). The versioning page's *deprecate* is therefore advice,
    not a state transition, until someone says otherwise. **If I am wrong this is
    additive**, which is why I chose the omission over the invention.

11. **Store the failure validation message on the constraint, defaulting to the
    string in the screenshot.** It exists only as pixels (§8.5) and the default
    shown is `Constraint failed`. I am proposing a column on the strength of one
    image; flagged here because that is exactly the kind of claim that should be
    read before it is built.

---

## Questions I could not answer

1. **What makes a constraint change breaking rather than non-breaking?** —
   `blocks: nothing`. The pages treat the distinction as the author's judgement
   and mint a version either way, so E4 does not need it; a future "warn before
   you tighten" feature does. Searched: all six pages, `resource-imports-sidebar`,
   `grep -rn "breaking" mirror/`.

2. **What is a version identifier?** — `blocks: nothing`. Integer, semver,
   timestamp: unattested. `resource-imports-sidebar` says `at differing versions`
   and shows none. An ordering is all the ontology side needs; I would use a
   monotonic integer per value type and say so in the migration.

3. **Can a value type carry more than one constraint, and does an array's Nested
   rule point at a value type or at a bare constraint?** — `blocks: E4`. The prose
   is singular (`a constraint`, `may optionally define a constraint`), the radio
   group allows one kind, but the card has a **trash icon** implying cards are
   addable. And §2.2 says Nested applies `A value type constraint` while the
   Struct row says `a value type reference` — two different referents, one page.
   This decides whether the schema is one constraint row per version or many, and
   whether the self-edge points at `value_types` or at a constraint row. I did not
   guess. Searched: both wordings across the corpus, all five images.

4. **What actually happens to a bound property when a breaking version lands?** —
   `blocks: E4`. §4.5: non-breaking auto-propagates and breaking is merely
   discouraged. If breaking versions also propagate, every consumer object type
   fails to index at once, and that is a fan-out an implementation must decide
   about. Searched: `value-types-versions.md` whole, the banner image, `grep -rn
   "propagate" mirror/`.

5. **Can an action type parameter bind a value type, officially?** — `blocks:
   nothing now, blocks the action-parameter phase`. `use-value-type.md`'s list of
   three excludes it; `ontology/persisted-scenario.md` step 2 does it in a
   tutorial, in a card called **Constraints**; `action-types/parameter-overview.md`
   does not contain the word constraint at all. One of those pages is behind.
   Searched: every file in `action-types/`, `grep -rn -i "value type" action-types/`.

6. **Do value type changes travel through a branch, a proposal, or the Ontology
   Manager save session?** — `blocks: nothing for E4, blocks any branch work`.
   `Save your value type.` is the whole of step 8; `ontologies/` and
   `global-branching/` mention value types **zero** times; yet OMA lists them as a
   counted resource. Argument from absence, so it stays a question. Searched:
   `ontologies/`, `global-branching/`, `ontology-manager/` (all files),
   `grep -rn -i "value type" ` across the corpus.

7. **Is `Values in the past` expressible in the documented constraint vocabulary?**
   — `blocks: nothing`. §2.1's Range is `A minimum value, maximum value, or range
   of allowed values`, which reads as static bounds; a bound at *now* is dynamic.
   Either relative bounds exist and are undocumented, or built-in value types
   exist outside the constraint set (Marketplace-installed ones, §5.4, are at
   least adjacent). Searched: all six pages, `base-types.md`, `properties-overview.md`,
   `grep -rn "in the past" mirror/`.

8. **Is there a deprecation mechanism for a value type?** — `blocks: nothing`.
   Two sources tell you to deprecate one; `metadata-statuses.md`'s enumeration
   excludes value types from having a status at all (§9.2). Decision 10 omits the
   column on that basis. Searched: `metadata-statuses.md`, `grep -rn -i
   "deprecat" object-link-types/`.

9. **`Value Types Manager` or `Value Type Manager`?** — `blocks: nothing`. Two
   adjacent pages, two spellings (§9.3), no screenshot of the app title. Cosmetic,
   but it is a UI string someone will have to type.

10. **What does the object type health status surface look like?** — `blocks:
    nothing for E4, blocks the health surface`. It is the destination
    `use-value-type.md` names for index failures and it has no page. Searched:
    `grep -rn -i 'health status' mirror/` — five hits, four
    unrelated. `ontology-manager/` has no such file. Would need mirroring, if a
    page exists upstream at all.

---

## 11 — How Foundry enforces kind × base type (read 2026-08-19)

The 2026-08-19 gap run found that `value_type_constraints.kind` is not paired
against `value_types.base_type` in our schema: the table's CHECKs are structural
only, and `mint_value_type_version()` writes caller JSON unchecked, so a `regex`
constraint on an `integer` value type is accepted and silently no-ops at read
time. **Decision 6 below would answer this the wrong way by analogy**, so the
question was taken back to the pages.

### The pairing is published, twice, in two different shapes

> "The available value type constraints, along with what base types they can be applied to, are below:"

with per-kind lists — Enum: "**Valid base types:** String, Boolean, Decimal,
Double, Float, Integer, or Short."; Range: "**Valid base types:** Decimal,
Double, Float, Integer, Short, Date, Timestamp, String, or Array." — and then a
second group written the other way round, from the type rather than the
constraint:

> "Additionally, the following property types have additional type-specific constraints available:"

String gets Regex/RID/UUID, Array gets Uniqueness/Nested, Struct gets Element.
That second framing is the tell: those kinds are **properties of the base type**,
not free choices.

### Foundry enforces it by making the mismatch unrepresentable

`create-value-type` orders the wizard so the base type is chosen *first*:

> "5. Choose a [base type](/docs/foundry/object-link-types/base-types/) for your value type."

> "6. (Optional) Define a constraint for your value type. Validators can be regular expressions for `String` types, enums, ranges, or other validation methods depending on the base type."

**"depending on the base type"** — and the screenshot proves it is the picker
that depends, not the user. For a String value type the Constraint type control
offers exactly five options:

> RID · UUID · Length · Regex · Enum
> — object-link-types/images/value-type-create-constraint.png

`Uniqueness` and `Nested` (Array-only) and `Element` (Struct-only) are **not
rendered at all**. There is no error message for a mismatched pairing anywhere in
the section because **there is no way to author one**.

The same image carries a vocabulary finding worth having: the kind the prose
calls **Range** appears as **Length** when the base type is String — named for
what it constrains, exactly as the prose says ("For String properties, the length
of the string is constrained"). Our token is `range`; a surface should render it
per base type rather than showing the API word.

### And the mistake would be permanent

> "The base type metadata and the constraints that define the validation rules for the type are immutable."

A constraint cannot be edited once its version exists — only superseded by a new
version. So a malformed constraint minted into version 3 is version 3's forever.

## Decisions from §11

1. **This is the opposite case to Decision 6, and the difference is which
   surface authors it.** Decision 6 is about a *property binding to* a value
   type, where §7.4 shows Foundry lets you save a binding the data violates — so
   a CHECK there would be stricter than Foundry, and the reasoning holds. §11 is
   about a value type's **own internal coherence**, where Foundry is not
   permissive at all: it simply never offers the invalid pairing. Reading
   Decision 6 as precedent for both would enforce the case Foundry allows and
   permit the case Foundry forbids — precisely backwards.
2. **Foundry's enforcement point is its only authoring surface; ours must be
   ours.** Their guarantee is that the picker cannot express it. We have no picker
   in the trust path — `mint_value_type_version()` takes caller JSON, and the
   generated client is not the only writer. A database trigger is not us being
   stricter than Foundry; it is the same guarantee at the layer where our
   authoring actually happens.
3. **`ontology_violations()` is the weaker answer here, and the immutability is
   why.** A lint that reports "version 3 is malformed" leaves nothing to do about
   version 3. Linting fits content that can be corrected; this cannot be.
4. **A CHECK cannot do it** — the pairing spans two tables (`value_type_constraints`
   → `value_types.base_type`), so the rule-placement ladder's first rung is
   unavailable and a trigger is the first that works.
5. **BUILT (575).** `value_type_constraint_base_types(kind)` carries the
   published pairing and a trigger on `value_type_constraints` enforces it, so
   the mismatch is refused at the table rather than merely absent from a picker
   we do not have.

   **`long` and `byte` are deliberately excluded from enum and range.** Both look
   numeric and the page lists neither. Adding them because they seem to belong
   would be inventing a pairing, which is the failure this repo is organised
   around — so a test asserts they are refused, and the exclusion is a decision
   rather than an oversight.

   **The audit that came with it: production held zero constraints.** The guard
   lands before anything could accumulate under the lax path, so there is no
   backlog of malformed immutable versions to correct — which was the whole
   worry, and it is now closed rather than merely bounded.

   `valueTypeConstraints.test.ts` drives the published pairing off the function
   itself, so the assertions cannot drift from the rule, and separately asserts
   that every kind in the CHECK vocabulary *has* a published list — a ninth kind
   added without one would otherwise make the trigger refuse that kind entirely,
   silently.

## Questions from §11

1. **What are the valid base types for the second group?** The page states them
   for Enum and Range explicitly, but Regex/RID/UUID are given as "String" and
   Uniqueness/Nested as "Array" only through the heading they sit under. Struct
   for Element likewise. That is clear enough to build, and it is a heading
   rather than a sentence. `blocks: nothing` — recorded so the source of each
   pairing is known when the trigger is written.
2. **Does a `nested` constraint's referenced value type have to match the array's
   element type?** "A value type constraint can be applied to the elements of the
   array" says the constraint applies; it does not say the referenced type's base
   type must equal the element type. `blocks:` how strict the trigger is about
   the self-edge.
