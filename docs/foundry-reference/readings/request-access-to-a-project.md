---
verify: strict
---

# Request access to a Project

The consumer gap the Approvals arc left named: nothing in the web FILES a
request. The page that closes it also settles an older open finding — whether
our org-scoped project listing is a leak or a feature.

**What I read, counted rather than asserted.**
`security/projects-and-roles` whole (117 lines). **Images: two parsed** —
`project_access_request.gif` (a GIF; only its first frame parses, which shows
the wizard's first step whole) and `success_message.png`. Nine named and not
parsed, all illustrating sections outside this chunk:
`project-containment.png`, `resource_access_request_request.png`,
`access-panel.gif`, `references.png`, `reference_to_flights.png`,
`create-projects.png`, `flight-delay-project.png`,
`advanced_settings_roles.png`, `space-settings-role-grants.png`.

## 1. The finding resolves: discoverability is the flow's precondition

> "Users can submit access requests for Projects they are not authorized to access. The access request will include all changes required to give the user access to a Project, including any required [Markings](/docs/foundry/security/markings/)."

— `security/projects-and-roles.md`

The entry points are in the filesystem view — "Located next to the Project
name in the **Projects & files** view" — so a project's EXISTENCE is visible
to people who cannot open it; that is what makes requesting possible. Our
org-scoped project listing (the recorded open finding from the space-roles
arc) is therefore the discovery surface, not a leak. Foundry's finer
machinery — the **Discoverer** role ("Located in the Project view if a user
only has the Discoverer role") and direct links — is noted; `discoverer`
already sits in `role_rank`, and narrowing the listing to Discoverer-based
visibility is a possible later phase, not this one.

The three entry points collapse by role: **Request access** (none),
**Request project access** (Discoverer only), **Request additional access**
(has access, in the Actions dropdown).

## 2. What a request contains

The composition rule is the load-bearing paragraph:

> "As mentioned [above](#projects-and-resources), we recommend managing permissions on Projects through groups. In the **Request access** pop-up, users can select to get access to a group with an appropriate role on the Project."

— `security/projects-and-roles.md`

and its fallback:

> "If there are no groups assigned to the Project, a user can request to be added directly to the Project with a given role. This will create a Project access request task and require approval from users who have the Owner role on the Project."

— `security/projects-and-roles.md`

So: a group with a role on the project → a **group membership** task routed
to the group's administrators; no such groups → a **direct role** task
routed to the project's owners — 651's `group_membership` and `project_role`
kinds and their eligibility arms, verbatim. And §1's "including any required
Markings" makes the composed request multi-task: the project's markings the
requester does not hold each add a **marking access** task. That is exactly
the two-task Aircrafts request every Approvals capture renders.

## 3. The wizard, from the capture

`project_access_request.gif` (first frame): a **Request access** dialog with
a four-step rail — Add request details, Select role, Add justification,
Review. Step one holds a **Request name** prefilled
"Access request to "Aircraft delays [Datasource]""
(`security/images/project_access_request.gif`) — the auto-title grammar the
Approvals captures' request titles follow — and **Requesting users or
groups**: Myself (marked You) or Custom selection with a user-and-group
search, which is the prose's "if requesting on behalf of others". On filing:

> "Once users create a request, a message should appear indicating that the request succeeded. View the created request by selecting **View details** on the message, or navigate to the [Approvals inbox](/docs/foundry/approvals/overview/#approvals-inbox) in the Foundry workspace sidebar and select **My requests** from the filter on the left."

— `security/projects-and-roles.md`

`success_message.png`: a green toast — "Successfully submitted access
request." (`security/images/success_message.png`) with View details.

## 4. Out of this chunk, recorded

- **External groups** present "a message and URL redirecting them to request
  access... outside the Foundry platform" — waits with the realms gap.
- **Custom request flows and hidden groups** (the configurable request form)
  — configuration surfaces we have no Control Panel for.
- **File/folder-level requests** ("the access request will be submitted on
  the Project itself") — our entry point is already the project.
- The page's References, Roles and role-grant-toggle sections were read and
  touch nothing this chunk changes.

## Decisions

1. **The open finding closes as designed behaviour**: the org-scoped project
   listing is the discovery surface the request flow requires. No RLS change;
   Discoverer-based narrowing recorded as a possible later phase.
2. **One migration (an options call, 652's pattern)**: the dialog needs the
   groups holding roles on the project, the project's markings with the
   caller's membership, and the caller's current role — none of it uniformly
   client-readable under RLS, all of it only for composing the request.
3. **The web's first filer**: a Request access affordance on the Projects
   surface — labelled Request access when the caller holds no role and
   Request additional access when they do (the page's own labels; the
   Discoverer-only middle label collapses into ours). The dialog: auto-title
   in the capture's grammar, justification, then the composition rule —
   pick a group with a role when any exists, else pick a direct role — plus
   a marking task per project marking the caller lacks. Files through
   651's `create_approval_request`; the success toast links View details to
   the request page.
4. **Myself first**: the on-behalf-of Custom selection is engine-expressible
   already (task payloads name any user) but ships later with a person
   picker; the dialog says Myself and means it.

## Questions

1. **Does Request additional access offer roles below the one held?** The
   page is silent; ours offers the full role list and lets reviewers judge.
   `blocks: nothing.`
2. **Should a group-membership path also carry the marking tasks?** The page
   says the request includes "all changes required", group path included.
   Ours adds them on both paths. `blocks: nothing.`
