<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/organization-role-assignments/remove-organization-role-assignments/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Remove Organization Role Assignments

`POST /api/v2/admin/organizations/{organizationRid}/roleAssignments/remove`

Remove roles from principals for the given Organization. At most 100 role assignments can be removed in a single request.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `organizationRid` · string · required

## Request

- `RemoveOrganizationRoleAssignmentsRequest` · object · required
  - `roleAssignments` · list
    - `RoleAssignmentUpdate` · object · required
      - `roleId` · string · required
        "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."
      - `principalId` · string · required
        "The ID of a Foundry Group or User."

## Errors

- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `RemoveOrganizationRoleAssignmentsPermissionDenied` (PERMISSION_DENIED) — "Could not remove the OrganizationRoleAssignment."
- `OrganizationNotFound` (NOT_FOUND) — "The given Organization could not be found."
