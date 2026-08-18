---
verify: strict
---

# Reading — project roles, access requirements, constraints and portfolios

Answers four questions the operator raised, and closes two open ones from
`spaces-and-the-resource-path.md`.

Pages read in full:
- `mirror/security/projects-and-roles.md`
- `mirror/security/project-constraints.md`
- `mirror/platform-security-management/manage-project-constraints.md`
- `mirror/security/portfolios.md`
- `mirror/security/orgs-and-spaces.md` (re-read for the space/ontology claim)
- `mirror/object-link-types/mandatory-control-properties.md` (the org quantifier)
- `mirror/pipeline-builder/outputs-remove-markings-and-organizations.md` (same)

Images read closely:
- `security/images/namespace-org-projects-diagram.png` — **the subset question, drawn**
- `security/images/pmc-1.png` — **the access-requirement conjunction, on a project**
- `security/images/flight-delay-project.png` — the Manage roles panel
- `security/images/advanced_settings_roles.png`, `space-settings-role-grants.png`
- `security/images/portfolio-card-view.png`

---

## 1. A project's access requirements are a conjunction, and the UI says so

`pmc-1.png` shows the **Access** panel of a project (`Aviation [Ontology]`), with
two tabs — **Requirements** and **Check access** — under a heading that states the
rule outright:

> "Users must meet all of the following requirements to access this project"
> — security/images/pmc-1.png

Three cards, joined by a literal **AND** between each. **Organizations · Any of**
holds `🏢 Sky Industries`; **Markings · All of** holds `🛡 Information: PII`; and
the **Roles** card carries a row of principal avatars over this line:

> "Everyone from Sky Industries meeting access requirements can see the
> existence of this project and is granted the Discoverer role. You also have
> the Owner role."
> — security/images/pmc-1.png

**The quantifiers are in the labels.** `Organizations · Any of`. `Markings · All
of`. That is not inferred; it is printed on the card. And two other pages state
the same rule in prose, independently:

From `security/security-glossary`:

> "An access requirement applied to resources that restricts access in an
> all-or-nothing fashion. In order to meet access requirements, a user must be
> a member of *all* Markings applied on the resource. Markings are a mandatory
> control."

and the other half, from `security/orgs-and-spaces`:

> "To meet access requirements, users must be a member or guest member of at
> least one organization applied to a Project."

with `object-link-types/mandatory-control-properties` saying the same of any
resource:

> "If a resource has multiple organizations, the user must be a member of at
> least one of the organizations applied to the resource."

This is the same four-slot shape as the object security policy dialog from
`object-permissioning`, one level up: it is how a **project** is permissioned, and
an object type inherits from the project it is saved in.

Also visible on that screenshot: a **Project constraints** popover reading "One
marking is allowed in this project. **Allowed markings** — Only the following
marking is allowed in this project and can be set as an access requirement", with
`Information: PII`. So the *constraint* and the *requirement* sit next to each
other and are different things — see §4.

## 2. Roles — the Manage roles panel

`flight-delay-project.png`, the panel behind "Roles → Manage":

- **Default role** ⓘ — a dropdown, currently `Discoverer`
- "Add a user or group…"
- Three rows, and every one of them is a **group**, not a person:
  `Flight Delays [Transform] - Editor` → `Editor`
  `Flight Delays [Transform] - Owner` → `Owner` *(tagged **You**)*
  `Flight Delays [Transform] - Viewer` → `Viewer`
- **Flatten group members** ⓘ — a toggle, off
- a footer line:

> "This project is using roles from Project defaults."
> — security/images/flight-delay-project.png

Three things the prose does not say:

1. **Foundry auto-creates one group per role per project**, named
   `<Project> - <Role>`. That is what the recommendation to grant group roles at
   the project level looks like when the platform does it for you.
2. **`Default role` is a standing setting on the project**, not a one-time
   grant, and the grantee is **the organization** rather than the creator. The
   create dialog names the effect:

> "Everyone from Palantir can see the existence of this project and is granted
> the Viewer role."
> — security/images/pmc-1.png

3. The footer names the **role set**, which `manage-orgs-and-spaces` lists as a
   space creation setting:

> "**Role set:** Controls which roles are available to projects. Defaults to
> `Project defaults`, but you can use a custom role set instead."

   So which roles exist is a space-level choice, and a project declares which
   set it follows. (§7 of `portfolios-and-space-roles` works out what a role set
   actually is.)

The ladder itself, quoted:

> "From most powerful to least powerful, the default roles in Foundry are:
> **Owner, Editor, Viewer, and Discoverer**. Each role can assign other users the
> same or lesser role… These defaults can be customized to include completely new
> roles."
>
> "role grants **inherit to child resources**. For example, granting a user Viewer
> on a Project or folder gives them Viewer on all resources contained by that
> Project or folder."

And the boundary between discretionary and mandatory, stated in one sentence:

> "Roles are a **discretionary** permission… However, **mandatory controls,
> Organizations and Markings, will *always* prevent an ineligible user** from
> accessing a resource, regardless of the user's role."

### Resource-level role grants

A project setting, `advanced_settings_roles.png`:

The project's own toggle, **Allow resource level role grants**, shown off:

> "When enabled, users can be assigned roles on folders and files."
> — security/images/advanced_settings_roles.png

And its space-level default, under a heading **Resource-level role grants**,
also off — note the wording differs deliberately, since the space sets the
default *for new projects* while the project sets its own:

> "When enabled, users can be assigned roles on folders and files in new
> projects by default."
> — security/images/space-settings-role-grants.png

The prose says which way to leave it:

> "Role grants on folders and files are disabled by default. Space
> administrators can change the default behavior at the space level. We
> recommend keeping role grants on folders and files disabled."

Turning it off is destructive, and says so:

> "If the role grants setting is disabled for Projects already containing
> resources with role grants, role grants against these individual resources
> will be removed. Once an existing role grant is removed, it cannot be re-added
> until the setting is re-enabled."

Link sharing goes with it:

> "Project link sharing capability will also be removed as link sharing gives
> the receiver of the link a direct role grant on the individual folder or
> file."

**Built (2026-08-18)**: none of this, deliberately — see
`access-model-and-permission-vocabulary`. We have no folder or file level for a
grant to attach to, so the toggle would be a switch over nothing, and the state
we are permanently in is the one this page recommends.

## 3. Requesting access

Three entry points, each for a different starting position:

- **Request access** — beside the project name in **Projects & files**, and when
  opening a resource you cannot view (a direct link)
- **Request project access** — inside the project view, "if a user only has the
  **Discoverer** role"
- **Request additional access** — in the project's **Actions** dropdown, "if a user
  has access to the Project"

> "The access request will include **all changes required** to give the user access
> to a Project, including any required **Markings**."

The request asks for a reason, who it is for, and *how* they should be granted —
and the recommended answer is a group, not a direct grant:

> "In the **Request access** pop-up, users can select to get access to a group
> with an appropriate role on the Project."

Only when no group is available does it fall back to a direct grant, and that
route needs an owner's approval:

> "If there are no groups assigned to the Project, a user can request to be
> added directly to the Project with a given role. This will create a Project
> access request task and require approval from users who have the Owner role
> on the Project."

One rule worth keeping: **a request on a file is a request on the project.**

> "When users select **Request access** on a file or folder inside a Project, the
> access request will be submitted **on the Project itself** (not the specific
> resource). When reviewing the request, the file or folder where the request was
> submitted is shown to provide additional context."

## 4. Project constraints — a limit on markings, not a requirement

Three types, and they constrain what *may be applied*, not what a user must hold:

**Corrected 2026-08-18**: the first two were quoted truncated, and the dropped
clause is the one this section is about — each says what may be *set as an
access requirement*, which is precisely the constraint/requirement distinction.

> "**No constraints (default):** All markings are allowed in the Project and can
> be set as an access requirement."

> "**Allowed markings:** Only specified markings are allowed in the Project and
> can be set as an access requirement in Project files."

> "**Prohibited markings:** The specified markings are not allowed in this
> Project… This constraint effectively allows data with any marking, except
> those listed, to be used in the Project."

`manage-project-constraints` adds who may set one, and a guard against setting
a constraint that the project already violates:

> "To add a constraint on a Project, you must have an `Owner` role on the
> Project and add “Apply marking" permissions on all markings added as a Project
> constraint. You will not be able to add or modify a Project constraint if
> doing so would cause an existing file in the Project to be in violation of the
> constraint you are trying to add."

And the consequence of a violation arriving later — which is a **build**
outcome, not an access one, and the sharpest evidence that a constraint is not
a requirement:

> "After a Project constraint is applied, a dataset could still violate the
> Project constraint if a violating marking was added somewhere upstream and
> inherited by a dataset in the Project. This is surfaced by a warning on the
> dataset that is in violation. If the dataset violates the Project constraints,
> it cannot be built until the violation is resolved."

The purpose is stated, and it is not access control:

> "Project constraints are typically used to **prevent users from accidentally
> joining data**. There are situations where users might need access to multiple
> markings though specific combinations of marked data should not be allowed."

The worked example: a bank where "sensitive investment data can never be joined
with research data", while compliance officers legitimately hold both.

Enforcement is at write and at build:

> "Project constraints **prevent users from saving violating files** to a Project…
> if a dataset **violates its Project constraints, it cannot be built** until the
> violation is resolved."

And a violation can arrive without anyone touching the project: "a dataset could
still violate the Project constraint if a violating marking was added somewhere
**upstream and inherited**." Three named resolutions: allow the marking, remove the
offending inputs, or remove the upstream marking.

To set one you need `Owner` **and** "Apply marking" permission on every marking in
the constraint — and "You will not be able to add or modify a Project constraint if
doing so would cause an **existing file** in the Project to be in violation."

## 5. Portfolios

> "Portfolios allow users to **organize Projects within a Space**. Each Portfolio
> contains many Projects, and **each project belongs to a single Portfolio**. Any
> user with access to a Space can view its Portfolios, but users still **separately
> need permissions to view the Projects** inside a Portfolio."

So a portfolio is **curation, not security** — visibility of the portfolio does not
imply visibility of its contents.

`portfolio-card-view.png` puts **Portfolios** as a top-level tab beside Projects,
Your files and Shared with you, with **Manage spaces ⚙** at the top right and the
subtitle "Explore groups of projects that **map to a line of effort** in your
enterprise". Cards carry a coloured icon, name, description, a project count
(`4 Projects`, `0 Projects`) and a favourite star.

Rules: created by "users with the **Editor** role on a Space"; each needs "a Space
and a unique name"; **"Portfolios cannot move between Spaces after creation"**;
moving a project into a portfolio removes it from its previous one; projects can be
given a **display name** that differs inside the portfolio. Curation can be widened
beyond space Editors via an explicit **Curators** list. A **catalog** shows
resources "that have been pinned in a project… grouped by project or resource type".

**This closes open question 2 from `spaces-and-the-resource-path.md`** — a
portfolio is a grouping of projects inside a space. (Value types, the other half of
that question, remain undefined anywhere read.)

## 6. Projects holding a subset of the space's organizations — answered

The operator asked for a search. One prose statement, one diagram, and two
corroborating pages.

> "In the case of a space with multiple organizations, **projects inside that space
> can have any subset of the organizations**. For example, if there is a shared
> space with both the Sky Industries and Sunrise Airline organizations applied,
> projects inside that space can be created with just Sky Industries or just
> Sunrise Airline… or *both*."

`namespace-org-projects-diagram.png` draws exactly that, and it is unambiguous:

```
Namespace   [ Sky Industries & Sunrise Airline Collaboration ]  (S.A) (S.I)

Projects    (S.A)(S.I)              (S.A)                  (S.I)
            Collaboration project   S.A. landing project    S.I. landing project
```

One space with two organizations; three projects with three *different* subsets.
Combined with `Organizations · Any of` from `pmc-1.png` and the two prose
statements in §1, the model is fully determined:

- a **space** has a set of organizations
- a **project** has a subset of them
- a **user** passes if they are a member or guest member of **at least one**
- organizations "are **inherited via the file hierarchy** and direct dependencies"

### Where ours diverges, and why the project-org set is not the real gap

Ours: `projects.organization_id`, exactly one. A set of size one is a valid subset,
so the *shape* is a narrowing rather than an error.

But the deeper divergence is the last bullet. **Foundry inherits organizations down
the hierarchy; we denormalise them.** Every table we have carries its own
`organization_id` — `object_types`, `object_sets`, `datasets`, `link_types`. In
Foundry none of those would: a dataset's organizations are the project's.

That makes the ordering clear, and it is the opposite of what it first looked like:

1. Adding `project_organizations` **on its own buys nothing** — resources would
   still read their own column, so the set would have no consumer. That is the
   "nothing reaches it" shape.
2. The change that matters is **inheritance**: resources stop carrying
   `organization_id` and resolve it from their project. 32 of 54 RLS policies call
   `auth_org_id()`, and that is the rewrite.
3. Multi-organization projects then follow almost for free.

None of that is worth doing while there is one organization and no cross-tenant
collaboration — but it is worth writing down that **the blocker is inheritance, not
cardinality**, because "add a join table" looks like the answer and is not.

## 7. Should a space have a RID? — an assessment

The operator asked how to read the absence. Both sides, then a conclusion.

**For:** `interfaces/interface-metadata` says a RID is "An automatically generated
unique identifier for **every resource in Palantir**." Spaces can be **Shared**
between enrollments (`control-panel-create-space.png`), which needs a stable
identifier that survives crossing an enrollment boundary. And the closest
analogue — an **organization**, which is likewise an access-control container
rather than a file — demonstrably has one, `ri.multipass..organization.<uuid>`.

**Against:** `security/orgs-and-spaces` draws a line that puts spaces on the far
side of it: "The scope of information protected by organizations includes **spaces,
ontologies, projects, users, groups, tag categories, and collections. However,
individual resources cannot be tied to an organization.**" Spaces are named in a
category that is explicitly *not* "individual resources". More tellingly, the one
place Foundry hands a user identifiers is the Control Panel details panel — and for
an organization that panel has a section headed **Organization IDs** with both a
Marking ID and a Resource ID, while the **space settings page has no such section
at all**. Name, Path, Description, and nothing else. Foundry also gives a space a
*separate* identifier for a specific purpose — the **Maven identifier**, "Uniquely
identifies resources published from this space" — which is not what you would build
if a RID were the answer to that question.

**Conclusion.** A space very likely *has* a RID internally; "every resource" is a
strong claim and cross-enrollment sharing needs one. But the identifier Foundry
**exposes** for a space is its **`Path`** — greyed, copy-shaped, six hex characters
appended so it is globally unique. That is the one a user or an integration is
given, and it is the one every resource location starts with.

**So: no RID for our spaces, and not because none exists — because the documented
user-facing identifier for a space is its path, and we already have it.** If a form
ever turns up in the docs, adding it is one generated column. Inventing
`ri.compass.main.space` today would be the `object_type_impact` mistake with a
better excuse.

---

## Connects to

- **`spaces-and-the-resource-path`** — closes its open question 2 (portfolios) and
  answers the RID question it deferred. Question 1 (what makes a project "public")
  and value types are still open.
- **`object-permissioning`** — `pmc-1.png` is the same conjunction one level up.
  "Ontology resources are saved into a project, and the selected project determines
  who can view, edit, and manage them" now has the project's own panel behind it.
- **`security/markings`** — required by three separate things now (project
  constraints, the Markings requirement card, mandatory control properties) and
  still unread. It is the largest single gap in our security model.
- **Our `projects`, `project_role_grants`** — the ladder matches. What is missing:
  the standing **Default role**, the auto-created per-role groups, the role set,
  the resource-level-grants toggle, and constraints.

## Decisions taken from this reading

2026-08-06. Migration 398.

1. **`projects.default_role` is a standing setting, granted to the organization.**
   Our `useCreateProject` treated it as a one-time grant **to the creator**, with a
   comment rationalising it as the only member the project had at that point. The
   screenshot disproves both halves: `Default role` is a persistent dropdown in
   Manage roles, and the create dialog's own sentence says "**Everyone from
   Palantir** … is granted the Viewer role."
2. **`project_role()` returns the stronger of the explicit grant and the default**,
   which is what "everyone from <org> … is granted <role>" means when a policy
   asks.
3. **No RID for spaces** — see §7.

### Not built, each with a reason

- **`project_organizations`** — see §6. The blocker is inheritance, not
  cardinality, and a set with no consumer is worse than a column.
- **Project constraints** — they constrain *markings*, and we have no markings.
- **Portfolios** — curation over projects, and we have zero projects. It is also
  purely organisational: "users still separately need permissions to view the
  Projects inside a Portfolio."
- **Per-role groups, role sets, resource-level grant toggle** — each needs a thing
  we do not have (groups, custom roles, folder/file-level grants).
