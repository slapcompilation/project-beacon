<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/organization-role-assignments/list-organization-role-assignments/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Organization Role Assignments

`GET /api/v2/admin/organizations/{organizationRid}/roleAssignments`

List all principals who are assigned a role for the given Organization.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `organizationRid` · string · required

## Response

- `ListOrganizationRoleAssignmentsResponse` · object · required
  - `data` · list
    - `OrganizationRoleAssignment` · object · required
      - `principalType` · enum · required
        one of `USER`, `GROUP`
      - `principalId` · string · required
        "The ID of a Foundry Group or User."
      - `roleId` · string · required
        "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."

## Errors

- `ListOrganizationRoleAssignmentsPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to list assigned roles for this organization."
- `OrganizationNotFound` (NOT_FOUND) — "The given Organization could not be found."
