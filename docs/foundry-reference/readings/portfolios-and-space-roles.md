---
verify: strict
---

# Reading — Portfolios, and the space roles they rest on

Written 2026-08-18, picking up the deliverable map's portfolios entry — the
half of Compass that C1 and C2 did not cover. Read in full: `security/portfolios`,
`platform-security-management/manage-orgs-and-spaces`. Images opened and
transcribed: `platform-security-management/images/space-permissions.png` —
**the page that settles this** — and `security/images/portfolio-curators.png`.
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
   Administrator, Space Administrator.
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

## Questions

1. **Do the three default roles exist per space, or per enrollment?** The page
   says "Each space comes with a set of default roles", which reads per-space,
   but the Role set setting ("Controls which roles are available to projects…
   you can use a custom role set") suggests role sets are a shared object
   spaces point at. §4 hit the same ambiguity for organizations. **I propose
   per-space rows seeded at creation**, and flag that a role *set* is probably
   the real Foundry object.
2. **What are the other 61 + 1 workflows?** Not published anywhere read; the
   screenshot collapses them. Recorded as a known hole, exactly like §4's.
3. **Does `Curate portfolios within the space` include creating one?** The
   prose gives creation to the "Editor role" and curation to curators, and
   Contributor holds both workflows, so the split cannot be read off the
   screenshot. I propose: **manage** creates and edits metadata, **curate**
   adds/removes projects and edits description and documentation — which is
   what §2 and §4's prose divide between administrators and curators.
