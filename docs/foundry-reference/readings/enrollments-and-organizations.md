---
verify: strict
---

# Enrollments and Organizations — the layer above the security phase

Pages read in full, images included: `administration/enrollments-and-organizations.md`,
`enrollments-and-organizations-access.md`, `enrollments-and-organizations-permissions.md`,
`enrollments-and-organizations-retention.md`, plus the six screenshots.
Read because two security-phase follow-ups point here: the fail-closed
`organization_marking_ids` policy attribute, and the user registry's shape.

## 1. What an enrollment is, and what an organization is

From `administration/enrollments-and-organizations.md`:

> "*Organizations* are access requirements applied to *Projects* that enforce
> strict silos between groups of users and resources. Every user is a member
> of only one Organization but can be a guest member of multiple
> Organizations."

> "An **enrollment** represents an instance of the Foundry platform and is
> made up of one or more Organizations. In most cases, a company will have a
> single Organization—with all its users—in its enrollment."

Control Panel's own breadcrumb agrees: Enrollment / Organization / Space, in
that order (administration/images/permissions-organization-permissions.png).

## 2. The organization IS a marking

The sentence the security phase was waiting for, from
`enrollments-and-organizations-access.md` on what a user's primary
Organization determines:

> "The default Organization markings for new Projects and groups created by
> the user; by default, resources are restricted to users within the primary
> Organization."

The Guest membership card states the same mechanism from the other side —
guests are members of other organizations who can view projects and files
marked with this organization
(administration/images/manage-guests.png) — and the Organization permissions
page carries a **Marking permissions** tab beside Roles and Guest membership
(same screenshot), so the organization's marking is managed like any other
marking's grants. `manage-granular-policies.md` already told us the IDs are
marking IDs:

> "**Organization Marking IDs:** The Marking IDs of all organizations that
> have the user as a member (primary and guest)."

## 3. Primary and guest membership

From `enrollments-and-organizations-access.md`:

> "Every user has exactly one primary Organization."

> "A guest of an Organization is a user who can view Projects, files, users,
> groups, tag categories, and collections in this Organization. Guests can be
> users or groups."

The guest picker confirms the principal pair — the panel offers
Add a user or group (administration/images/manage-guests.png).

## 4. Roles at two levels, workflows inside

From `enrollments-and-organizations-permissions.md`:

> "At each level, **roles** can be granted to users and/or groups. Each role
> contains a number of *workflows* which correspond to capabilities or
> actions that the people granted the role will be able to take."

> "within each level there is a role with the highest level of permissions
> (**Enrollment administrator** and **Organization administrator**,
> respectively)"

> "Custom roles are not shared across organizations, so different custom
> roles can be defined for different organizations."

The screenshots add what the prose does not: role cards read
"Grants N workflows and unlocks M settings"
(administration/images/permissions-enrollment-permissions.png); a locked
setting reads "No access — Contact your organization administrator to grant
you access" (administration/images/no-access-search-result.png); and the
Scoped sessions setting appears with a BETA badge described as limiting "a
person's access to markings to a pre-defined set"
(administration/images/beta-extension-search-result.png) — a live
cross-confirmation of the scoped-sessions reading.

## 5. Retention

`enrollments-and-organizations-retention.md` is a pointer page to
retention/overview. Nothing to build from here; the branch-overlay reading
already carries retention timers as a recorded leftover.

## Decisions I had to make (mine, not Palantir's, unless quoted)

1. **No enrollment table.** An enrollment is the platform instance itself,
   and ours is the deployment — one enrollment, this database. Enrollment
   level roles map onto the existing platform owner/admin claims; a table
   for the instance would be structure with one eternal row.
2. **`organizations` gains a backing marking.** One marking per organization,
   auto-provisioned with the org, `organizations.marking_id` pointing at it.
   The org's marking members are its primary members plus its guests. Where
   that marking LIVES is invention territory: no page shows org markings
   inside a marking category, so ours go in one system category per
   deployment (api name `organizations`), marked as ours.
3. **Guest membership is a principal-pair table** — `organization_guests`
   (organization_id, user XOR group), 481's shape, per the glossary sentence
   and the picker. Slice one folds guests ONLY into the marking side: org
   marking membership = primary + guest, which is exactly what
   `organization_marking_ids` needs. The wider guest reach ("can view
   Projects, files, users, groups…") touches every org-gated RLS policy and
   is deliberately a separate later slice with its own audit.
4. **`organization_marking_ids` binds and stops failing closed.** The policy
   compiler's attribute becomes `auth_org_marking_ids()` — the marking IDs of
   the caller's primary org plus guest orgs — replacing the empty-array
   compile from 484.
5. **Deferred whole:** Control Panel's role/workflow machinery and custom
   roles (same family as the role sets the security phase deferred), the
   Technical Compliance Officer role, retention (pointer page), SAML/org
   assignment (identity-provider machinery we do not have).

## Open questions

1. The system category for org markings — `conjunctive` is our only category
   type, and org markings ARE conjunctive in effect (you must satisfy each
   org requirement on a resource), so it fits; but if the operator knows
   where Foundry actually files them, that beats the inference.
2. Guest reach into the org-gated RLS policies (the "can view Projects,
   files…" half) — which policies fold guests first, and does discovery
   (Compass listing) come before data visibility?

## Built (2026-08-13) — slice one: migrations 490–491, PR #553

Decisions 1–4 shipped as recited. What the build added to the reading:

- `organization_guests` already existed — user-only, empty, feeding the
  JWT's `guest_org_ids` through `custom_access_token_hook`. Extended to the
  principal pair rather than recreated. The hook stays user-only on purpose:
  claims reach is the org-gate half (open question 2), so a guest GROUP
  crosses marking checks immediately (table-derived) but not the claims-based
  org gates until that slice lands.
- Membership in an org marking is derived inside `marking_member()` — primary
  via public.users, guests via the table, groups via the closure — never
  materialized as marking_members rows.
- The category-administrator gate learned the two system paths (no caller;
  `pg_trigger_depth() > 1`) so provisioning is a system act; direct user
  mints in the system category still refuse, asserted.
- The Guest membership surface adds foreign principals by ID: registries are
  org-siloed under RLS, so enrollment-wide discovery is recorded beside open
  question 2 as the same future slice.
- 491 is the new FK's index — caught by catalog.test.ts within the hour of
  490 landing, the gap-run floor doing exactly its job.
