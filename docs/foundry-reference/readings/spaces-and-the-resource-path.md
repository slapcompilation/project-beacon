# Reading — spaces, and where a resource path starts

Written to close the open question left by `rid-grammar.md`: *"What is a space, as
a resource we would build? It sits above projects, carries the organization set,
and owns 'one common ontology'. We have no equivalent and our Location string is
missing its first element."*

It is closed. **The answer is a field called `Path`, and it appears in exactly one
screenshot and no sentence.**

Pages read in full:
- `mirror/platform-security-management/manage-orgs-and-spaces.md`
- `mirror/security/orgs-and-spaces.md`
- `mirror/security/projects-and-roles.md`

Images read closely, all four on the management page:
- `images/control-panel-create-space.png`
- `images/space-settings.png` — **the answer**
- `images/space-inheritance-role-grants.png`
- `images/space-permissions.png`

---

## What a space is

> "A space is a **high-level container of projects, with one common ontology**, for
> work with a common purpose that is shared between a set of organizations. Spaces
> are restricted by an organization (or set of organizations), and that restriction
> will apply to the projects in the space **as well as the associated ontology**."

Two things follow that are easy to miss. A space owns **an ontology**, not just
files — so "which ontology am I in" is answered by the space. And the
organization restriction reaches the ontology too, not only the projects.

And the sizing guidance, which matters for whether this is worth building:

> "**Most organizations will only need a single space, inside which all projects
> will be created.** These projects can be permissioned additionally using markings
> and roles."

A single space is the *normal* case, not a degenerate one.

## The path — the answer to the open question

`space-settings.png` shows the space settings page, breadcrumb **Spaces > Test
Space**, with two cards.

**Space details**, three fields:

| field | value | state |
|---|---|---|
| **Name** | `Test Space` | editable |
| **Path** | `/Test Space-5adf6d` | **greyed — read-only** |
| **Description** *(optional)* | — | editable |

That greyed `Path` field is the thing the prose only alludes to:

> "The file path of a Foundry resource, which can be found in the **Details**
> panel, indicates the space as the first element of the path: for example,
> `space/project/sub-folder/my-file`."

So a resource's full location is `/<space path>/<project>/<…>`, and the space's
path segment is:

- **derived from the name**, with the display name kept verbatim — the literal
  space character in `Test Space` survives into `/Test Space-5adf6d`. It is not a
  slug.
- **suffixed with six hex characters**, `-5adf6d`. Two spaces may share a name;
  their paths cannot collide.
- **not editable**, while the Name above it is. So renaming a space does not move
  every resource inside it. The path is captured, not derived-on-read.

**Access requirements**, the second card:

> "To access this space, users must be a member of at least one of the selected
> organizations below. **Additional requirements may need to be met for project
> access.**"

An **Organizations** search box over a checkbox list (`Palantir`, checked). That
sentence is the two-level model in one line: the space sets a floor, the project
can demand more.

Footer: `Cancel` and **`Save for 🏢 Test Space`** — the save button names its
target, because you are editing a space from an enrollment-wide settings app.

## Spaces are an enrollment concern, not an organization one

`control-panel-create-space.png` puts **Space management** under a nav heading
literally labelled **ENROLLMENT**, and the page subtitle reads "Manage and create
new spaces **for your enrollment**." Spaces sit *above* organizations.

The list shows two spaces, each with a tag:

- `production space` — an organization icon with the count **1**, tag **`Owned`**
- `testing space` — no organization count, tag **`Shared`**

So a space is either **Owned** by this enrollment or **Shared** into it, and the
list shows how many organizations are applied. Neither state is described in the
prose.

Creation asks for six things (from the page):

> **Access requirements** ("Users need permission from at least one organization to
> access this space. Projects in this space can only be visible by organizations in
> this list."), **Deletion policy** ("The space is deleted only after all
> organizations in this policy have been deleted."), **Filesystem** ("Where project
> data is stored. **Cannot be changed after creation**"), **Usage account**,
> **Resource queue**, **Role set**.

**Filesystem is a per-space, immutable setting.** That is the same "backing file
system" a dataset's files live in — so *which* filesystem is a property of the
space, decided once.

Management adds two more: a **Maven identifier** ("Uniquely identifies resources
published from this space") and **Project inherited roles**.

## Roles on a space are workflow bundles, not a ladder

This is where a space differs most from a project, and both screenshots say so.

`space-permissions.png` — "Space permissions: Grant roles to people and manage
aspects of a space." Three cards, each tagged **Default role**, each stating how
many *workflows* it grants:

| role | description | grants |
|---|---|---|
| **Contributor** | "Can create projects." | **5 workflows** — Create project · Curate portfolios within the space · Manage portfolios within the space · Manage value types · View value types |
| **Project Templates Administrator** | "Create, edit, and delete project templates." | **1 workflow** |
| **Space Administrator** | "Has full control over the space: security, project templates, and settings." | **61 workflows** |

A `+ New role` button sits beside a filter reading "Filter roles and
workflows…", and the prose describes custom roles as "select which workflows to
include with this role."

**So a space role is a *set* of workflows, not a rank.** Compare project roles —
Owner > Editor > Viewer > Discoverer, where "Each role can assign other users the
same or lesser role." One is a lattice of capabilities; the other is a ladder.
They are not the same mechanism and should not be modelled as one.

The right-hand panel completes it: "**Manage privileges** — Grant people
**Contributor** to manage aspects of **Example**."

And a trap worth carrying:

> "Custom roles are '**frozen**', meaning that new workflows added to default roles
> will not automatically apply to custom roles."

A custom role is a snapshot of a workflow set. It does not track its template.

### A reconciliation

`security/projects-and-roles` says "Users need `Editor` or `Owner` permissions on
a space to create Projects in that space" — which contradicts the screenshot,
where the project-creating role is **Contributor**. The management page resolves
it: "**Legacy** spaces might provide additional configuration settings… **Roles:**
Users must have a role on the space and meet its access requirements to create
projects." Editor/Owner-on-a-space is the legacy model; workflow-bundle roles are
current. **Contributor is the role that grants "Create project".**

## Project inherited roles — two contexts, not one

`space-inheritance-role-grants.png` shows a card headed **Project inherited
roles** containing two independent pickers, each with its own explanation:

- **Project role context** — "Roles granted here will be inherited by all **public
  projects** in this space"
- **Marketplace role context** — "Roles granted here will be inherited by all
  **marketplace projects** in this space"

Both show "Add a user or group…" over an empty state reading "No principals with
inherited role grants". The prose only says "There are two inheritance role grant
pickers, one for regular projects and one for locked marketplace projects" — the
screenshot names them and tells you the first applies to *public* projects, which
implies projects have a public/non-public distinction the prose never mentions.

## Organizations, restated from this page

> "**Apply organization:** Allows a user to add this organization to resources…
> **Expand access:** Allows a user to expand access to resources by adding other
> organizations or removing this organization."

And a named failure mode: a user who cannot move a resource between organizations
"must be granted the **Expand access** permission **on the source organization**"
— on the one they are leaving, not the one they are joining.

---

## Connects to

- **`rid-grammar`** — closes its open question 1. Also: **no space RID is
  attested** anywhere in the mirror. Consistent with the discipline; a space gets
  no RID.
- **`datasets-rid-and-object-storage`** — "the backing filesystem for Foundry is
  specified by a base directory" is now placed: **Filesystem is a space setting,
  fixed at creation.** Our `datasets` schema is that base directory, and it is
  per-database rather than per-space.
- **`object-permissioning`** — "Organizations" as one of the four security slots
  now has a container above it. The space sets the floor, the project narrows it.
- **`security/markings`, `compass/portfolios`, `platform-security-management/manage-roles`,
  `marketplace/`** — all named here, all unread. Portfolios and value types appear
  as *workflows a Contributor holds*, which is the first sighting of either.
- **Our `projects`** — has `organization_id`, one value, no parent. Foundry's has
  a space above it and a *subset* of that space's organizations.

## Decisions taken from this reading

2026-08-06, with the operator. Migration 397.

1. **Build the space as the container `space-settings.png` shows in full**: name,
   an immutable generated path, description, and the set of organizations that
   gate it. That page has exactly those two cards and nothing else, so this is a
   complete surface rather than a fragment of one.
2. **The path is captured at insert, not derived on read.** `/<Name>-<6 hex>`,
   refused on update — which is what a greyed field means. Deriving it would move
   every resource in the space on a rename.
3. **`projects.space_id`, and Location becomes `/<space path>/<project>/<dataset>`.**
   This was already wrong and is the concrete reason to build any of this.
4. **No RID for a space** — none attested, same rule as link types.

### Deliberately NOT built, and why

- **Space roles as workflow bundles.** They are a genuinely different mechanism
  from our project role ladder, they live on a different page in Foundry too, and
  there are no workflows to bundle yet. Building `Contributor` with an empty
  workflow set would be a role that grants nothing while looking like it grants
  something.
- **Projects holding a *subset* of the space's organizations.** Foundry's project
  takes "any subset"; ours takes exactly one `organization_id`. Converting is a
  change to every RLS policy in the database, and the benefit only appears with
  cross-organization collaboration, which we do not have. The single-org project
  is a valid subset of size one — so this is a narrowing, not a wrong shape.
- **Deletion policy, Usage account, Resource queue, Role set, Maven identifier,
  Filesystem, Owned/Shared, project templates, inherited role contexts.** Each
  belongs to a system we do not have (enrollments, billing, compute queues,
  Marketplace).

## Open questions

1. **What makes a project "public"?** The inherited-roles picker distinguishes
   public projects from marketplace projects. No page read defines either.
2. **What are portfolios and value types?** Both appear only as workflows in the
   Contributor role. `compass/portfolios` is mirrored and unread.
3. **Does a space really own one ontology, as a resource?** "one common ontology"
   is stated twice. We have one implicit ontology and the Ontology Manager
   screenshots show an **Ontologies dropdown**, so more than one is possible.
