---
verify: strict
---

# Reading — the access model, and the three words for a permission

Written 2026-08-18 to settle two things the portfolios build turned up and
deliberately did not act on: **why our project reads are organization-scoped**,
and **whether a workflow is an operation**. Both are permission-model
questions, and both have published answers.

Read in full: `security/projects-and-roles`, `security/checking-permissions`,
`administration/enrollments-and-organizations-permissions`. Carried over from
earlier readings rather than re-read: `platform-security-management/manage-roles`
(§7 of `portfolios-and-space-roles`) and
`api/v2/admin-v2-resources/organizations-list-available-roles-organization` (§8
of the same).

**Nothing is built from this.** It is a floor plan for the next few phases, and
its Decisions block has not been read by a human.

## 1. Access is a conjunction of two controls, and they are not symmetric

> "Roles are sets of permissions that grant different levels of access to
> resources. Roles are a discretionary permission and generally granted at the
> Project level to provide uniform capabilities on all resources within the
> Project's scope. However, mandatory controls, Organizations and Markings,
> will *always* prevent an ineligible user from accessing a resource,
> regardless of the user's role."

Two kinds, and the asymmetry is the whole design:

| | examples | behaviour |
|---|---|---|
| **mandatory** | Organizations, Markings | **always prevent**, "regardless of the user's role" — a veto |
| **discretionary** | Owner, Editor, Viewer, Discoverer | grant, within what the veto allows |

A mandatory control can only subtract; a role can only add. Neither substitutes
for the other, which is why access needs both.

And the project is where the discretionary half is meant to live:

> "**Projects** are the primary way to organize work in Foundry, and the
> primary security boundary."

## 2. The formula, published as a UI contract

`security/checking-permissions` is the most valuable page here, because the
Check access panel has to *state* the rule in order to explain a verdict:

> "The **Check access** panel can be used to confirm if a user meets the access
> requirement for the Project, folder, or file. Displayed under **Access
> requirements**, this includes:
> 1. Satisfying the Organization and Marking requirements.
> 2. Having one or more roles (directly, via a group, or a default role)."

**That is the formula.** Access requirements = (organization ∧ markings) ∧
(≥ 1 role). The parenthesis in (2) matters as much as the clause: a role counts
whether it was granted **directly**, **via a group**, or **as a default role**.

There is then a *second, separate* layer, which gates data rather than
metadata:

> "In addition to the access requirements described above, certain files may
> require additional permissions, which are listed under **Additional data
> requirements**."

> "A dataset that inherits Markings through lineage requires access to those
> Markings to see the dataset's data."

with the failure mode spelled out in the worked example:

> "he can see the dataset and its metadata, but not its data."

So the full model is **three tests, in two layers**: organization and markings
(mandatory), at least one role (discretionary), and then inherited data
markings for the data itself. We built the third in 401 and confirmed it twice
from screenshots — it is the File/Data split.

## 3. What we have, and the one conjunct that is missing

Probed against production, not read off the tree:

- **`resource_file_access(kind, id, org)`** is the mandatory half and only that:
  organization membership, `satisfies_markings`, `passes_scoped_session`. It
  consults no role.
- **`project_role(project)`** is the discretionary half, and it is **complete
  and correct**: a direct user grant, a grant to a group the caller is in, and
  the project's `default_role` — the three ways clause (2) names — ordered by
  `role_rank` so the strongest wins.
- **The projects read policy is `resource_file_access('project', id,
  organization_id)` and nothing else.**

So the two halves exist and were never joined. **Any member of an organization
can read any project of that organization**, because the conjunct that would
require a role is not in the policy. `project_role` is used for *writes* (the
owner arm of `admins and owners write projects`) and for `check_access`, but
not for the read.

This is the same shape as the defects this repository keeps finding — a
capability built and left unreachable — except inverted: here the *guard* is
the thing built and not reached.

**The fix is one conjunct and it is not safe to ship blind.** All six projects
in production carry `default_role IS NULL`, so adding `AND project_role(id) IS
NOT NULL` would hide every project from everyone holding no explicit grant.
That is a data decision before it is a schema decision, and it is why this
reading exists instead of a migration.

## 4. Three words for a permission, at three scopes

The vocabulary is genuinely three-layered, and two of the words are the same
thing seen from different sides.

**Role** — the grantable bundle, at every scope. Organization and space roles
are granted in Control Panel; project roles are granted on the resource.

**Workflow** — Control Panel's word for what a role contains:

> "At each level, **roles** can be granted to users and/or groups. Each role
> contains a number of *workflows* which correspond to capabilities or actions
> that the people granted the role will be able to take."

> "**Enrollment administrators** and **Organization administrators** can define
> custom roles in Control Panel by selecting individual *workflows*."

**Operation** — the same idea named by `manage-roles` and by the API:

> "Operations are individual permissions that Foundry applications check to
> verify a user has permission to perform a given action. Roles are sets of
> operations: when you grant someone a role on a resource (like a Project or a
> dataset), you are granting them a set of operations on that resource and any
> child resources underneath it. Each operation has a name and unique
> identifier."

with the identifier form given by the API:

> "Operations are typically in the format `service:action`, where `service` is
> related to the type of resource and `action` is the action being performed."

### Are a workflow and an operation the same thing?

**Strong evidence for yes, and no sentence that says it outright.**

- The two definitions are the same definition — "capabilities or actions that
  the people granted the role will be able to take" against "individual
  permissions that Foundry applications check to verify a user has permission
  to perform a given action".
- Both are *what you pick* when building a custom role: Control Panel selects
  "individual *workflows*"; `manage-roles` describes customising a role by its
  operations.
- **The decisive one**: the API's Role object carries `type` with value
  `ORGANIZATION` and a list called `operations`. Control Panel's Organization
  permissions page shows those same organization roles granting *workflows*.
  **One object, one scope, two words** — which is exactly the two-vocabularies
  pattern `CLAUDE.md` already tracks for build status and entity status.
- The Control Panel permissions page even sends the reader to the project-roles
  page to "Learn more about roles", so the two levels are not meant to be
  different concepts.

*Inference, marked*: that they are one concept. What is certain is the
identifier form — an operation has "a name and unique identifier", the name
being what a person reads ("Change default branch") and the identifier being
`stemma:mutate-default-branch`.

### What that means for our tables

`organization_role_workflows` (540) and `space_role_workflows` (554) store
snake_case slugs of the **display names**, because display names are what every
screenshot publishes. Under CLAUDE.md's rule — decide which audience a column
serves — that is the right choice for what we build: our surface is Control
Panel's, where a person picks a workflow by its name.

**No identifier can be populated today.** The corpus publishes exactly one
operation identifier, `stemma:mutate-default-branch`, and it belongs to no
workflow we store. Inventing `compass:curate-portfolios` to look like the API
would be the invented citation this repository exists to prevent.

## Connects to

- **`portfolios-and-space-roles`** — §7 and §8 raised both questions; this
  answers them from the pages they pointed at.
- **`organization-permissions`** — the workflow vocabulary starts there.
- **`markings`** and **`data-lineage`** — the third test, inherited data
  markings, and the File/Data split that 401 built.
- **Our `check_access`** — already the Check access panel, and already reads
  `default_role`. It is the surface that would *show* the missing conjunct.

## Decisions (mine, not Palantir's, unless quoted)

1. **The read policy gains the role conjunct**, so access is
   `resource_file_access(...) AND project_role(id) IS NOT NULL` — the published
   formula, both clauses. **Not in the same change as the data decision below.**
2. **The data decision comes first, and it is the operator's.** Six projects
   carry no `default_role`. Foundry's own wording — "Everyone from <org> … is
   granted the <role> role", already quoted in `project_role` — describes
   exactly the default that would preserve today's behaviour. *Inference*: that
   backfilling `default_role = 'viewer'` on existing projects is the
   behaviour-preserving move, and that new projects should take a default at
   creation rather than inherit one silently. I would not guess which role.
3. **`project_role` is not rewritten.** It already implements clause (2)
   exactly — direct, group, default, strongest wins. The defect is that nothing
   reads it on the read path.
4. **Folders and files keep inheriting**, per "role grants inherit to child
   resources" and "granting a user Viewer on a Project or folder gives them
   Viewer on all resources contained by that Project or folder". We already
   resolve a resource to its project; nothing new is needed.
5. **Workflow stays our word, and the identifier is recorded, not invented.**
   A workflow row may gain an `operation` column when a page publishes an
   identifier for it, growing one card at a time the way 542 grew the
   catalogue. Until then the column would be empty and dishonest.
6. **Role delegation is unbuilt and worth having**: "Each role can assign other
   users the same or lesser role. For example, an Owner can grant any other
   user the Owner, Editor, Viewer, or Discoverer role, while the Discoverer can
   only grant other users the Discoverer role." We have `role_rank`, so this is
   a predicate over an ordering we already store — but no policy enforces it
   today.
7. **Recorded, not queued**: the role-grants-on-folders-and-files toggle
   ("Role grants on folders and files are disabled by default. Space
   administrators can change the default behavior at the space level"), which
   is now buildable because 554 gave spaces settings to hold it.

## Built (2026-08-18) — migrations 557–560

Decisions 1 and 3 shipped; decision 2 dissolved; two defects were found on the
way that the conjunct alone would never have shown.

**557 — the fixtures 554 and 555 left in production.** A migration with no
`COMMIT` of its own is wrapped in one, so rows an assertion inserts are
committed with the schema change. 552 and 553 dropped their probe *tables*; 554
and 555 left probe *rows* — three organizations, four spaces, three projects,
two portfolios, two users. Deleted, child-first, with the reverse direction
asserted too so a careless cleanup could not take the three default space roles
with it.

**558 — the conjunct, and question 1 answered by not arising.** The read
policies for `projects` and `datasets` now read
`resource_file_access(...) AND project_role(...) IS NOT NULL`. **`folders`
already did exactly this**, so the change brings two siblings into line with a
third rather than introducing a pattern.

Decision 2 asked which `default_role` would preserve behaviour, `viewer` or
`discoverer`. **Neither.** Every user/resource pair in production was checked
first: both users hold an explicit `owner` grant on the one shared project, and
each personal project is owned by its person. **Zero pairs lose visibility**, so
a backfill would have been a change dressed as a migration. The question was
real and the answer was that the data already satisfied the stricter rule.

**559 — a restatement that disagreed with the predicate beside it.** One
standing test failed, and correctly. `project_role` tested each grant with
`g.organization_id = auth_org_id()` — the caller's *primary* organization — while
`resource_file_access` beside it accepts `auth_org_ids()`, primary **and**
guest. So a guest could not hold a grant made to them in the host organization.
Replaced with `auth_in_org(...)`, which is that rule already composed. The
intent the restatement protected is unchanged: a grant in an organization the
caller does not belong to still counts for nothing.

**560 — a predicate that answered differently depending on who asked.** The
guest case still failed, and the cause was in neither function.
`project_role` is consulted *by* a policy and reads `project_role_grants`,
which is RLS-guarded, whose read policy is also primary-organization-only. As
SECURITY INVOKER it returned `viewer` to the owner and NULL to the caller.
Made SECURITY DEFINER, which is what every sibling predicate already is
(`auth_in_org`, `auth_org_ids`, `auth_group_ids`) — and which also removes a
recursion that was sitting in plain sight, since `role holders grant` is a
policy on `project_role_grants` that calls a function reading
`project_role_grants`. **A policy may not read the table it guards** is the
standing rule from the last time that happened.

The function stays safe because its body only ever answers about the caller:
`g.user_id = auth.uid()`, groups from `auth_group_ids()`, `auth_in_org` on
every arm.

**The 492 test was corrected, not weakened.** It asserted that guest membership
*alone* let a visitor read the host's project — the mandatory half standing in
for the whole formula. An organization is "an access requirement applied to
Projects": a gate, never a grant, and
`security/cross-organization-collaboration` grants a guest their roles as a
separate explicit act. The guest now holds a `viewer` grant, the read-only half
that was always the point is unchanged, and a new case asserts that a guest
with no role reads nothing.

`accessModel.test.ts` is the standing guard: grant admits, no-role refuses, the
predicate agrees with itself across roles, a guest-organization grant counts,
guest membership alone does not, the mandatory control still vetoes a role
holder, and datasets obey the same conjunction.

## Built (2026-08-18) — migration 561, and a decision that was already built

**Decision 6 needed nothing.** The delegation rule — "Each role can assign
other users the same or lesser role… while the Discoverer can only grant other
users the Discoverer role" — is already enforced, as
`Projects:GrantExceedsRole`. I had it down as an unbuilt gap and expected to
find a privilege escalation; probing as a real caller found a discoverer
refused both `owner` and `editor` and allowed `discoverer`. It is now asserted
in the suite, because a guard nobody has watched fail is not a guard.

**561 — the same conjunct, one table over.** `project_resources` is the
placement ledger, and its write policy already required `editor` while its read
policy asked only for the organization. So after 558 a caller with no role
could not see a project and could still enumerate its contents. Closed on
inheritance: "role grants inherit to child resources… granting a user Viewer on
a Project or folder gives them Viewer on all resources contained by that
Project or folder."

**The sweep behind it.** Every permissive read policy gated on `auth_org_id`
alone was listed — 36 — and the rest are not this. Org-level registries
(users, groups, tags, spaces, organizations) are meant to be visible to
members; portfolios and collections are **specified** as organization-visible
and 555 asserts it; the role vocabularies and grant ledgers are their own
thing. *Recorded, not changed*: `builds`, `build_jobs`, `schedules` and
`schedule_runs` read org-wide over pipeline objects that belong to datasets,
which belong to projects. Whether a build is a "child resource" of its project
in the inheritance sense is not answered by any page cited here, and belongs to
whoever reads the builds pages next.

## Questions
2. **Does the role conjunct apply to every resource kind, or only to those
   Compass governs?** `resource_file_access` is called for several kinds. The
   pages speak of "a Project, folder, or file"; whether an ontology entity
   resolves through the same path here has not been checked.
