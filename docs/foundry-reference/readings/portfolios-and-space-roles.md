---
verify: strict
---

# Reading — Portfolios, and the space roles they rest on

Written 2026-08-18, picking up the deliverable map's portfolios entry — the
half of Compass that C1 and C2 did not cover. **§7 was added after the
operator asked whether the docs settle open question 1. They do**, in
`manage-roles`, which no reading had opened. Read in full: `security/portfolios`,
`platform-security-management/manage-orgs-and-spaces`,
`platform-security-management/manage-roles` (§7). Images opened and
transcribed: `platform-security-management/images/space-permissions.png` —
**the page that settles the permission model** —
`security/images/portfolio-curators.png`,
`platform-security-management/images/create-role-set.png` and
`platform-security-management/images/roles-card-space-settings.png`.
Consulted by grep only: `security/orgs-and-spaces`, `security/projects-and-roles`.

**This reading stops before building.** Its Decisions block has not been read
by a human, and the rule is that a reading is never built from until it has
been.

## 1. What a portfolio is

> "Portfolios allow users to organize Projects within a Space. Each Portfolio
> contains many Projects, and each project belongs to a single Portfolio. Any
> user with access to a Space can view its Portfolios, but users still
> separately need permissions to view the Projects inside a Portfolio."

Three facts, and the third is the load-bearing one: **a portfolio is curation,
not security.** Seeing the portfolio does not imply seeing what is in it. So a
portfolio must never appear in an access predicate — it groups, it does not
gate. This is the same shape as C1's folders, whose "organize, never gate"
claim turned out to be *false* for folders; here it is stated outright and in
the right direction.

"Each project belongs to a single Portfolio" is **N:1**, so the membership is a
column on the project, not a join table. A join table would permit the state
the sentence forbids.

## 2. Creation, metadata and the space it cannot leave

> "Users with the Editor role on a Space can create a Portfolio from the
> Portfolios page. Each Portfolio must have a Space and a unique name.
> Portfolio creators can optionally provide a short text description and
> configure the Portfolio's thumbnail with an image or icon color."

> "Administrators and curators can edit a Portfolio's metadata from the Actions
> menu in the top right. Name, Description, and Logo are editable, but
> Portfolios cannot move between Spaces after creation."

> "Administrators and curators can also add Markdown documentation to a
> portfolio. All users who can view the Portfolio can view this documentation."

So: unique name **per space**; `space_id` immutable after creation; description,
logo and Markdown documentation are metadata a curator may edit.

## 3. Curation, and what happens to a project that moves

> "After creating a Portfolio, administrators can populate it with Projects
> from the same Space using the **Add Projects** dialog. This dialog displays
> all projects in the same Space as the Portfolio, including those that already
> belong to a separate Portfolio. Since Projects can only belong to a single
> Portfolio, moving a Project to another Portfolio will remove it from the
> first one."

Two rules that are enforcement, not UI: a portfolio may only hold projects
**from its own space**, and adding a project to a second portfolio silently
removes it from the first — which is exactly what a single nullable column
does for free.

> "After selecting Projects to include in this Portfolio, users have the option
> to change each Project's display name. This is an optional step."

A per-portfolio display name. Because membership is N:1, this can live beside
the membership column on the project rather than needing a row of its own.

## 4. Curators are users *or groups* — from the screenshot

> "Normally, only users with the `Editor` role on a Space can manage the
> contents of its Portfolios. To expand Portfolio curation permissions, users
> with management access can open the sidebar on a Portfolio and edit its list
> of **Curators**. These users will have the option to add or remove Projects
> from this Portfolio, as well as edit its description and documentation."

The prose says "These users". The screenshot says otherwise — its two entries
both carry a **group** glyph, and the field invites either:

> "Portfolio curators" · "Add a user or group…" · ☑ Additional Portfolio
> Curators · ☑ Hospital Curators
> — security/images/portfolio-curators.png

So a curator grant is **user XOR group**, which is precisely the shape
`project_role_grants` already carries. The panel is reached under a lock icon
headed `Access`, beside the portfolio's name.

## 5. The prerequisite: space roles, and they bundle workflows

`portfolios.md` gates everything on "the Editor role on a Space" and on
"Administrators" without saying where either comes from. **We have no space
roles at all** — space access today is organization membership, and nothing
else. So I first concluded portfolios was blocked on something undocumented.
**That was wrong, and checking is why.** `manage-orgs-and-spaces` publishes it:

> "From the **Space permissions** page in Control Panel, you can set the roles
> users have in the space. Each space comes with a set of default roles and the
> ability to create custom roles for greater flexibility in managing
> permissions. For each role, you can open the workflows dropdown menu to view
> the permissions granted with the role."

> "To create a custom role, select **+ New role** in the top right of the page,
> then select which workflows to include with this role."

> "Custom roles are "frozen", meaning that new workflows added to default roles
> will not automatically apply to custom roles. To include new workflows in a
> custom role, select **Edit role** and add them manually."

> "**Roles:** Users must have a role on the space and meet its access
> requirements to create projects or manage space settings."

**A space role is a bundle of workflows** — the identical mechanism §4 built for
organizations in 540–542 (`organization_roles` + `organization_role_workflows`).
That is not an analogy: it is the same Control Panel page shape, one scope up.

### And the screenshot names the portfolio workflows

`space-permissions.png` is the strongest evidence in this reading, because it
publishes the *contents* of the default roles — which the Organization
permissions crawl could not obtain for its own roles:

> "Space permissions" · "Grant roles to people and manage aspects of a space."
> — platform-security-management/images/space-permissions.png

> **Contributor** · Default role · "Can create projects." · Grants 5 workflows:
> Create project · Curate portfolios within the space · Manage portfolios
> within the space · Manage value types · View value types
> — platform-security-management/images/space-permissions.png

> **Project Templates Administrator** · Default role · "Create, edit, and
> delete project templates." · Grants 1 workflow
> — platform-security-management/images/space-permissions.png

> **Space Administrator** · Default role · "Has full control over the space:
> security, project templates, and settings." · Grants 61 workflows
> — platform-security-management/images/space-permissions.png

Three things fall out, and the first contradicts the prose:

1. **There is no "Editor" role on a space.** The defaults are Contributor,
   Project Templates Administrator and Space Administrator. `portfolios.md`'s
   "Editor role on a Space" is prose shorthand for *whoever holds the
   portfolio workflows*, which by default is **Contributor**. Taking the word
   "Editor" literally would have invented a fourth role. This is the two
   vocabularies trap in its usual form — a page written for a person naming a
   capability, a settings surface naming the mechanism.
2. **The permission is a workflow, not a role.** Two of them, named exactly:
   `Curate portfolios within the space` and `Manage portfolios within the
   space`. The split matches the prose's own division — curators add and
   remove projects and edit description/documentation; administrators also
   create portfolios and edit name and logo.
3. **Value types are space-scoped too** — `Manage value types` and `View value
   types` sit on the same Contributor role. That answers, from a different
   direction, the half of `spaces-and-the-resource-path`'s question 2 that the
   portfolios reading left open.

The right-hand rail is the grant surface: "Manage privileges · Grant people
**Contributor** to manage aspects of Example." with `Add a user or group…`
— again user *or group*.

## 6. The catalog

> "Resources that have been pinned in a project appear in the catalog for a
> portfolio grouped by project or resource type. Administrators can promote
> resources from projects in the portfolio by searching for resources in the
> **Add Content** dialog."

We already have both halves of the vocabulary: `projects.promoted` and C2's
catalog. The portfolio catalog is a *view over* pinned resources in member
projects, not a new store.

## Connects to

- **`organization-permissions`** — the same roles-bundle-workflows mechanism,
  one scope up. `organization_roles`, `organization_role_workflows` and
  `organization_role_grants` are the built precedent to copy.
- **`compass-folders`** — folders organize within a project; portfolios
  organize projects within a space. The C1 lesson (its "organize, never gate"
  claim was false for folders) is why §1's explicit statement matters here.
- **`spaces-and-the-resource-path`** — closes the value-types half of its
  open question 2, from the Space permissions screenshot.
- **Our `projects`** — already carries `space_id`, `promoted` and `rid`, so a
  portfolio membership is one nullable column plus a display name.

## Decisions (mine, not Palantir's, unless quoted)

**Space roles come first, and portfolios are built on them.** Portfolios
cannot be permissioned without the thing that permissions them; approximating
with organization admin would invent a security model.

1. **`space_roles` + `space_role_workflows` + `space_role_grants`**, copied from
   540–542's shape rather than re-derived. Grants are **user XOR group**, as
   both screenshots show. Three default roles seeded per space with their
   published names and descriptions: Contributor, Project Templates
   Administrator, Space Administrator. **Confirmed per-space by §7** — these
   are roles *on* the space and there is no Space context among the three role
   set contexts, so they are the space's own: "Each space comes with a set of
   default roles and the ability to create custom roles".
2. **The workflow vocabulary is only what a screenshot publishes.** Five for
   Contributor, exactly as transcribed. The other two roles' contents are *not*
   published — "Grants 1 workflow" and "Grants 61 workflows" with the lists
   collapsed — so they get their names and descriptions and **no invented
   workflow rows**, the same way §4 recorded the roles whose contents it could
   not crawl.
3. **Custom roles are frozen at creation** — "new workflows added to default
   roles will not automatically apply to custom roles". So a default role's
   workflow set is derived and a custom role's is stored; they are not the same
   kind of row and the migration must say which is which.
4. **`portfolios(id, space_id, name, description, logo, documentation, …)`**
   with `unique (space_id, name)` and a trigger refusing any change to
   `space_id` — "Portfolios cannot move between Spaces after creation".
5. **Membership is `projects.portfolio_id`, nullable**, plus
   `projects.portfolio_display_name`. N:1 by the documented sentence; a join
   table would permit the state it forbids, and moving a project between
   portfolios becomes an UPDATE that cannot leave it in two.
6. **A trigger refuses a project from another space** — "Projects from the same
   Space as the Portfolio".
7. **`portfolio_curators(portfolio_id, user_id, group_id)`**, user XOR group,
   granting the curate half only.
8. **A portfolio never appears in an access predicate.** Visibility of a
   portfolio follows space access; visibility of its projects is unchanged.
   *Inference*: I will assert this directly — a test that a user who can see
   the portfolio still cannot see a project they lack a grant on, because §1
   says so in one sentence and C1 proved that such a sentence can be wrong in
   our implementation even when it is right in theirs.
9. **The catalog is a view, not a store** — pinned/promoted resources of member
   projects, grouped by project or resource type.
10. **Deferred**: thumbnails as uploaded images (we have no media store; icon
    colour only), the Add Content promotion dialog, and favouriting.

## 7. Question 1, answered — and the question conflated two mechanisms

Read after the fact: `platform-security-management/manage-roles`, plus
`images/create-role-set.png` and `images/roles-card-space-settings.png`.
(`manage-roles-.md` is the *same page* mirrored twice from a double-slash URL —
its only difference is the source comment. A mirror artifact, not a second
page.)

I asked whether the space's default roles are per-space rows or a shared "role
set" object. **Both are true, of two different things**, and my question ran
them together because `manage-orgs-and-spaces` puts them on the same settings
page.

### Role sets are real, first-class, and Organization-owned

> "Role sets are a group of roles that allow the customization of role
> permissions at the Organization level and are used in a specific context,
> such as in Projects or the Ontology."

> "Roles in the same set are not dependent on any role outside of that set.
> All roles belong to one and only one role set. Roles in the set belong to
> the same Organization and are permissioned uniformly. Roles in the set are
> designed to work together, in the same context. Currently, the three
> available contexts for role sets are the Project context, Ontology context,
> and Marketplace Installation context."

> "Every enrollment will have at least three default role sets: Project
> defaults (Owner, Editor, etc.), Ontology defaults (Ontology Owner, Ontology
> Editor, etc.), and Marketplace Installation defaults (Marketplace
> Installation Editor, Marketplace Installation Viewer, etc.). Default role
> sets and the roles within them are always available to all Organizations."

The list screenshot gives the object its columns, and shows the defaults
carrying **no** organization while a custom set carries one:

> "Roles" · "Create and manage roles and their role sets." · columns **Name ·
> Context · Organization** · `Ontology Defaults` [Ontology] · `Project
> defaults` [Project] · `Sky Industries project defaults` [Project] · Palantir
> — platform-security-management/images/create-role-set.png

**A space points at one role set per context**, and the space settings card
says so in the imperative:

> "Role sets" · **Project role set** — "Projects in this space must use this
> role set." → `Project defaults`, "A collection of standard project roles."
> [Replace] · **Marketplace installation role set** — "Projects installed via
> Marketplace in this space must use this role set." → `Marketplace
> Installation Role Set` [Replace]
> — platform-security-management/images/roles-card-space-settings.png

Confirmed from the prose, which also makes the space the *only* place a role
set is applied:

> "Role sets can only be applied at the space level. All the Projects, folders,
> and files within that space can only use the roles defined in the role set
> applied in the space settings."

### But that is not what gates portfolios

The three role-set contexts are **Project, Ontology and Marketplace
Installation**. There is **no Space context**. The roles on the Space
permissions page — Contributor, Project Templates Administrator, Space
Administrator, granting *workflows* like `Curate portfolios within the space` —
are therefore **not** a role set. They are roles **on** the space, and the page
that describes them says they are the space's own:

> "Each space comes with a set of default roles and the ability to create
> custom roles for greater flexibility in managing permissions."

So the answer is a split, and each half was half of my proposal:

| | roles **on** a space | role **sets** |
|---|---|---|
| grant | workflows (`Curate portfolios within the space`) | operations (`stemma:mutate-default-branch`) |
| apply to | the space itself | projects, folders and files *in* the space |
| owned by | the space | an Organization (defaults: the enrollment) |
| gates portfolios | **yes** | no |
| our equivalent | nothing | `project_role_grants`, `ontology_role_grants` |

**Portfolios are gated by the first column**, so decision 1's per-space rows
stand. The role set is the second column and is a separate, larger object.

### Three granularities, not two

`manage-roles` also names the layer below a role, which no page read had:

> "Operations are individual permissions that Foundry applications check to
> verify a user has permission to perform a given action. Roles are sets of
> operations: when you grant someone a role on a resource (like a Project or a
> dataset), you are granting them a set of operations on that resource and any
> child resources underneath it. Each operation has a name and unique
> identifier."

With a worked example — the operation `stemma:mutate-default-branch`, "Change
default branch", in Owner "but none of the lesser roles". So *workflow* is the
Control Panel word for a bundle at organization/space scope, and *operation* is
the resource-scope permission a role set's roles are built from.

### What this says about what we already have

**Our `project_role_grants` CHECK — `owner`, `editor`, `viewer`, `discoverer` —
is the "Project defaults" role set, hardcoded**, and `ontology_role_grants` is
"Ontology defaults" hardcoded. That is a legitimate place to be: default role
sets "are always available to all Organizations", so every enrollment has
exactly these. What we lack is the *customisation*, which is three mechanisms:

> "You can only edit default roles (e.g. Viewer) for a custom role set. So to
> customize your Organization's roles, you first need to create a custom role
> set of the default roles."

> "For the new Merger role above, we've included the Viewer role, meaning all
> permissions granted by Viewer will be granted in the Merger role."

> "If an administrator replaces the current role set on a space with a new role
> set, each current role must be mapped to the replacement role."

That last one has a consequence worth keeping, since it rewrites stored grants
rather than reinterpreting them:

> "When complete, all role grants throughout the space will be updated to their
> new replacement role."

**Recorded, not queued.** Role sets are a bigger object than portfolios and
nothing is blocked on them: the defaults are what we already implement.

## 8. What `api/` adds, and why question 2 has no documentation answer

`api/v2/admin-v2-resources/organizations-list-available-roles-organization`
carries the **Role object itself**, which no prose page draws:

> "A set of permissions that can be assigned to a principal for a specific
> resource type."

Its `id` field:

> "The unique ID for a Role. Roles are sets of permissions that grant different
> levels of access to resources. The default roles in Foundry are: Owner,
> Editor, Viewer, and Discoverer."

`roleSetId` is a required string. `isDefault`:

> "Default roles are provided by Palantir and cannot be edited or modified by
> administrators."

`type` is an enum whose only published value here is `ORGANIZATION`:

> "The type of resource that is valid for this role."

And `operations`:

> "The operations that a principal can perform with this role on the assigned
> resource."

> "An operation that can be performed on a resource. Operations are used to
> define the permissions that a Role has. Operations are typically in the
> format `service:action`, where `service` is related to the type of resource
> and `action` is the action being performed."

Four things this settles:

1. **`roleSetId` is required on every role.** "All roles belong to one and only
   one role set" is not prose emphasis — it is the schema. Any role we model
   needs its set.
2. **`isDefault` is the customisation boundary**, and stated harder here than
   in the prose: default roles "cannot be edited or modified by
   administrators". Copying a default set into a custom one produces roles that
   are *not* default and therefore editable. Two states, one flag.
3. **The role's context is `type`, "the type of resource that is valid for this
   role"** — and `ORGANIZATION` is one of its values. So an **organization
   role is a Role in this same model**, which means §7's table understates the
   reach: role sets are not only about projects and ontologies.
4. **Question 2 has no documentation answer *by design*.** The workflow lists
   the Space permissions screenshot collapses are not withheld — they are an
   **API response**. `listAvailableRoles` returns each role *with its
   operations*, so the catalogue is served, not published. Our §4 conclusion
   that the role contents "are not published" was right, and this is why:
   asking the docs for them is asking the wrong source.

### An inference worth marking, because it changes a built table

**Workflow and operation look like one thing under two names.** `manage-roles`
gives an operation both a display name and an identifier — the operation "named
"Change default branch" operation (with identifier: `stemma:mutate-default-branch`)"
— and Control Panel renders a role's contents as a list of display names it
labels *workflows* (`Create project`, `Curate portfolios within the space`).
The API calls that same list `operations`, in `service:action` form.

**Marked as inference**: no page read equates the two words. If it
holds, then `organization_role_workflows` is storing display names for what the
API models as identifiers, and a future role-set build should carry the
identifier as the key with the display name beside it — the same
prose-versus-API split CLAUDE.md's vocabulary table already tracks. Worth
settling from an API page that returns a role's operations for a *non*-organization
type before anything is built on it.

## Questions

1. **Answered in §7** — the space's own roles are per-space; role sets are the
   separate Organization-owned object, and no role set has a Space context.
2. **Answered in §8 — the docs are the wrong source.** The other roles'
   contents are an API response (`listAvailableRoles` returns each role with
   its operations), not a published list. Decision 2 stands: names and
   descriptions, no invented rows.
3. **Does `Curate portfolios within the space` include creating one?** The
   prose gives creation to the "Editor role" and curation to curators, and
   Contributor holds both workflows, so the split cannot be read off the
   screenshot. I propose: **manage** creates and edits metadata, **curate**
   adds/removes projects and edits description and documentation — which is
   what §2 and §4's prose divide between administrators and curators.
