---
verify: strict
---

# Reading — interfaces (the whole section, ten pages)

**Pages read in full (10/10):** `interfaces/_index.md`, `interfaces/interface-overview.md`,
`interfaces/create-interface.md`, `interfaces/implement-interface.md`,
`interfaces/extend-interface.md`, `interfaces/interface-metadata.md`,
`interfaces/edit-interface-definition.md`, `interfaces/edit-interface-implementation.md`,
`interfaces/interface-link-types-overview.md`, `interfaces/interface-action-type-constraints.md`.

`_index.md` and `interface-overview.md` are byte-identical (`diff` clean, 59 lines
each). That is the seventh time this corpus has done it — `ontology-manager-save-session.md`
logged the same for its own section. **Nine distinct pages, not ten.**

**Images read (32/32):** every file in `interfaces/images/`. Inventory in §11.

**Sublinks followed and read:** `object-link-types/shared-property-overview`,
`object-link-types/shared-property-metadata`, `object-link-types/metadata-statuses`,
`object-link-types/object-type-metadata`, `object-permissioning/ontology-permissions-legacy`
(head), `ontology-manager/migrate-to-project-based-permissions` (head),
`ontology/ontology-structural-guidance` §Interfaces, `ontology/core-concepts`,
`ontology-manager/navigation`.

**Read, and nothing below quotes them:** `object-link-types/property-metadata`,
`object-link-types/link-type-metadata`, `ontologies/ontologies-overview`,
`getting-started/foundry-platform-summary-llm` §Interfaces. They are the
surrounding metadata pages — what a property and a link type carry, and how the
platform summarises the ontology — read to place interfaces among them, and no
decision in this reading rests on a sentence of theirs.

**Sublinks named but NOT read:** `marketplace/overview` (**not in the mirror**),
`action-types/actions-on-interfaces` (**was not in the mirror when this was
written; mirrored 2026-08-11 and now read** — see
`readings/actions-on-interfaces.md`, which answers question 6 below and
corrects the guess in it),
`functions/overview`, `ontology-sdk/overview`, `workshop/overview`,
`object-backend/overview` (grepped: contains no occurrence of the word interface),
`pipeline-builder/outputs-add-ontology-output`, `platform-overview/development-life-cycle`,
`object-link-types/metadata-typeclasses`, `object-link-types/metadata-render-hints`
(both exist in the mirror; read previously in `capabilities-typeclasses-and-branching.md`).

---

## 1. What an interface is

> An **interface** is an Ontology type that describes the shape of an object type and its capabilities.

It is a *type*, sibling to object types and link types in the ontology's resource
list — `ontologies/ontologies-overview.md` enumerates object types, link types,
action types, interfaces, shared properties and object type groups as the things
an ontology stores.

The functional definition is the one to build from:

> Object types are concrete; they have schemas defined by shared or local properties, are backed by datasets containing property values, and can be instantiated as objects.

> By contrast, interfaces are abstract; they have schemas defined by interface properties, are not backed by datasets, and cannot be instantiated directly but must be instantiated as a specific object type.

**No datasource.** This is the one place in the ontology where the "what backs
it?" question in `CLAUDE.md` has the answer *nothing*, and the page says so
explicitly. An interface has no datasource, no backing column, no branch.

Composition, from the same page:

> An interface is composed of interface properties, link type constraints, action type constraints, and metadata about the interface.

That is a four-part structure and it is the spine of this reading: **properties
(§3), link type constraints (§5), action type constraints (§6), metadata (§2)** —
plus extensions (§4), which the sentence omits but the next paragraph adds.

> An interface can be implemented by multiple object types.

> Object types can implement multiple interfaces, for use in different workflows.

Many-to-many, both directions. Our junction table is right about that much.

Why it exists, in the platform's own words:

> By using the `Facility` interface, workflows can interact with `Airport`, `Manufacturing Plant`, and `Maintenance Hangar` object types, either in aggregate or independently, without needing to know specific details about those object types.

`ontology/ontology-structural-guidance.md` adds the design vocabulary the
interfaces section itself never defines (see §9.3 — this matters, because
`extend-interface.md` links two undefined terms):

> **Design interfaces around capabilities or taxonomy:** Capability interfaces may include `Inspectable`, `Schedulable`, or `Billable`. Taxonomic interfaces may include `MilitaryAsset` or `MedicalDevice`.

### 1.1 The icon is dashed, and that is a rendering rule

> Stylistically, interfaces are visually distinguished from object types in the platform by having dashed lines around their icons.

Confirmed in roughly twenty of the thirty-two screenshots — every one in which an
interface icon appears at all. It is a *presentation* rule applied to whatever
icon the interface carries, not a stored value: `create-interface-metadata.png`
shows the icon *picker* already drawn with the dashed border before any icon is
chosen.

---

## 2. Metadata: the seven fields, and the one our table has that Foundry does not

`interface-metadata.md` is 14 lines and exhaustive by its own framing:

> An interface is represented in the Ontology by the following metadata:

| # | Field | The sentence |
|---|---|---|
| 1 | **RID** | > **RID:** An automatically generated unique identifier for every resource in Palantir. An interface’s RID will be referenced in error messages across the platform. |
| 2 | **Icon** | > **Icon:** A picture and color used as a visual identifier that will appear in applications when a user views this interface. |
| 3 | **Display name** | > **Display name:** The name shown to anyone accessing this interface in user applications. |
| 4 | **Description** | > **Description:** Explanatory text about the interface that anyone can read in user applications. |
| 5 | **API name** | > **API name:** The name used when referring to the interface programmatically in code. |
| 6 | **Status** | > **Status:** A signal to users and Ontology builders about where in the development process the interface stands. |
| 7 | **Searchable** | > **Searchable:** A boolean value that specifies whether the interface is searchable. |

Two of these are *not* on our `ontology_interfaces` table: **icon** and
**searchable**. One thing on our table is not in this list: **visibility**.

That absence is meaningful rather than an oversight of the page, because the
parallel metadata references *do* carry visibility and word it identically:

From `object-link-types/object-type-metadata.md`:

> **Visibility:** An indication to user applications for how prominently to display the object type. A `prominent` object type will lead applications to show this object type first to users.

From `object-link-types/shared-property-metadata.md`:

> **Visibility:** An indication to user applications for how prominently to display the property. A `prominent` property will lead applications to show this property first to users. A `hidden` property will not appear in user applications. By default, the `start date` property will have `normal` visibility.

The interface metadata page has no such bullet, and `searchable` — which no other
metadata reference has — occupies the slot where visibility would sit. Interface
**properties** do have visibility (§3.2). The **interface itself** does not.

### 2.1 Icon

> A picture and color used as a visual identifier that will appear in applications when a user views this interface. Interfaces have dashed lines around their icons to visually distinguish them from object type icons.

Same two-part shape as an object type's icon (glyph + colour). The creation wizard
puts the icon picker immediately left of the display name field
(`create-interface-metadata.png`), so it is authored at creation, not later.

### 2.2 Status — four values for an interface, not five

`interface-metadata.md`:

> It can be `active`, `experimental`, `example`, or `deprecated`. By default, the `Facility` interface will have the `experimental` status.

`object-link-types/metadata-statuses.md` confirms both halves of the question
asked of this reading — `example` is in, `promoted` is out, and the exclusion is
stated as a rule rather than implied by omission:

> Every object type, property, link type, action, or interface in the Ontology has a **status** that indicates developmental state.

> * **Scope:** The `promoted` status applies only to object types. It is not available for properties, link types, action types or interfaces.

> **Example:** Indicates that the resource has been installed as an example. Example resources are notional and are only suitable for trainings or early-stage, exploratory use.

And the consequences of `active` apply to interfaces too, since the first
sentence names interfaces as status-bearing resources:

> * It cannot be deleted. A resource’s status must be `experimental` or `deprecated` before it can be deleted.
> * The API name of an active resource cannot be changed. Changing an API name is only possible for those marked as `experimental`.

Deprecation carries three further fields:

> * A description for why it is being deprecated;
> * A deadline for when it is expected to be deleted from the system; and
> * The resource that is meant to replace the one that is deprecated.

Our `deprecation_*` columns already match this. Our migration 438 widened status
to five values; **an interface must be checked against four.**

### 2.3 Searchable — the exact sentence, and what flips

> **Searchable:** A boolean value that specifies whether the interface is searchable. Searchable interfaces enable users to load or search all objects of the interface at once. Searchable interfaces are limited to 50 implementing object types, whereas non-searchable interfaces are limited to 1,000. By default, the `Facility` interface will be searchable.

That sentence is unique in the corpus — I grepped `50 implementing` and `1,000`
across all 1,184 pages and this is the only interface hit.

What flips when `searchable` goes false: users lose the ability to load or search
all objects of the interface at once, and the ceiling on implementing object
types rises from 50 to 1,000. The page does **not** say what happens at the
boundary (see Q5). Note the direction is counter-intuitive and worth stating
plainly: **searchable is the more expensive setting, so it is the more limited
one.** The default is `true`.

`implement-select-interface.png` and `implement-from-object-type.png` show an
interface literally named `OSS Interface Type (Large)` in the picker, which is
the Object Set Service's own scale-test fixture. Inference, not prose: the limits
are Object Set Service indexing limits.

### 2.4 API name — prose and screenshots disagree on casing

> For example, the API name of the `Facility` interface may be `facility`.

Both screenshots that show the field contain `Facility`:
`create-interface-metadata.png` (the API name input) and
`implement-from-object-type.png` (the picker's detail pane, `API Name / Facility`).
Compare `object-link-types/object-type-metadata.md`, which says the API name of
`Employee` may be `Employee`. See Q9 and D11.

### 2.5 Permissions — the page cites a model its own target page calls replaced

> Interfaces are permissioned through Ontology roles.

The linked page opens by retiring that model:

From `object-permissioning/ontology-permissions-legacy.md`:

> Ontology resources (object types, action types, link types, shared properties, and interfaces) can be regular project resources managed through the Compass filesystem.. This replaces the previous ontology roles and datasource-derived permission models.

From `ontology-manager/migrate-to-project-based-permissions.md`:

> Ontology resources, including object types, action types, link types, interfaces, and shared properties, can be saved within specific projects and automatically inherit permissions from those projects.

And `create-interface.md` step 6 is already the project-based flow:

> Select a project to save this interface to, then select **Create**.

**Resolution: the interfaces overview is stale.** An interface is a project
resource. This matches what we already do for object types.

---

## 3. The interface property

### 3.1 Local versus shared — two lists, not one field

> Interface properties can be defined locally on the interface (recommended) or using shared properties.

> Add properties to your interface. You can define properties locally on the interface (recommended) or use shared properties. For each property, choose whether it is **required** or **optional**.

The wizard renders these as **two separate, independently-headed sections**:

> Interface properties  ·  Recommended  ·  + Add property
> Shared properties  ·  + Add shared property
> — interfaces/images/create-interface-choose-properties.png

and the editor keeps the same split behind two buttons:

> Properties 4  ·  + New property  Recommended  ·  + Add shared properties
> — interfaces/images/edit-interface-properties.png

`edit-interface-definition.md` documents them as two separate procedures — a
`## Add new properties` section that opens a full configuration side panel, and a
one-line `## Add shared properties`:

> From the **Properties** tab of the interface configuration, select **Add shared properties** and choose a shared property to add to the interface.

**What is stored differs by case.** For a local property the interface owns every
field in §3.2. For a shared property the interface owns a *reference*: the
shared property already carries its own name, description, base type, RID, type
classes, render hints and visibility (`shared-property-metadata.md`), and the
shared property's own metadata page lists **Usage** — the object types on which
it is used — as one of its fields. The "Add shared properties" flow has no
configuration panel because there is nothing local to configure.

The glyph that distinguishes them is documented, in a different section —
`object-link-types/shared-property-overview.md`:

> Shared properties on objects are denoted with a globe icon next to their name.

That resolves a puzzle running through the screenshots. Every interface property
in the **older** captures carries a globe — `interface-example.png`,
`implement-from-interface-overview.png`, `confirm-extension.png`,
`remove-interface-extension.png`, `remove-interface-implementation.png`,
`update-interface-implementation-mapping.png`. Every interface property in the
**newest** capture — `edit-interface-properties.png`, the one with the
Optionality and Visibility columns — carries **no globe at all**. Inference,
clearly marked: the older model had only shared-property-backed interface
properties, and local interface properties are the newer addition that the
"(recommended)" parenthetical is recommending. The prose in
`implement-interface.md`'s Pipeline Builder half and in
`create-interface-about.png` still speaks only of shared properties, which is
consistent with that reading.

### 3.2 What one interface property carries

Prose (`edit-interface-definition.md`) gives seven configuration clusters:

> 1. **Display name and description:** Select into the existing display name or description to edit the text.
> 2. **API name:** Select into the existing API name to change its value.
> 3. **Property base type:** Select the property’s base type from the dropdown menu. The type of the property constrains the possible set of operations that can be done on the property’s values.

> 4. **Primary key constraint:** Indicate whether a property should be a primary key or cannot be a primary key.

> 5. **Type classes:** Apply type classes as additional metadata that can be interpreted by applications.

> 6. **Render hints:** Improve how a property value is rendered and indexed into Object Storage v1 (Phonograph) by selecting render hints from the checklist.

> 7. **Visibility:** Select the existing visibility to open a dropdown menu of available visibilities. A `prominent` property will lead applications to show this property first to users. A `hidden` property will not appear in user applications.

The side panel in `edit-interface-properties.png` adds **five fields the prose
never names**, and shows the panel is tabbed:

> General · Display · Interaction
> Overview — Name · Description (optional) · Base type · Allow multiple · Value type (optional) · API name · Require values
> Configuration — Optionality · Primary key constraint · ◯ Must be a primary key
> RID  Set on save
> — interfaces/images/edit-interface-properties.png

New from the image: **Allow multiple** (a toggle), **Value type (optional)** (a
picker — our `capabilities-value-types-and-groups.md` reading covers what those
are), **Require values** (a toggle with its own gear), **Optionality** as a named
field inside a `Configuration` group, and a **per-property RID** that reads
`Set on save`. The three tabs also explain where clusters 5 and 6 live: type
classes and render hints are not on `General`, so they are behind `Display` or
`Interaction` (Q8).

The list view carries three columns and a gear:

> Name · Optionality · Visibility
> Facility Identifier — Required — 👁 Normal
> Facility name — Optional — 👁 Normal
> Latitude — Optional — 👁 Normal
> Longitude — Optional — 👁 Normal
> — interfaces/images/edit-interface-properties.png

`Normal` is the third visibility value; the prose names only `prominent` and
`hidden`. The API name in the panel is `facilityName` — camelCase, matching
`property-metadata.md`'s `startDate` example.

Removal is scoped, not destructive:

> ⊖ Remove from interface
> — interfaces/images/remove-property-from-interface.png

### 3.3 Required versus optional — what each means for an implementer

The definition is on `create-interface.md` and it is the tightest sentence in the
section:

> For **required** properties, any object type that implements the interface must provide a mapping from a local property to the interface property. For **optional** properties, mapping may be skipped during implementation. Optional properties can be useful when building Marketplace packages to iterate on your interface without introducing upgrade blockers that may be difficult to resolve.

Restated from the implementer's side:

> If an interface property is marked as **optional**, mapping may be skipped.

So requiredness is a property of the **interface property**, not of the
implementation, and it governs exactly one thing: whether the implementation's
mapping row may be absent. The control is a two-value dropdown per row
(`Required` / `Optional`) in both the wizard and the editor — never a checkbox,
never tri-state.

Note the display convention: on the interface **overview** card, optional
properties get an `Optional` chip and required ones get no chip at all
(`implement-from-interface-overview.png`). Required is the unmarked default in
display; in the wizard the first added property came up `Required`.

---

## 4. Extensions

> Extending an interface allows you to compose interfaces together, creating a new, more specific interface.

> An interface inherits the shared properties, link type constraints, and action type constraints of the interface it extends. An interface can extend any number of other interfaces.

> Interfaces can also extend multiple other interfaces, including interfaces that themselves extend other interfaces, resulting in properties that are inherited through layers of interfaces.

So: **multiple inheritance, transitive, unbounded in breadth and depth.** Three
kinds of thing are inherited — properties, link type constraints, action type
constraints — which is the same three-part list as the definition of an interface
minus metadata. Metadata is not inherited.

`interface-action-type-constraints.md` states the implementer's obligation for
inherited constraints, and it is the only page that does:

> If a child interface extends a base interface with action type constraints, object types implementing the child interface must satisfy the inherited required action type constraints as well as any constraints declared directly on the child interface.

The confirmation dialog is a *preview of what will be added*:

> Extending **Schedulable Event** will add the following shared properties to this interface by inheriting from the extended interface:
> Inherited properties (2) — Start Time · End time
> — interfaces/images/confirm-extension.png

Removal is symmetric and total:

> This action will remove all inherited shared properties from the interface, remove all inherited link type constraints, remove all inherited action type constraints, and disassociate the extending interface from the base interface.

The extension list keeps the inherited set visible and attributed to its source
interface, which is the strongest evidence available that inheritance is **by
reference and not by copy**:

> Extensions (1) — ▾ Schedulable Event — Inherited properties (2) — Start Time · End time
> … Remove extension · View Interface ↗
> — interfaces/images/remove-interface-extension.png

**Silent on three things** (Q2, Q3, Q4): cycles are never mentioned; overriding
an inherited property is never mentioned; and what happens to an implementer when
a *parent* interface gains a required property is covered only obliquely by the
breaking-changes callout, which speaks of "this interface" (§8).

---

## 5. Link type constraints

> An interface link type constraint defines an object-to-object relationship common across all object types implementing an interface.

> When an object implements an interface with an interface link type constraint, concrete link types on the object type are used to fulfill interface link type constraints.

The parameter list (prose):

> * **Link target type:** An interface or an object type.
> * **Target:** A specific interface or object type.
> * **Cardinality:** One-to-one or one-to-many.
> * Whether or not the link is required as part of object type implementation.

The modal gives the same four plus the two name fields, grouped into three
sections — and this is the field list to build from:

> Link type constraint
> **Settings** — Link target: *What would you like to link this Interface to?* [Interface | **Object type**✓] · Target Object Type: *Which Object Type would you like to link to?* [Airline · Experimental] · Cardinality: *How many of the instances of the link target does this interface link to?* [ONE | **MANY**✓]
> **Metadata** — Display name: *Give this constraint a name for the other side of the link* [Airlines] · API name: *The API name is how this constraint will be referred to in code* [airlines]
> **Requiredness** — Required: *Object types will not be able to Implement this interface unless a link type that satisfies this constraint is provided.* [toggle off]
> — interfaces/images/create-link-type-constraint-modal.png

Two live previews in the same modal, which tell us what the fields *mean*:

> One [Facility] has many Airlines
> facility.airlines.all()
> — interfaces/images/create-link-type-constraint-modal.png

**A link type constraint has one named end, not two.** The display name names the
far end of the link — the modal's own help text says so — and the API name
resolves as a traversal *from* the interface: `facility.airlines.all()`. This is the asymmetric half of the link
model our `link_types` table carries as two sides. Note also that the prose says

> Users can specify a description for the link and an API name for the link type to use as a reference in code.

but the modal has **no description field** — it has Display name and API name.
Logged as a contradiction (§10.4).

### 5.1 Target kind: interface

> You should use a link target of type `interface` when you want to model the relationship between two abstract object types.

> Instead, you can model this relationship by defining a `Facility` interface, an `Alert` interface, and an interface link on `Facility` that is set to link to the `Alert` interface. You can then define an `Airport` object type that implements the `Facility` interface and a `Flight Alert` object that implements the `Alert` interface. From there, you can define a concrete link type from `Airport` to `Flight Alert` to satisfy the `Facility` interface’s link type constraint.

That worked example is the whole satisfaction rule for the interface-target case:
the concrete link's far end must be *an object type implementing the target
interface*, not the interface itself.

### 5.2 Target kind: object type

> You should use a link target of type `object type` when the relationship between the interface and the target is concrete and the specificity should be enforced by the link type constraint.

`interface-example.png` shows both kinds on one interface, distinguished only by
whether the target's icon is dashed — `Airlines` solid (object type),
`Facility Manager` dashed (interface) — with different connector glyphs for the
two cardinalities. No sentence anywhere says the list view distinguishes them.

### 5.3 Cardinality

> Interface link types can further be specified to have a `ONE` or `MANY` cardinality. These cardinalities are analogous to one-to-one and one-to-many modeling, respectively. A `ONE` cardinality indicates that each object implementing the interface should link to one object of the target type. A `MANY` cardinality indicates that each object implementing the interface may link to any number of objects of the target type.

The vocabulary is `ONE` / `MANY` (buttons in the modal confirm), **except** that
the next paragraph slips:

> you may want to model the relationship between a `Driver's License` and a `Person` as a `SINGLE` cardinality link

`SINGLE` appears nowhere else and there is no third button. Treated as a typo for
`ONE` (§10.5).

Note the modelling advice is stated as guidance, not derivation — cardinality here
is a *constraint the interface asserts*, and the implementing link type must
satisfy it; the docs never say the concrete link's own cardinality must equal it
(Q10).

---

## 6. Action type constraints (beta)

> Interface action type constraints are in the beta phase of development and may not be available on your enrollment. Functionality and platform support may change during active development.

> An interface action type constraint defines an expected action capability common across object types that implement an interface. The constraint describes the action's user-facing meaning, API name, and parameter shape. Each implementing object type can then map the constraint to a concrete action type on that object type.

The worked example is the clearest statement of intent in the section:

> For example, a `Ticket` interface defines a `Create ticket` action type constraint. The `Bug` object type satisfies that constraint with a `Create bug` action type, and the `Feature request` object type satisfies it with a `Create feature request` action type. Both action types implement the same interface-level capability, even though the concrete action logic is specific to each object type.

Hard boundary on what a constraint is *not*:

> Interface action type constraints do not define action execution logic, submission criteria, side effects, or form layout. To configure those behaviors, do so on the concrete action types that satisfy the constraint.

> Currently, action type constraints have limited expressiveness for describing how the satisfying action type must behave. Use the constraint description to inform application builders what the satisfying action type is meant to do, including expected edits, side effects, submission behavior, or other semantic requirements that are not enforced by the constraint model.

**The description is load-bearing prose, deliberately unenforced.** That is a
design statement, and it means our build must not attempt to derive behaviour
from a constraint.

### 6.1 What is stored on the constraint

> * **Display name:** The user-facing name for the action type constraint.
> * **Description:** A user-readable description of what the satisfying action type should do.
> * **API name:** The API name used to refer to the constraint in code and platform configuration.
> * **Parameter constraints:** The parameters that a satisfying action type must expose.
> * Whether the action type constraint is required as part of object type implementation.

> If an action type constraint is required, every object type implementing the interface must map the constraint to a concrete action type. Optional action type constraints can be mapped when an implementing object type supports the capability, but can be skipped when the capability does not apply.

The dialog confirms the grouping and supplies the field help text:

> Action type constraint
> **Parameter configuration** — columns: Type · Single/List · Name · API name · Required · ✕
> **Metadata** — Display name: *The name for this action type constraint* [Create Ticket] · Description: *Provide a user-readable description explaining the functionality of the action type* · API name: *The API name is how this constraint will be referred to in code* [createTicket]
> **Requiredness** — Required: *Whether implementing object types must define an action type that satisfies this constraint* [toggle off]
> — interfaces/images/iatc-config-dialog-set.png

Same three-section shape as the link type constraint modal — Settings/Parameter
configuration, Metadata, Requiredness — and the same off-by-default toggle.

### 6.2 Parameter constraints

> Parameter constraints define the shape of the action parameters that satisfying action types must provide. Each parameter constraint includes:
> * **Type:** The parameter type, such as string, timestamp, object reference, interface reference, object set, attachment, media reference, or struct.
> * **Single or list value:** Whether the parameter accepts one value or a list of values.
> * **Display name:** The user-facing name for the parameter constraint.
> * **API name:** The API name used to refer to the parameter constraint.
> * Whether the parameter must be mapped by implementing object types.

Note `interface reference` in that type list — **an action parameter can be typed
by an interface**, which is a second query-target-like use of an interface
alongside object sets (§7.5).

Two authoring paths:

> When you create a parameter constraint, you can define a new parameter manually or add parameters from existing interface properties. Adding parameters from interface properties creates parameter constraints based on the selected properties' display names, types, and required status. The parameter API names are generated from the display names and can be edited.

The image shows the menu and, crucially, a bulk affordance the prose omits:

> Add parameter → Existing properties… ▸ [Ticket ID · Created At · Subject · Status · Created By] · **Add all properties** · Create new
> — interfaces/images/iatc-config-dialog-properties.png

Mapping rules:

> Required parameter constraints must be mapped to required parameters on the concrete action type. Where useful, you can map optional parameter constraints. Note that the same concrete action parameter cannot satisfy multiple parameter constraints on the same action type constraint.

> For object reference, interface reference, object set, and struct parameters, interface action type constraints describe the general parameter kind rather than every concrete implementation detail. For example, an object reference parameter constraint requires a compatible object reference parameter on the satisfying action type, but the constraint does not itself bind to one specific object type.

**Compatibility is by kind, not by identity** for the four reference-ish types.

### 6.3 Satisfaction and validation

> A concrete action type satisfies a constraint when it has compatible parameters for the constraint's required parameters.

> Ontology Manager validates action type constraint mappings when you save changes to the Ontology. You will not be allowed to save if:
> * A required action type constraint is not mapped by an implementing object type.
> * A required parameter constraint is not mapped.
> * A mapped parameter has an incompatible parameter type.
> * The same concrete action parameter is mapped to more than one parameter constraint.
> * The mapped action type constraint or parameter constraint no longer exists.

Five named save-blocking conditions — the most enumerable validation spec in the
whole interfaces section, and the fifth one ("no longer exists") is a dangling-
reference check that only makes sense if mappings are stored by reference.

### 6.4 Required versus optional, as guidance

> Use a required action type constraint when every object type implementing the interface must support the capability for interface-based applications to work correctly.

> Use an optional action type constraint when the capability is useful but not universal. Optional constraints are also useful while iterating on a beta interface model, because they let object types adopt the capability without blocking implementations that are not ready to support it.

> For parameter constraints, mark a parameter as required only when every satisfying action type must expose that parameter as a required action input. Keep parameter constraints optional when implementations may compute the value internally, use a default value, or not need the value at all.

### 6.5 Limitations that bound the build

> Interface action type constraints are currently configured and mapped in Ontology Manager. Pipeline Builder does not currently support action type constraint mapping when implementing an interface.

> End users cannot currently discover or invoke interface action type constraints from Foundry applications. Users can run the satisfying concrete action types directly through any application that supports them.

> Interface action type constraints are not currently supported in the Ontology SDK. You cannot currently use an interface action type constraint in OSDK to discover or invoke the concrete action types that satisfy it.

> Interface action type constraints define the expected shape of a concrete action type. They do not make object-type-specific action logic uniform. Review each satisfying action type's rules, submission criteria, permissions, and side effects to ensure they match the semantics described by the interface constraint.

**A constraint is authoring-time metadata with no runtime.** Nothing invokes it.

---

## 7. Implementing an interface

### 7.1 What conformance means

> Once defined, an interface can be implemented by any object type that conforms to the interface definition. This means that object types must have properties that satisfy the interface's required properties, links that satisfy all required link type constraints, and action types that satisfy all required action type constraints defined on the interface.

Three obligations, all scoped to *required*. Our trigger checks the first only,
and by name-matching.

What the declaration buys:

> * Object Set Service searches against the interface will return matching objects of the implementing object type.
> * Objects of the implementing object type can be interacted with using both their local API names when typed as the concrete object type and the interface API names for properties and links when typed as the interface type.

> In short, implementing an interface allows application consumers to interact with any and all implementing objects through the interface definition.

**Two API surfaces over one stored row.** The object keeps its own property API
names, and gains the interface's names when viewed as the interface. Our mapping
table is what would make that translation possible.

### 7.2 The property mapping — this is the answer to "what exactly is declared"

Prose:

> To implement an interface, an object type must declare a mapping of existing object properties onto the required interface properties. If an interface property is marked as **optional**, mapping may be skipped.

That sentence, taken alone, says a mapping targets an *existing* property. **The
screenshot says otherwise, and this is the single most important thing this
reading found.** The per-row dropdown offers five options in three groups:

> Skip
> **Implement a new property** — Choose backing column ▸ · Create edit-only property
> **Choose from existing property list** — Choose existing ▸ (*Choose an existing property to fulfill this shared property*) · Replace existing ▸ (*Replace an existing property with this shared property*)
> — interfaces/images/implement-map-properties.png

So the legal mappings per required interface property are:

| Option | What it does |
|---|---|
| Choose existing | point the interface property at a property the object type already has |
| Replace existing | swap an existing local property *for* the interface's shared property |
| Choose backing column | create a new property on the object type, sourced from a datasource column |
| Create edit-only property | create a new property with no backing column |
| Skip | permitted only where the interface property is optional |

A satisfied row renders as `Fulfilled by Factory Id` with a check; unmapped rows
carry a red marker. The panel copy states the two-branch version:

> To implement the interface to this object type, map a shared property to an existing property or replace with the shared property itself. Optional properties can be mapped at your discretion.
> — interfaces/images/implement-map-properties.png

`Create edit-only property` connects directly to `create-object-type.md`'s
finding that a property's source may be user input rather than a column — the
same two sources, offered here.

### 7.3 The link and action mappings

> If any required link type constraints are declared on the interface, you must select a link type on the object type that satisfies each required link type constraint. You can also optionally provide a link mapping for any non-required link type constraints. You can choose an existing link type or create a new one to satisfy each constraint.

The wizard step confirms a third option the sentence omits:

> STEP 4 · Satisfy link type constraints · *Choose link types that satisfy the link type constraints on the interface*
> Select link type ▸ · Create new link type · Skip
> — interfaces/images/implement-link-type-constraint.png

Actions are mapped in two stages, and the second happens **after** the
implementation exists:

> If any required action type constraints are declared on the interface, you must select an action type on the object type that satisfies each required action type constraint. You can also optionally provide an action mapping for any non-required action type constraints.

> After the interface implementation is created, configure parameter mappings from the object type's **Interfaces** tab. You must map any required parameter constraints to compatible required parameters on the concrete action type before saving changes to the Ontology.

> After adding the interface implementation in Ontology Manager, the object type's **Interfaces** tab lists the interface's action type constraints in the **Actions** sub-tab. Select a concrete action type on the implementing object type for each required constraint. You may skip or map optional constraints.

> To configure parameter mappings, select the settings icon for the mapped action type constraint to open the **Configure parameters** dialog. Map each required parameter constraint to a compatible required parameter on the selected action type.

The parameter mapping dialog is a plain two-column correspondence:

> Configure parameters — Create Ticket [Optional] → Create Bug
> **Parameter** → **Map to**: Subject → Subject · Created By → Created By · Status → Status · Created At → Created At
> — interfaces/images/iatc-parameter-mapping.png

### 7.4 Where the implementation lives, and what it looks like afterwards

An implementation is edited **from the object type**, on an `Interfaces` tab with
three sub-tabs, one per constraint kind:

> Interfaces 1 · + Implement new interface · [Ticket] · Properties (5) | Links (0) | **Actions (1)**
> Create Ticket [Optional] → Create Bug ✕ ⚙
> — interfaces/images/iatc-mapping-page.png

The same page carries a card that **appears in no sentence anywhere in the
corpus**:

> **Interface action control** — Establish granular control over actions inherited from the interface. Select which action types will be allowed.
> ◯ Enable interface actions
> — interfaces/images/iatc-mapping-page.png

I grepped `Interface action control` and `Enable interface actions` across all
1,184 mirrored pages: zero hits. Logged as Q6.

### 7.5 Editing an implementation later

`edit-interface-implementation.md` is 23 lines and permits exactly two changes:

> Once implemented on an object, you can update the implementation by deleting it or changing the mappings.

> Select the **...** icon and choose **Remove interface** to delete the implementation of the interface from this object type.

> Select the dropdown menu to update the property or link type used to implement the interface.

Note what is **not** changeable: which interface an implementation refers to.
Re-pointing means removing and re-implementing.

The post-implementation dropdown differs from the wizard's — four options in two
groups, `Skip` gone (the row shown is a required property), and
`Create edit-only property` renamed:

> **Use shared property** — Choose backing column ▸ · Replace existing ▸ (*Replace an existing property with this shared property*) · Use edit only
> **Use existing property** — Choose existing ▸ (*Choose an existing property to fullfill this shared property*)
> — interfaces/images/update-interface-implementation-mapping.png

(The product's own typo, `fullfill`, is reproduced verbatim; the wizard's version
of the same string spells it correctly.)

### 7.6 Interfaces as a query target

Directly attested, three ways:

> * **Object Set Service:** Search and sort objects by interfaces. Support for aggregating by interfaces is in development. Support for interface link types is in development.

> Object Set Service searches against the interface will return matching objects of the implementing object type.

> Searchable interfaces enable users to load or search all objects of the interface at once.

So **`object_sets.subject_interface_id` is attested in shape** — an object set may
be subject to an interface, search and sort work, **aggregation does not yet**,
and interface link types are not yet traversable. Our object set model should
refuse aggregation and interface-link traversal on an interface subject rather
than silently supporting more than Foundry does.

### 7.7 Implementing from Pipeline Builder

A second, weaker authoring path:

> To implement an interface, an object type must contain the interface's shared properties **or** declare a mapping of existing object properties onto the interface shared properties. Shared properties that are present on both the interface and object type will be automatically mapped. Any shared properties that are not on the object type will require you to manually input a mapping to satisfy the interface definition.

> Pipeline Builder does not currently support link type constraint or action type constraint mapping when implementing an interface. If your interface contains required link type constraints or required action type constraints, you must implement the interface through Ontology Manager.

**Auto-mapping by identity** is the notable half: where the object type already
carries the same shared property, no mapping is authored. That is the only place
in the section where a mapping is implicit — and it works because a shared
property has a stable identity across types, which a locally-defined interface
property does not. Inference, marked: this is why local interface properties can
never auto-map, and why the two-list distinction in §3.1 has teeth.

---

## 8. Editing a definition: the breaking-change contract

> Given that interfaces expose API names, any change to an interface definition has the potential to break downstream applications and will necessarily break existing object implementations.

> When adding a new required property, link type constraint, or action type constraint to an interface, all implementations for object types that use the interface **must** be made in the same update to your Ontology. We also recommend updating your interface definitions and consumers at the same time.

> If your downstream applications cannot be updated at the same time as interface changes, you can alternatively create a new version of the interface (as an extension or a standalone interface) and migrate to the new interface definition as soon as possible.

> If you make a change to the interface property types, you must also update all object types implementing this interface.

**This is a save-session-atomicity requirement, and we already have the
mechanism.** `ontology-manager-save-session.md` established that a save is a
session containing many entries committed together; the sentence above says
adding a required member and fixing every implementation must be *one* such
session. The screenshots corroborate — `extend-interface.png` shows `12 edits`
and `remove-interface-extension.png` shows `13 edits` beside the same green
`Save`, i.e. an extension is one entry in an accumulating session.

Edit affordances (all from `edit-interface-definition.md`): add local property,
add shared property, add link type constraint, add action type constraint, remove
property, remove-or-edit link type constraint, remove-or-edit action type
constraint. Editing a constraint reuses the creation modal:

> If editing a constraint, you can update the metadata and parameter configuration as you would if you were creating the action type constraint for the first time.

And the per-row menu:

> Edit link type constraint · Delete link type constraint
> — interfaces/images/remove-link-type-constraint.png

Notably **absent**: any way to change an interface property from required to
optional or back is not described in prose — though the Optionality column in
`edit-interface-properties.png` is a live dropdown, so it is editable in place.

---

## 9. Current levels of support (the whole §, because it bounds every phase)

> **Ontology Manager:** Define, edit, and implement interfaces.
> **Marketplace:** Package and install interfaces.
> **Functions:** TypeScript v2 functions.

Partially supported:

> **Actions:** Define actions to create, modify, delete, or link objects implementing an interface. Interface action type constraints are in beta and can be used to define expected action capabilities across object types implementing an interface.

> **Ontology SDK:** Use interfaces as an API layer for interacting with implementing object types. Support varies by language; TypeScript is currently supported and support for Java and Python is in development.

Not yet supported:

> * **Workshop**
> * **Functions:** TypeScript v1 and Python functions

Workshop — the app-building surface — **cannot consume an interface at all.**
`ontology-structural-guidance.md` tells builders to define them anyway:

> |The interface is not yet supported in a specific context	|Define the interface now and duplicate the workflow per type as a temporary measure. This approach is no less efficient than working without an interface, and it establishes a clear path to consolidation once support is available.|

### 9.1 Where interfaces appear in Ontology Manager's own navigation

Both from `ontology-manager/navigation.md`:

> The **Object types**, **Link types**, **Action Types**, **Shared Properties**, **Interfaces**, and **Functions** pages can be selected from the home page sidebar.

> You can search for any object type, property, link type, action type, shared properties, interfaces, or functions you are interested in.

An interface is a first-class sidebar destination and a searchable resource.

### 9.2 The interface's own left rail

Six entries in the older captures, seven in the newest:

> Overview · Properties · Extensions · Link type constraints · Permissions · History
> — interfaces/images/interface-example.png

> Overview · Properties · Extensions · Link type constraints · **Action type constraints** · Permissions · History
> — interfaces/images/iatc-config-page.png

`create-interface.md` instructs `Select **Action type constraints** in the left
side panel`, so the seven-entry rail is current. **`Permissions` and `History` are
rail entries with no page in the interfaces section** — neither is described
anywhere in the ten pages.

### 9.3 Two terms the section uses and never defines

> This is particularly useful for constructing abstract object interfaces that implement multiple capability interfaces.

Both `abstract object interfaces` and `capability interfaces` are hyperlinked, and
both links point at `interface-overview`, which contains neither phrase. The
definitions live one section away, in `ontology/ontology-structural-guidance.md`
(§1 above) and in a tooltip:

> Schedulable Event — Description — A capability interface that indicates the implementing object can be scheduled
> — interfaces/images/extend-interface.png

---

## 10. Contradictions and version skew found by grepping the corpus

Every one is prose or a screenshot that fell behind its own product. Same pattern
`ontology-manager-save-session.md` logged seven times.

**10.1 `_index.md` = `interface-overview.md`.** Byte-identical. Any build that
counts pages counts nine.

**10.2 The creation wizard has three steps in two screenshots and five in a
third.** `create-interface-metadata.png` and `create-interface-choose-properties.png`
and `create-interface-save-location.png` all show `1 Metadata · 2 Properties ·
3 Save location`. `create-interface-about.png` shows `1 Overview · 2 Metadata ·
3 Properties · **4 Optionality** · 5 Save location` — optionality as its own step.
The prose describes the three-step flow with optionality folded into the property
step. The three-step captures are the newer ones (they carry the Recommended tag
on local properties).

**10.3 Interfaces are permissioned by Ontology roles (overview) vs. saved into a
project (create step 6) vs. the roles model being explicitly replaced (both
permissions pages).** Resolved in §2.5: project-based.

**10.4 A link type constraint has a description (prose) vs. a Display name and no
description field (modal).** The `Metadata` section of
`create-link-type-constraint-modal.png` contains exactly two inputs.

**10.5 `SINGLE` cardinality** appears once in `interface-link-types-overview.md`
where every other mention, and both buttons, say `ONE`.

**10.6 In-product copy still says an implementing object type inherits the
interface's properties**, which the docs' own concrete-vs-abstract paragraph
contradicts in spirit:

> Interfaces are a new primitive that allow you to build against abstract types. Once an object type implements an Interface it will inherit its properties.
> Interfaces are implemented from an object type's interface tab. Upon selection of an Interface you will be required to map the inherited shared properties types to your object type.
> — interfaces/images/create-interface-about.png

The mapping flow shows a property is *mapped or created*, not inherited.

**10.7 The extension confirmation dialog previews only properties**, while the
prose says to review three kinds:

> In the confirmation dialog, review the shared properties, link type constraints, and action type constraints that will be added to the interface extension and select **Confirm**.

`confirm-extension.png` lists `Inherited properties (2)` and nothing else.

**10.8 The implement wizard's body step numbers disagree with its own rail** —
`implement-from-object-type.png` highlights rail item 2 while the body says
`STEP 1`; `implement-map-properties.png` highlights rail item 3 while the body
says `STEP 2`. The older captures (`implement-select-interface.png`,
`implement-link-type-constraint.png`) agree with their rails. Cosmetic, but it is
how you tell the two UI generations apart.

**10.9 The display name in `interface-example.png` is misspelled `Faciliity`**
throughout that screenshot (header, link constraint rows, both action types) while
the API name reads `Facility`. It is a fixture typo, not a naming rule — but it
does incidentally demonstrate that display name and API name are independent.

---

## 11. Image inventory — all 32, and what each adds

| # | Image | Controls / labels / values / counts / states | What it adds beyond the prose |
|---|---|---|---|
| 1 | `interface-example.png` | Top bar: Ontology Manager · search `View all related resources ⌘K` · branch `Main` · `New`. Rail: Overview, Properties, Extensions, Link type constraints, Permissions, History. Header `Faciliity` / `Interface`, `Actions ▾`. Cards: Description, Ontology `test Ontology`, API name `Facility` (copy + pencil); Status `Experimental ▾`, Extensions `0`, Implementations `3`, RID `ri.ontology.main.interface.fb…`; Properties `2` + Edit (Facility Name 🌐, Location 🌐); Implementations `3` + New (Manufacturing Plant, Maintenance Hangar, Airport — solid icons); Link type constraints `2` + New (Faciliity→Airlines `Optional`, Faciliity→Facility Manager `Optional`); Action types `2` + New (Create Faciliity, Rename Faciliity) | The whole overview layout and its **counters** (Extensions, Implementations). The link-constraint rows carry **two different connector glyphs** for ONE vs MANY and **a dashed vs solid target icon** for interface vs object-type targets — the only place the two target kinds are shown side by side. The card is titled `Action types`, not `Action type constraints`. RID prefix `ri.ontology.main.interface` |
| 2 | `interface-icon-example.png` | A blue marker glyph inside a dashed blue rounded square, label `Facility` | Shows the dashed border is drawn *around* an ordinary icon, i.e. it is a chrome, not an icon choice |
| 3 | `create-interface-about.png` | 5-step rail `Overview/Metadata/Properties/Optionality/Save location`; explainer text; illustration of three grey cards → one blue interface card → an object type card containing a dashed interface block; `Don't show this message again`; `Skip`, `Next` | **Optionality was once its own wizard step.** The illustration is the only picture of the mental model: an interface composes property/link/function-ish fragments, and an implementing object type *embeds* the interface's block |
| 4 | `create-interface-metadata.png` | 3-step rail; `Icon` picker (dashed square) beside `Display name` [Facility]; `Description (optional)`; `API name` [Facility]; `Skip`, `Next` | Icon is authored at creation, adjacent to display name. **API name shown PascalCase.** No status or searchable field at creation — both take their documented defaults |
| 5 | `create-interface-choose-properties.png` | `These properties will be inherited by object types implementing this Interface.`; section `Interface properties` + `Recommended` + `+ Add property`; rows `Facility Identifier` `Required ▾` ⊖ / `Latitude` `Optional ▾` ⊖ / `Longitude` `Optional ▾` ⊖ each with a base-type glyph dropdown; section `Shared properties` + `+ Add shared property`; `Back`, `Next` | **The two-list structure**: local and shared properties are separate collections on the interface, not one list with a flag. Requiredness is a **two-value dropdown per row** |
| 6 | `create-interface-save-location.png` | `Select a location to save this interface to`; folder input + `Browse ▾`; collapsible `Permissions` info panel; `Back`, `Create` | The save location is a Compass folder and it surfaces the resulting **permissions** inline — corroborates §2.5 |
| 7 | `implement-from-object-type.png` | Wizard `Implement an interface`, rail `1 Overview · 2 Choose interface · 3 Mapping`; `Select an interface` (red-bordered, i.e. required); search `Fac`; list of dashed-icon interfaces incl. `OSS Interface Type (Large)`, `[Common] Link Intermediary`; detail pane: `Facility` + `Experimental` chip, Description, `API Name / Facility`, `RID`; `Close/Back/Next` (Next disabled) | The picker exposes **status, API name and RID** per interface. `Next` is disabled until one is chosen |
| 8 | `implement-select-interface.png` | Same wizard, older skin, rail `1 Overview · 2 Select Interface · 3 Mapping`; interfaces `Facility, Schedulable Resource, Flight Event, Alert, Schedulable Event`; detail pane description | A second capture of the same step; the fixture ontology's interface set is capability-flavoured (`Schedulable Resource`, `Alert`) |
| 9 | `implement-from-interface-overview.png` | Interface overview with `Implementations 0`, empty state `No implementations` + `New implementation`, plus header `+ New`; Properties `3`: `Facility Identifier 🌐`, `Latitude 🌐 [Optional]`, `Longitude 🌐 [Optional]` | **Required properties carry no chip; only optional ones are chipped.** Two entry points to the same flow (card header `+ New` and the empty-state button) |
| 10 | `implement-select-object-type.png` | `Choose object type`, search `fact`, filter chips `Group ▾` `Status ▾` `Clear filters`, groups `Recents` / `All`; detail pane `Factory`, `2 objects`, `3 dependents · Ontology`, `No description`, `Properties (2)`: `Factory Id` 🔑 🔖, `Factory Name`; `Linked object types (1)`: `Factory Stations ▸`; flask glyphs = experimental | The object-type picker is filterable by **group and status**, and previews **object count, dependent count, primary key (🔑), title key (🔖) and linked types** — none of which the prose mentions |
| 11 | `implement-map-properties.png` | Rail gains `4 Link types`. Copy: map to existing or replace. Rows: `Facility Identifier 🌐 → Fulfilled by Factory Id ✓`; `Latitude 🌐 [Optional] → Choose an option` ⊘; `Longitude 🌐 [Optional] → Choose an option` ⊘. Open menu: `Skip` / **Implement a new property**: `Choose backing column ▸`, `Create edit-only property` / **Choose from existing property list**: `Choose existing ▸`, `Replace existing ▸` | **The five legal mappings.** The prose says only `existing object properties`; the menu proves a mapping may also *create* a property, backed by a column or edit-only. Also the satisfied-row wording `Fulfilled by …` and per-row ✓/⊘ state |
| 12 | `implement-link-type-constraint.png` | `STEP 4 · Satisfy link type constraints` · `Choose link types that satisfy the link type constraints on the interface`; menu `Select link type ▸`, `Create new link type`, `Skip`; `Close/Back/Confirm` | The third option (`Skip`) and the terminal button being `Confirm`, not `Next` — link mapping is the last wizard step |
| 13 | `implement-interface-object-type-output-edit.png` | Pipeline Builder graph: dataset `Student / 3 columns` → transform → object type output `Student` / `Not yet deployed`; menu `No output actions` (disabled), `New link type`, `Edit` | The PB object type output has a **deployment state** distinct from the ontology; interfaces are implemented on a not-yet-deployed type |
| 14 | `implement-interface-pipeline-builder-implement-button.png` | Header `Student`, `Disown type`, `Back to graph`; Metadata: `Name and icon`, `Plural name`, `Object type ID` [student], `Edits` toggle `Allow edits to objects of this type`; Properties: 🔑 dropdown [Id], 🔖 dropdown [Id], search; row `id ▾ → " → Id` 🔑 🔖 ✓; buttons `+ Add property`, `Implement interface`, `Generate properties` | Confirms 🔑 = primary key and 🔖 = title key as *selectors on the type*, and places `Implement interface` beside `Add property` — implementing is a property-level authoring act in PB |
| 15 | `implement-interface-pipeline-builder-selection.png` | Modal `Implement interface`; `Choose interface` [Student]; `The selected interface includes the following shared properties:`; panel `Shared properties to be added  2`: `123 Score 🌐`, `" Name 🌐`; `Cancel`, `Implement and go to mapping` | The globe is explicitly attached to things the product calls **shared properties**, which is what lets §3.1 read the older screenshots correctly |
| 16 | `implement-interface-pipeline-builder-mapping.png` | Collapsible `1 interface implemented` → `Student` (dashed) with ⓘ and `…`; property rows `id ▾ → Id` (editable, 🔑🔖) ✓, `score ▾ → Score` (**greyed, locked**, 🌐) ✓, `name ▾ → Name` (greyed, locked, 🌐) ✓ | **Interface-sourced property names are read-only on the implementing type.** Mapping in PB = choosing the *source column* per interface property; name and type come from the interface |
| 17 | `implement-interface-pipeline-builder-review.png` | Hover card: `Student`, `Description` (empty), `Shared properties in this interface  2` (Score, Name), `View details ↗` | The implemented-interface entry is a live reference with a preview and a link out |
| 18 | `edit-interface-properties.png` | Rail with green-check badge on the interface; `Last edited Yesterday at 6:55 PM by Maryia Liauchuk`; `Properties 4` · `+ New property Recommended` · `+ Add shared properties` · filter funnel; table `Name | Optionality | Visibility` + gear; four rows, `Required`/`Optional` dropdowns, all `👁 Normal`; side panel tabs `General/Display/Interaction`; General: Name, Description (optional), `Base type` [String], `Allow multiple` (off), `Value type (optional)`, `API name` [facilityName], `Require values` (⚙ + off); Configuration: `Optionality` [Optional], `Primary key constraint` ◯ `Must be a primary key`; footer `RID  Set on save`; red trash top-right | **Five fields the prose never names** (Allow multiple, Value type, Require values, Optionality-as-a-field, per-property RID), the third visibility value `Normal`, the tabbed panel that explains where type classes and render hints must live, and a **last-edited-by** attribution line |
| 19 | `remove-property-from-interface.png` | Row `…` menu with exactly one item: `⊖ Remove from interface` (red) | The verb is *remove from interface*, not delete — consistent with a shared property surviving its removal |
| 20 | `create-link-type-constraint.png` | `Link type constraints 1` + `Create new link type constraint`; row `Faciliity ⋔ Airlines` + `…`; rail without `Action type constraints` | The list row renders as source-glyph → connector → target-glyph with no cardinality or requiredness text |
| 21 | `create-link-type-constraint-modal.png` | Sections `Settings` / `Metadata` / `Requiredness`; `Link target` [Interface | **Object type**✓]; `Target Object Type` [Airline · Experimental ▾]; `Cardinality` [ONE | **MANY**✓]; `Display name` (*for the other side of the link*) [Airlines]; sentence preview `One Faciliity has many Airlines`; `API name` [airlines]; code preview `facility.airlines.all()`; `Required` toggle **off** with its own explanation; `Cancel/Confirm` | The **complete field list**, the `Requiredness` section as a first-class group, the fact that the display name names *the other end*, and the two live previews that show what the API name compiles into. Required defaults **off** |
| 22 | `remove-link-type-constraint.png` | `…` menu: `Edit link type constraint`, `Delete link type constraint` (red) | Constraints are editable in place and deletable — matches `edit-interface-definition.md` |
| 23 | `extend-interface.png` | Interface `Flight Event` with green check + `…`; top bar `12 edits` + green `Save`; `Extensions (0)` + `+ Add extension`; picker `Alert, Facility, Schedulable Event, Schedulable Resource`; detail `A capability interface that indicates the implementing object can be scheduled` | An extension is an entry in an **accumulating save session** (`12 edits`), and the only definition of *capability interface* inside the section is a fixture description |
| 24 | `confirm-extension.png` | `Extending Schedulable Event will add the following shared properties to this interface by inheriting from the extended interface:`; `Inherited properties (2)`: `Start Time 🌐`, `End time 🌐`; `Cancel/Confirm` | The preview enumerates **exactly what will be inherited** before confirmation — but only properties (§10.7) |
| 25 | `remove-interface-extension.png` | `13 edits` + Save; `Extensions (1)`; collapsible `Schedulable Event` with `…` → `Remove extension`, `View Interface ↗`; nested `Inherited properties (2)` | Inherited members stay **attributed to their source interface** in the UI — the strongest evidence inheritance is by reference, not a copy |
| 26 | `remove-interface-implementation.png` | Object type `Airport`, `4,257 objects`, ☆; rail `Overview / Properties 18 / Security / Datasources / Capabilities / Interfaces / Materializations`; `Interfaces 1` + `+ Implement new interface`; card `Facility` with `…` → `→ Go to Interface`, `Remove interface`; `Shared properties 3` with rows `Facility Identifier 🌐 → iata ✓`, `Longitude 🌐 → Longitude ✓`, `Latitude 🌐 → Latitude ✓` | The **object-type side** of the relationship: a rail entry, a count, and per-property mapping dropdowns with satisfaction ticks. `Facility Identifier → iata` is the clearest example that interface and local names differ |
| 27 | `update-interface-implementation-mapping.png` | Same page with `Link type constraints 1` section visible (row `Airlines → Choose…`) and the property dropdown open: **Use shared property**: `Choose backing column ▸`, `Replace existing ▸`, `Use edit only`; **Use existing property**: `Choose existing ▸` (*fullfill* typo); rail also shows `Automations`, `Usage` | The **post-implementation** mapping menu — four options, two groups, different labels from the wizard's — and proof that link constraint mappings live on the same card as property mappings |
| 28 | `iatc-config-page.png` | Interface `Ticket`; rail now includes `Action type constraints`; `1 edit` + Save; `Action type constraints 1` + `+ Create new`; row `Create Ticket · 4 parameters · Optional` + `…` | The seven-entry rail, and the list row's **parameter-count chip and requiredness chip** |
| 29 | `iatc-config-dialog-set.png` | `Parameter configuration` table: `Type | Single/List | Name | API name | Required | ✕` with four rows (String/Single/Subject/subject/☑, String/Single/Created By/createdBy/☑, String/Single/Status/status/☑, Timestamp/Single/Created At/createdAt/☑) + `⊕ Add parameter`; `Metadata`: Display name, Description (long), API name `createTicket`; `Requiredness`: `Required` toggle off; `Cancel/Confirm` | The parameter constraint is a **table row with six columns**; requiredness is a per-parameter **checkbox** while the constraint's own requiredness is a **toggle**. Same three-section modal grammar as the link constraint |
| 30 | `iatc-config-dialog-properties.png` | `Add parameter` menu: `Existing properties… ▸` → `Ticket ID, Created At, Subject, Status, Created By` + `Add all properties`; `Create new` | **`Add all properties`** — a bulk affordance the prose omits — and confirmation that the source list is the interface's own properties with their type glyphs |
| 31 | `iatc-mapping-page.png` | Object type `Bug`, `0 objects`; banner `You have partial edit permissions`; rail `Overview / Properties 6 / Security / Datasources / Observability / Capabilities / Object views / Application styles / Interfaces 1 / Materializations / Automations / Usage / History`; card `Ticket` with sub-tabs `Properties (5) | Links (0) | Actions (1)`; row `Create Ticket [Optional] → Create Bug ✕ ⚙`; separate card `Interface action control` — `Establish granular control over actions inherited from the interface. Select which action types will be allowed.` — toggle `Enable interface actions` **off** | The **three sub-tabs**, one per constraint kind, each with its own count — the shape our implementation record must produce. And **`Interface action control`, which appears in no sentence in the corpus** (Q6) |
| 32 | `iatc-parameter-mapping.png` | `Configure parameters`: header `Create Ticket [Optional] → Create Bug ▾`; columns `Parameter` → `Map to`; four one-to-one rows; `Cancel/Save` | Parameter mapping is a flat correspondence table, and the mapped action type is re-selectable from inside the dialog |

---

## 12. Connects to

- **`ontology-manager-save-session.md`** — §8's atomicity requirement is a save
  session requirement. `12 edits` / `13 edits` / `1 edit` in three screenshots
  show interface work accumulating in the working state exactly like object type
  work. Our `save_working_state()` is the mechanism the breaking-change rule needs.
- **`create-object-type.md`** — `Create edit-only property` in the mapping menu is
  the same *source is not always a column* finding. And the object-type picker's
  🔑/🔖 glyphs are the two key designations that reading established are
  checkboxes on a property.
- **`properties-and-keys.md`** — the interface property's `Primary key constraint`
  is a *constraint on the implementer's key*, a direction that reading did not
  cover.
- **`capabilities-value-types-and-groups.md`** — `Value type (optional)` on the
  interface property side panel is the same value type mechanism.
- **`rid-grammar.md`** — already records `ri.ontology.main.interface.<uuid>` as
  attested from `implement-from-interface-overview.png`; this reading adds a
  second independent capture (`interface-example.png`, `…interface.fb…`) and a
  new open question: the **per-interface-property RID** (`RID Set on save`) has no
  attested form.
- **`projects-roles-and-portfolios.md`** — an interface is saved into a project
  and inherits its permissions (§2.5).
- **Our schema.** `ontology_interfaces(api_name, label, description, properties
  jsonb, status, visibility, deprecation_*, rid, ontology_id)` and
  `object_type_interfaces(object_type_id, interface_id)`. Migration 436 already
  names its own successor:

  ```
  A declared MAPPING is a child table on the implementation, and it arrives
  with the interfaces phase (the gap report's B4: icon, searchable, required
  flags, extensions, and the mapping).
  ```

  This reading is that phase's spec. The delta, precisely:

  | Foundry has | We have | Gap |
  |---|---|---|
  | icon | — | missing |
  | searchable (+50/1,000) | — | missing |
  | status ∈ 4 values | status ∈ 5 (438) | `promoted` must be rejected for interfaces |
  | *(no interface-level visibility)* | `visibility` column | **undocumented — propose removal** |
  | properties as rows with 12+ fields each | `properties jsonb` `[{key,type}]` | missing 10 fields |
  | required/optional per property | — | missing |
  | local vs shared property sourcing | — | missing |
  | declared property mapping per implementation | name-matching trigger | **the central gap** |
  | extensions (n:m, self-referential) | — | missing |
  | link type constraints + their mappings | — | missing |
  | action type constraints, parameter constraints, both mappings | — | missing (beta) |
  | object set subject = interface | `object_sets.subject_interface_id` | **attested; keep** |

---

## Decisions I had to make

1. **Interface properties become rows in an `interface_properties` table, not a
   jsonb array.** Twelve authored fields per property, a per-property RID, a
   requiredness dropdown, and a mapping that must *reference* a property identity
   make jsonb untenable. Same reasoning that turned `object_types.properties` into
   rows in O2.
2. **Local vs shared sourcing is a discriminator column plus a nullable
   `shared_property_id`, not two tables.** Foundry renders two lists and names no
   storage; one table with a source column mirrors `object_type_properties.source`,
   which we already have. The two-list UI is a rendering of `WHERE source = …`.
3. **Requiredness lives on the interface property, not on the implementation.**
   Directly supported — the dropdown is in the interface's own Properties tab —
   but worth stating because the obvious alternative (a per-implementation
   "satisfied/skipped" flag) would let two implementers disagree about what the
   interface requires.
4. **The implementation mapping is a child table, one row per (implementation,
   interface property), with a resolution discriminator.** I take the five values
   from the wizard menu — `choose_existing`, `replace_existing`,
   `choose_backing_column`, `edit_only`, `skip` — because Foundry names them only
   as menu items and gives no API vocabulary. The post-implementation menu renames
   two of them (`Use edit only`, and drops `Skip`); **I chose the wizard's names**
   as canonical since they are the superset. Flagged: these five identifiers are
   mine, not Palantir's.
5. **`skip` is a stored row, not an absent one.** The docs say mapping "may be
   skipped", which would allow representing it as absence. I chose an explicit row
   because the post-implementation editor shows the skipped property still listed
   with a dropdown — an absent row cannot carry "deliberately skipped" versus
   "never seen", and §7.5 requires the row be re-openable.
6. **Conformance is checked against the mapping table, and the name-matching in
   `assert_interface_conformance()` is deleted, not extended.** Migration 436 says
   so itself. Keep the three obligations separate (properties, links, actions) so
   each can fail with its own message.
7. **Link type constraints get their own table with `target_kind ∈
   {interface, object_type}` and a single nullable FK per kind**, plus
   `cardinality ∈ {ONE, MANY}`, `display_name`, `api_name`, `required`. I treat
   `SINGLE` as a typo for `ONE` (§10.5) and do **not** add it to the CHECK.
8. **A link type constraint stores one name, not two.** Our `link_types` carries
   two named sides; a constraint's display name is explicitly for "the other side
   of the link" and its API name resolves as a traversal from the interface. Do
   not symmetrise it.
9. **Action type constraints are built, but behind the same beta framing Foundry
   uses**, and with no runtime: nothing in our platform may *invoke* a constraint,
   because Foundry's own limitations section says end users cannot and OSDK cannot.
   Build the four tables (constraint, parameter constraint, action mapping,
   parameter mapping) and the five save-blocking validations; build no executor.
10. **Interface-level `visibility` is dropped.** The metadata reference is
    exhaustive by its own framing and omits it while the object-type and
    shared-property references both include it. Foundry has no such concept for
    interfaces; ours was added without a citation. (Interface *property*
    visibility is real and is added.)
11. **Interface API name: I propose PascalCase, matching object types, and
    relaxing our current `^[a-z][a-z0-9_]*$` CHECK.** Two screenshots show
    `Facility`; the prose's `facility` is the only counter-evidence and reads like
    a carried-over sentence from the property metadata page. Marked as a decision
    rather than a fact — see Q9. Interface *property* API names stay camelCase
    (`facilityName`, attested).
12. **`searchable` defaults to true, and the 50/1,000 ceiling is enforced when an
    implementation is created and when `searchable` is flipped.** The page states
    the limits without saying where they bind; both write paths can violate them,
    so both are guarded. The error is namespaced like the rest
    (`OntologyMetadata:…`).
13. **Extensions are stored as edges and resolved transitively at read time, not
    copied.** The dialog wording ("will add the following shared properties to
    this interface") reads like a copy; the extensions page keeping inherited
    members grouped under their source interface, and removal deleting exactly the
    inherited set, reads like a reference. I chose reference because copy cannot
    explain how removal knows which members to withdraw.
14. **Cycle prevention is added even though no page mentions it** — a
    self-referential n:m graph resolved transitively will hang on a cycle. Foundry
    has no documented such rule; I proposed it because our resolution is
    recursive. Marked as invented.
15. **Object sets subject to an interface may filter, search and sort, but must
    refuse aggregation and interface-link traversal**, matching the two
    "in development" clauses verbatim. Refusing is a deliberate choice over
    silently supporting more than Foundry does.
16. **`Permissions` and `History` rail entries are out of scope for this phase.**
    They appear in every capture and in no sentence; History is presumably the
    same resource history other types have. Not built on a screenshot alone.
17. **The extension confirmation preview shows all three inherited kinds**, per
    the prose, not the properties-only screenshot (§10.7). Where prose and an older
    screenshot disagree about *completeness*, prose wins; where they disagree about
    *shape*, the screenshot wins.

---

## Questions I could not answer

1. **What does an interface property's `Primary key constraint` oblige of the
   implementer?** `blocks: interface-properties`. The only sentence is
   > **Primary key constraint:** Indicate whether a property should be a primary key or cannot be a primary key.
   and the panel shows a radio group whose second option is cut off by the capture.
   Does `Must be a primary key` mean the *mapped local property* must be the
   object type's primary key? Searched: all ten interface pages, `properties-and-keys`,
   `create-object-type`, `object-link-types/property-metadata`, and grepped
   `primary key constraint` across the mirror — three hits, all in
   `edit-interface-definition.md` and its own link targets.
2. **Can an inherited property be overridden on the child interface?**
   `blocks: extensions`. Nothing addresses redefinition, and nothing addresses two
   parents contributing the same API name — the classic diamond. Searched
   `extend-interface`, the overview's inheritance paragraph, and
   `ontology-structural-guidance` §Interfaces.
3. **Are extension cycles prevented, and how?** `blocks: extensions`. No page
   mentions cycles, depth limits, or what "layers of interfaces" bottoms out at.
   Decision 14 invents a guard.
4. **When a parent interface gains a required property, do the child's
   implementers break immediately, and must they be fixed in the same save?**
   `blocks: extensions`. The breaking-change callout speaks of "this interface";
   the action-constraint page confirms inherited *constraints* bind implementers,
   which suggests yes for properties too — but that is inference. Searched both
   pages plus `ontology-manager/save-changes`.
5. **Where are the 50/1,000 limits enforced, and what happens at the boundary?**
   `blocks: searchable`. Can `searchable` be turned on for an interface with 200
   implementers? Is the 1,000 a hard cap or an indexing guideline? The sentence
   states the limits and stops. Grepped the whole corpus; `interface-metadata.md`
   is the only page that mentions them.
6. ~~**What is `Interface action control` / `Enable interface actions`?**~~
   **ANSWERED** by `actions-on-interfaces`, now mirrored. The guess above was
   half right and half wrong. Right: it does gate actions inherited from an
   interface against a specific object type. Wrong: it is not the action-type
   constraint, and it is not the action type's own setting — it is the *object
   type's*, reached from its Interfaces tab, and it exists because interface
   submission criteria "apply uniformly to all object types that implement the
   interface", so opting an object type out is the only per-type control there
   is. See `readings/actions-on-interfaces.md` §5.
7. **Is a locally-defined interface property ever shown with a globe?**
   `blocks: nothing`. The globe means shared property
   (`shared-property-overview.md`), and the newest capture shows local properties
   without one — but every other capture predates local properties, so I cannot
   prove the negative from images alone.
8. **Do interface properties really carry type classes and render hints?**
   `blocks: interface-properties`. `edit-interface-definition.md` lists both, but
   the side panel's `General` tab shows neither and the `Display`/`Interaction`
   tabs are never captured. The render-hint sentence mentions Object Storage v1
   indexing, which is odd for a type with no datasource.
9. **Interface API name casing.** `blocks: nothing` (decision 11 proceeds).
   Prose says `facility`; two screenshots say `Facility`. No third source.
10. **Must a concrete link type's own cardinality equal the constraint's?**
    `blocks: link-type-constraints`. The constraint says how many the *interface*
    links to; the satisfaction rule is stated only as "a link that satisfies these
    constraints". A MANY constraint satisfied by a one-to-one link is undefined.
11. **Can an object type implement an interface from a different ontology?**
    `blocks: nothing`. `ontologies-overview` scopes resources to an ontology and a
    space; the interface pages never mention cross-ontology implementation.
12. **What is a per-interface-property RID?** `blocks: nothing`. The panel footer
    reads `RID  Set on save`; no page gives the form. `rid-grammar.md` already
    lists link-type and shared-property RIDs as unattested; this is a third.
13. **What does `Allow multiple` do to conformance?** `blocks: interface-properties`.
    If an interface property allows multiple values, must the mapped local property
    also? Undocumented; the toggle exists only in the screenshot.
