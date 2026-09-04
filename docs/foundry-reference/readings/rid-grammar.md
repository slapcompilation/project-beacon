---
verify: strict
---

# Reading — the RID grammar, and which resources actually have one

Written because migration 391 gave RIDs to five resource types and deliberately
withheld them from five others, on the grounds that no page in the mirror
attested a form. The operator searched the documentation and pointed at six
pages. This is what they say.

Read, and nothing below quotes it: `mirror/compass/create-a-project.md` — read
for whether a project RID is printed anywhere in the creation flow. It is not,
which is why nothing here rests on it.

Pages read in full:
- `mirror/security/orgs-and-spaces.md`
- `mirror/platform-security-management/manage-orgs-and-spaces.md`
- `mirror/object-link-types/create-link-type.md`
- `mirror/object-link-types/struct-shared-properties.md`
- `mirror/interfaces/interface-overview.md`, `interface-metadata.md`, `create-interface.md`
- `mirror/action-types/getting-started.md`
- `mirror/data-integration/foundry-s3-api.md` (the "Find the project RID" section)

Images read closely:
- `platform-security-management/images/manage-organizations.png` — **the answer for organizations**
- `action-types/images/getting_started_add_RID.png` — **the answer for action types**
- `interfaces/images/implement-from-interface-overview.png` — **the answer for interfaces**
- `compass/images/create-new-project.png`
- `object-link-types/images/create-link-api.png`
- `object-link-types/images/create-shared-property-modal.png`
- `interfaces/images/create-interface-metadata.png`

**Four of the six answers came from screenshots, not prose.** Three of those
four appear in no sentence on any page.

---

## The grammar, corrected

391 recorded it as `ri.<service>.<instance>.<type>.<locator>`, inferred from ~160
examples that all used `main`. That was an over-generalisation from a biased
sample. **The instance segment can be empty**, and four services use it that way:

```
ri.magritte..source.<uuid>
ri.language-model-service..language-model.<uuid>
ri.actions..scenario.<uuid>
ri.multipass..organization.<uuid>
```

Two consecutive dots, not a typo. The segment count is unchanged, so a parser
that splits on `.` and takes the fifth field still works — which is why
`rid_locator` needed no change. A parser that assumed `main` would not have.

---

## Organizations — two identifiers, and the screenshot is the only source

`manage-organizations.png` shows the Control Panel **Organizations** page. The
right-hand **Organization details** panel opens with a section headed
**Organization IDs**, plural, holding two values each with its own copy button:

| field | value |
|---|---|
| **MARKING ID** | `a87f817d-61b3-4c82-a81e-1284176fb…` — a bare uuid, **not** a RID |
| **RESOURCE ID** | `ri.multipass..organization.9490010f-0…` |

They are different uuids, so these are genuinely two identities, not one value
shown twice. The prose explains why without ever naming either: "**Like markings,
organizations are a mandatory access control.** However, organizations differ
from markings in a few key ways" (`security/orgs-and-spaces`). An organization
*is* a marking as far as access control is concerned, and *is* a resource as far
as the platform is concerned — so it carries an id in each system.

The rest of the panel, none of it in the prose: **Discoverability** ("How users
from Sky Industries view other organizations, and how other organizations view
Sky Industries"), **Guest members**, **Organization permissions**, **Apply
organization** — each with a `Manage` link and a row of user avatars.

That maps to the two permissions the page *does* name: "**Apply organization:**
Allows a user to add this organization to resources" and "**Expand access:**
Allows a user to expand access… by adding other organizations or removing this
one."

### Spaces, since they sit above organizations

A space is "a high-level container of projects, **with one common ontology**, for
work with a common purpose that is shared between a set of organizations."
Restricted by an organization or set of them, and that restriction reaches the
projects *and the ontology*.

> "The file path of a Foundry resource… indicates the space as the first element
> of the path: for example, `space/project/sub-folder/my-file`."

So the Location string we render as `/<project>/<dataset>` is missing its first
element. Foundry's is `space/project/…`.

Space creation asks for: **Access requirements** (the organizations), **Deletion
policy**, **Filesystem** ("Cannot be changed after creation"), **Usage account**,
**Resource queue**, **Role set**. Management adds a **Maven identifier**
("Uniquely identifies resources published from this space") and **Project
inherited roles**.

And the multi-organization rule, which is what the create-project dialog's
`Organizations · Any of` picker is for: "if there is a shared space with both the
Sky Industries and Sunrise Airline organizations applied, projects inside that
space can be created with just Sky Industries or just Sunrise Airline… or *both*."

---

## Projects — a RID, but not their own type

`create-a-project` shows no RID, and neither does `create-new-project.png`. The
operator was right that these pages do not have one. The answer is in
`data-integration/foundry-s3-api`:

> "The `<PROJECT_RID>` value must be the RID of a top-level project, not the RID
> of a folder or other resource nested inside a project. **Both projects and
> folders use the RID format `ri.compass.main.folder.{RID_VALUE}`, so the format
> alone does not distinguish them.**"

**A project is a folder at the RID level.** There is no `ri.compass.main.project`.
`ri.compass.main.folder` — which 391 already recorded as the folder form — is
also the project form.

And the consequence is stated as a warning:

> "Supplying the RID of a nested folder, a dataset, or any resource that is not
> itself a project results in a permissions error… **This occurs even though the
> RID has the expected `ri.compass.main.folder.{RID_VALUE}` format.**"

The RID does not encode project-ness. Whether a folder is a project is a fact
about the resource, not about its identifier — so a system that accepts a project
RID has to check, not parse.

### What the create dialog adds

`create-new-project.png`: **Name**, **Description (optional)**, **Namespace** (a
dropdown with a `?` — the pre-rebrand name for space), **Organizations · Any of**
(a multi-select), **Default role**, and a sentence generated from the choices:
"Everyone from **Palantir** can see the existence of this project and is granted
the **Viewer** role."

Two things ours does not have: the space, and the per-project organization
subset. Ours takes its organization from RLS.

---

## Link types — no RID anywhere

`create-link-type` runs four steps — Relationship type, Link resources, Link type
names, Save location — and mentions no identifier but the API name. Neither does
any screenshot.

`create-link-api.png` shows why there may not be one to show. **A link type has
two sides and each side has its own name**, rendered as two sentence-shaped
cards:

```
[Flight] → [Aircraft]      Each [Flight] has many [Aircraft]
                           API Name   cssExampleDataFlight. cssExampleDataAircraft .all()

[Aircraft] → [Flight]      Each [Aircraft] has many [Flight]
                           API Name   cssExampleDataAircraft. cssExampleDataFlights .all()
```

The API name is shown *in its call site* — the greyed prefix is the source object
type and the greyed suffix is `.all()`. So a link type's addressable identity is
**(source object type, api name)**, twice, which is exactly what the prose
requires: an API name must "be unique across all link types associated with the
same object type", not globally.

> "Because both sides are configured together for the same link type, the link
> type can be traversed in either direction; there is no separate link type to
> define for the reverse direction."

**Conclusion: no attested RID. Do not invent one.**

One error worth keeping, because it is the link-type version of a rule we already
enforce for object types: `Phonograph2:DatasetAndBranchAlreadyRegistered` —
"the datasource backing the link type you are trying to save is already backing a
different link type in the Ontology and cannot be used again." Note it names a
dataset **and branch** pair, not a dataset.

---

## Shared properties — no RID for the property, but its struct fields have them

`create-shared-property-modal.png` is a three-step wizard — **Metadata**
(Name, Description, **Aliases**, API Name) → **Configuration** (base type, value
type, visibility, required) → **Save location** (a project). No identifier but
the API name.

But the page's first paragraph is more interesting than the wizard:

> "Local struct property types backed by shared property types will inherit
> shared property type fields **except for the struct field resource identifiers
> (RIDs)**. Struct field metadata (display name, description, aliases) will then
> be inherited from the shared property type, but **struct fields with keep their
> original RIDs**."

(“with keep” is the page's own typo, quoted as printed — it read “will keep”
here until `check:readings` could not trace the sentence.)

So RIDs go *deeper than the property* — an individual **field inside a struct
property** has one. Metadata is inherited on attachment; identity is not. That is
the same principle as the object type primary key: identity survives a
re-parenting, and everything descriptive does not.

**Conclusion: no attested RID for a shared property itself.** The existence of
struct-field RIDs makes it near-certain one exists, which is precisely why it
should not be guessed.

---

## Interfaces — yes, and the page that says so is not the one linked

`interface-overview` does not show a RID. `interface-metadata` states it plainly:

> "**RID:** An automatically generated unique identifier for every resource in
> Palantir. An interface's RID will be **referenced in error messages** across the
> platform."

And `implement-from-interface-overview.png` shows the literal value on the
interface's Overview page:

```
RID   ri.ontology.main.interface.3d…
```

Same service and instance as `ri.ontology.main.object-type`. **Attested.**

### The structure of that page, which the prose does not describe

Left nav, six entries: **Overview, Properties, Extensions, Link type constraints,
Permissions, History**. Compare an *object type's* nav from the MDO screenshots —
Overview, Properties, Security, Datasources, Capabilities, Interfaces,
Automations. **An interface has no Datasources tab**, which is the prose's
"interfaces… are not backed by datasets" made visible; and it has **Extensions**
and **Link type constraints**, which an object type does not.

Header: the icon is drawn with a **dashed border** — the page says interfaces are
"visually distinguished from object types in the platform by having dashed lines
around their icons", and the screenshot confirms it applies to the header icon,
the sidebar icon, and the icon picker in the create dialog.

Left card: **Description**, **Ontology** (value: `Ontology` — a resource belongs
to a *named ontology*, and `create-interface` step 1 says to "verify you are
working within your ontology of choice by checking the **Ontologies** dropdown"),
**API name** with both a copy button **and an edit pencil**.

Right card: **Status: `Experimental`** as a dropdown, **Extensions: 0**,
**Implementations: 0**, then a divider and **RID**, truncated, with no copy button
and no pencil. **The API name is editable and copyable; the RID is neither.**

Below: **Properties (3)** with an `Edit` link — `Facility Identifier`, `Latitude`
(tagged `Optional`), `Longitude` (tagged `Optional`); required properties carry no
tag, so *optional* is the marked case. And **Implementations (0)** with a `+ New`
and a "New implementation" empty state.

`interface-metadata` lists one more field no screenshot shows: **Searchable**, "a
boolean value that specifies whether the interface is searchable. Searchable
interfaces are limited to **50 implementing object types**, whereas non-searchable
interfaces are limited to **1,000**." It is not in the creation wizard — it
defaults on.

---

## Action types — yes, and only the screenshot proves it

The prose is ambiguous in a way that matters. Two different things are called an
"Action RID":

From `action-types/action-log`:

> "**Action RID:** Unique identifier for a single **action submission**"

and from `action-types/getting-started` (re-mirrored 2026-09-04; the sentence
lost its doubled "paste" upstream, and the argument survives unchanged):

> "Copy the action RID from the Ontology Manager and paste it into the Action
> RID field."

The first is an instance. The second is copied from Ontology Manager, where
action *types* live — and `getting_started_add_RID.png` settles it by showing the
field filled in:

```
Editing widget: Actions
  Action RID (required)   ri.actions.main.action-type.<redacted>
```

**`ri.actions.main.action-type.<uuid>`. Attested.** The field is labelled "Action
RID" and holds an action *type* RID; the label is loose, the value is not.

Corroborated from a third page: `aip-analyst/embed` takes a parameter
**`actionTypeRids`** — "Load individual action types."

Note also `ri.actions..scenario.<uuid>` — the same service with an *empty*
instance for a different type. One service, two instance conventions.

---

## Summary

| resource | RID? | form | source |
|---|---|---|---|
| **organization** | yes, **plus a separate Marking ID** | `ri.multipass..organization.<uuid>` | screenshot only |
| **project** | yes — **as a folder** | `ri.compass.main.folder.<uuid>` | `foundry-s3-api` prose |
| **interface** | yes | `ri.ontology.main.interface.<uuid>` | screenshot + `interface-metadata` |
| **action type** | yes | `ri.actions.main.action-type.<uuid>` | screenshot only |
| **link type** | **not attested** | — | absent from page and all screenshots |
| **shared property** | **not attested** (its struct *fields* have them) | — | prose says fields do |

## Connects to

- **`datasets-rid-and-object-storage`** — supersedes its "the grammar is
  `ri.<service>.<instance>.<type>.<locator>`" with the empty-instance variant, and
  fills four of the five gaps it left open.
- **`object-permissioning`** — organizations as "a fixed conjunction of four
  slots" now has the Control Panel surface behind the Organizations slot.
- **`security/markings`** — an organization holds a Marking ID because it *is* a
  marking. Still unread, and it is the reason the second identifier exists.
- **Our `organizations`, `projects`, `ontology_interfaces`** — all three now have
  an attested RID form and none had a RID.
- **Our `link_types`, `shared_properties`** — confirmed to have no documented RID.
  They stay without one.

## Open questions

1. ~~**What is a space, as a resource we would build?**~~ **Closed** by
   `spaces-and-the-resource-path.md` and migration 397. The answer is a greyed
   `Path` field, `/Test Space-5adf6d`, visible in one screenshot and no sentence.
   No space RID is attested, so a space gets none.
2. **What is the shared property's own RID?** Its struct fields have RIDs, so it
   almost certainly has one. Not in any page read.
3. **Does a link type have a RID at all?** Nothing suggests it does; the two-sided
   API name may be the whole of its identity.
4. **What is the action *submission* RID form?** `action-log` names the concept;
   no page shows the string.

## Decisions taken from this reading

2026-08-06, with the operator. Migration 396.

1. **`rid_of` gains an instance argument**, defaulting to `main`, because the
   empty instance is real and four services use it.
2. **RIDs added**: organizations (`ri.multipass..organization`), projects
   (`ri.compass.main.folder` — *folder*, not project), interfaces
   (`ri.ontology.main.interface`).
3. **RIDs still withheld**: link types and shared properties. Both were checked
   against the page the operator named plus every screenshot on it, and neither
   shows one. This is the second time the answer has been "no", which makes it
   evidence rather than an absence of evidence.
4. **The organization Marking ID is not built.** It exists because an
   organization is a marking, and we have no markings. Recording the concept
   without the system it belongs to is the half-built shape.
