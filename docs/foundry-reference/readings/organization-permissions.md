---
verify: strict
---

# Reading — Organization permissions, and who you are allowed to see

DELIVERABLE-MAP §4 says the guest picker adds foreign principals by ID because
registries are org-siloed, that our old entry claimed Control Panel "searches the
enrollment" as **our inference rather than a citation**, and that the entry needs
its own reading before anything is built. This is that reading.

**Read in full:** `administration/enrollments-and-organizations-permissions`,
`platform-security-management/manage-groups`.

**Images parsed:** `administration/images/permissions-organization-permissions.png`
(the one that changes the answer), `administration/images/permissions-enrollment-permissions.png`,
`platform-security-management/images/manage-group-members.png`.

**Read, and nothing below quotes them:** `platform-security-management/manage-roles`
and `security/projects-and-roles` — the role vocabulary one level down, read to
see where an Organization role stops and a project role begins.

## 1. Two levels, and they do not inherit

> "Permissions in Control Panel are managed at two different levels: Enrollments and Organizations. Each level has a dedicated page to manage permissions."

> "The levels are strictly independent. For example, a user who can manage permissions for an enrollment will not necessarily be able to manage permissions for the enrollment's Organization(s). This provides the ability to delegate or separate responsibilities, in particular for cases where multiple companies collaborate on the same Foundry platform."

The last clause is the one that matters for us: **the multi-company case is the
reason the levels are independent**, and a guest picker crossing organizations is
exactly that case.

## 2. A role is a bundle of workflows, granted to users or groups

> "At each level, roles can be granted to users and/or groups. Each role contains a number of workflows which correspond to capabilities or actions that the people granted the role will be able to take."

> "Each level has different roles, but within each level there is a role with the highest level of permissions (Enrollment administrator and Organization administrator, respectively)."

and those top roles both grant permission-management and subsume the rest:

> "Grant the ability to manage permissions for the enrollment/Organization, and therefore the ability to grant other roles; and Incorporate all workflows from other roles of that level."

Custom roles exist and are per organization:

> "Custom roles are not shared across organizations, so different custom roles can be defined for different organizations."

## 3. What the screenshot adds, and it changes the answer

The prose in `manage-groups` describes the grant as a **per-permission dropdown**:

> "You will only be able to view groups for which you have `View group membership` permission on the group's Organization. This permission can be granted from Settings > Platform Settings > Organizations by selecting the Organization of interest and then choosing Manage for Organization permissions. This will display a list of users and groups as well as a search box; for users and groups that have been added, use the dropdown box to enable the View group membership option."

**The Organization permissions page in the screenshot does not work that way.**
It is a list of **role cards** — each with a name, a description, the avatars of
its grantees, and a footer counting what it confers — and the right-hand panel
reads *Select a role to manage grants to users or groups*. Grants hang off the
role, not off a per-user permission dropdown. Two default roles are visible:

> "User experience administrator — Manage the Foundry experience for members in this organization"
> — administration/images/permissions-organization-permissions.png

> "Users and groups administrator — Manage users and groups in the organization"
> — administration/images/permissions-organization-permissions.png

with footers reading *Grants 24 workflows and unlocks 7 settings* and *Grants 4
workflows*. And beneath the second sits the sentence that reconciles the two
descriptions:

> "This role replaces user and group administration permissions previously granted via Manage membership in Platform settings."
> — administration/images/permissions-organization-permissions.png

**So there are two mechanisms and one is replacing the other.** The prose
documents the older per-permission grant; the screenshot shows the role model
that is superseding it, with a migration note saying so. A third signal agrees:
the page's own callout says application-specific roles "are legacy standalone
roles that are in the process of migrating to roles as described above", and
that until then they "are not incorporated in the Organization administrator
role and cannot be included in custom roles".

The page also carries a **Marking permissions** tab beside **Roles**, which no
sentence on either page mentions.

## 4. What a group holds, and who may see it

From `manage-groups`, the fields that bear on visibility:

> "Organizations: Defines the members of Organizations who can see this group and its description."

> "Group permissions: Defines users with permissions to manage aspects of the group. There are two types of administrative permissions:"

> "Manage permissions: Users who can grant permissions to manage aspects of the group, manage its members, and edit its metadata."

> "Manage membership: Users who can manage the group's members, including membership expiration properties."

So group visibility is a property **of the group** (its Organizations list),
while the right to *view membership* is a permission **on the Organization**.
Two different gates, and our model has neither.

Membership can also expire, which we do not model at all:

> "If you can `Manage membership` on a given group, you can mandate that new memberships to the group are temporary."

> "Latest expiration: All new memberships must have an expiration date that is earlier than this date."

> "Maximum duration: All new memberships must expire within the specified duration."

> "When both are set, the latest allowed expiration will be the most constraining property of the two."

## 5. Against what we have

- We have `groups` and `group_members` (S1) with no expiry, no group-level
  `Organizations` list, and no Manage-permissions/Manage-membership split.
- We have no Organization-level permission of any kind. `auth_org_id()` decides
  membership of one org, and every registry read is siloed by it.
- The guest picker adds foreign principals **by ID** precisely because there is
  no permission that widens visibility. That remains the correct behaviour for
  a platform with no such permission — it is a missing capability, not a bug.

## Decisions

1. **Do not build the `View group membership` dropdown.** The prose describes it
   and the screenshot shows it being replaced by a role. Building the mechanism
   Foundry is migrating away from would be copying a state the documentation says
   is temporary — the same mistake as building Phonograph's status scalar.
2. **The unit to build is a ROLE GRANTED AT THE ORGANIZATION LEVEL**, bundling
   workflows, granted to users or groups, with `Organization administrator`
   subsuming the others. That is what both the prose and the screenshot agree on.
3. **Keep the guest picker adding by ID** until such a role exists. It is not a
   workaround for a missing search; it is the correct behaviour when no
   permission widens visibility.
4. **Group membership expiry is a separate, smaller piece** and is not part of
   §4. Recorded here so it is not lost.
5. **Nothing is built from this reading yet** — the recitation gate.

## Questions — all three answered, by looking harder rather than by asking

The operator's response to the first draft was that the material exists and my
crawler had not caught it. Both halves were true, and the fix was two different
kinds of looking.

### Q1 — which workflows a role grants. ANSWERED, and the shape is the answer

**Foundry publishes no central role→workflow catalogue.** It documents each
workflow **at the point of use**, on the page for the thing the workflow
unlocks, naming the role that grants it:

> "To view and configure the Application access section in Control Panel, a user needs the **Manage application access** workflow, which is granted by the **User experience administrator** role. Roles are administered in the **Organization permissions** tab in Control Panel."

> "a user needs the **Manage platform version** workflow, which is granted by the **User experience administrator** role"

Others name the role the same way, distributed the same way — a
`Manage Auth Chooser Enterprise Presets` workflow "as part of either the
`Data governance officer` or `Organization administrator`" role, a
`Manage public Slate applications` workflow "grantable through Control Panel's
**Organization permissions** settings", and a `View usage metrics` workflow
granted "on the organization".

**So the unit is the workflow and the role is a bundle assembled from where the
workflows are used** — which is the same shape as our own rule against
allowlists: the catalogue is not a list to maintain, it is what you get by
indexing the places that need it.

### Q2 — the fate of `View group membership`. ANSWERED enough to build on

It is granted from Organization permissions either way, and the corpus calls it
both things in the same breath — `workshop/widgets-user-select` says users need

> "the `View group membership` role on the organization for configured groups"

two paragraphs before calling it

> "the `View group membership` permission on the group's Organization"

That is the two-vocabularies trap CLAUDE.md names, not a contradiction about
mechanism. **Whether it survives the migration as a standalone grant is still
unstated — and no longer blocking**, because the grant point is the same under
both models: a role or permission held **on the Organization**.

### Q3 — the `Marking permissions` tab. ANSWERED, and it is not ours to build here

`manage-markings` has the section, and its callout draws the line exactly:

> "The permissions below apply to resource-level markings. Organizations have a separate permission model with their own **Apply organization** and **Expand access** permissions."

So the tab beside `Roles` is the **resource-level** marking permission surface
(`Manage permissions`, `Apply marking`, and the rest), which our markings
reading already covers. **Organization-level marking permissions are a different
pair** — `Apply organization` and `Expand access` — and those belong to the
organization model, not to the role model this reading is about.

## What the search itself found, which matters more than the answers

The pages were not missing because the crawler failed on them. **The crawler
cannot see them at all**: `mirror-foundry-docs.mjs` derives its index from the
sitemap, and its own comment says the sitemap "caps at 5,000 URLs". Every gap
check we run diffs against that index, so a page outside the cap is invisible
to all of them — including the check whose job is finding gaps.

Diffing the **links in the prose we already hold** against the index found 559
linked-but-unmirrored pages, six of which **were not in the index at all**. All
six are real, and one is `logic/staged-writes` — beside the TypeScript staged
writes this build already read. They are mirrored now, and the index carries
them.

## Are the default roles' contents published? No — checked properly

The operator's expectation was that a core configuration would be stated
clearly, and it is reasonable. It is not stated at all, and this is how that was
established rather than assumed.

**The docs site ships its own sidebar tree** in `pageProps.sidebarNavProps`,
which enumerates pages independently of the sitemap and its 5,000-URL cap. The
links there are `/foundry/<section>/<page>/` — **not** `/docs/foundry/...`, which
is why the earlier link-diff never saw them. Crawling the trees behind
`administration/enrollments-and-organizations-permissions`,
`platform-security-management/manage-groups` and `security/overview` reaches
**258 pages**, and none is a role or workflow reference. The unmirrored remainder
is adjacent material — use-case examples, adoption phases, Cipher, the upgrade
assistant — and `resource-management` and `platform-security-third-party` were
mirrored to close the two that could plausibly have carried it. Neither does.

So the position is:

- **Each workflow is documented at the point of use**, naming the role that
  grants it — that is the only published mapping, and it is where our seed comes
  from.
- **A role's full contents live behind `Show details`** in the product. The
  screenshot shows *Grants 24 workflows and unlocks 7 settings* as a **count**,
  never a list, which is consistent with the list existing only in the UI.
- **Therefore the seed cannot be completed from the corpus.** It grows one
  mapping at a time as pages name them, and that is not a gap in the reading —
  it is the shape of what Palantir publishes.

**What would settle it** is a capture of the Control Panel role detail from
learn.palantir.com, the way `docs/foundry-deep-dives/` holds nine course
captures. That is the operator's to supply; nothing on the public site answers
it, and inventing the other twenty workflows would be the invented citation this
repository exists to prevent.

## The four Control Panel pages — what they settle, and the conflation they expose

The operator supplied `administration/control-panel`,
`administration/control-panel-approvals`, `map/control-panel` and
`code-repositories/configure-repositories-in-control-panel`. All four were
already mirrored. They do not publish the role contents, and they clarify three
things that matter more.

**1. Two more point-of-use mappings, confirming the pattern is the rule:**

> "To modify these settings, you will need the `User Experience Administrator` role."

(`code-repositories/configure-repositories-in-control-panel`.)

> "To modify Map settings, you will need the `Map Admin` role."

(`map/control-panel`.)

**2. `Map Admin` is the worked example of the flag 540 built.** It is named by one
application's settings page and by nothing else — which is exactly what the
permissions page means by "Application-specific roles under Organization
permissions are legacy standalone roles that are in the process of migrating",
and why those "are not incorporated in the Organization administrator role and
cannot be included in custom roles". `organization_roles.application_specific`
exists for roles of this shape.

**3. THE CROSS-LINK GOES SOMEWHERE ELSE, and this is the real find.** Both pages
above link the word *role* to `security/projects-and-roles#roles`. That section
documents a **different role family**:

> "From most powerful to least powerful, the default roles in Foundry are: Owner, Editor, Viewer, and Discoverer."

Those are **Project** roles — discretionary, inherited to child resources,
"generally granted at the Project level" — and we already hold them as
`project_role_grants`. They are not Organization roles, and no page reached from
that anchor lists an Organization role's workflows.

So the pages that look like they would lead to the catalogue lead to the other
role system entirely. **Two role families, one word, cross-linked as though they
were one.** That is the two-vocabularies trap at the level of navigation rather
than wording, and it is why this looked answerable for longer than it was.

**Also found, and not built:** Control Panel has an Approvals integration —
"a dedicated Approvals integration designed to facilitate the process of
requesting, approving, and maintaining a history of sensitive workflows within
Control Panel" — currently covering network ingress, egress and SDK web hosting.
Recorded in the gaps list rather than half-built.
