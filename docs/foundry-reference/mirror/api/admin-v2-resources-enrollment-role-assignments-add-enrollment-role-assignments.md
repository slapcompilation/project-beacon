<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/enrollment-role-assignments/add-enrollment-role-assignments/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Add Enrollment Role Assignments

`POST /api/v2/admin/enrollments/{enrollmentRid}/roleAssignments/add`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Assign roles to principals for the given Enrollment. At most 100 role assignments can be added in a single request.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `enrollmentRid` · string · required

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `AddEnrollmentRoleAssignmentsRequest` · object · required
  - `roleAssignments` · list
    - `RoleAssignmentUpdate` · object · required
      - `roleId` · string · required
        "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."
      - `principalId` · string · required
        "The ID of a Foundry Group or User."

## Errors

- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `EnrollmentRoleNotFound` (NOT_FOUND) — "One of the provided role IDs was not found."
- `AddEnrollmentRoleAssignmentsPermissionDenied` (PERMISSION_DENIED) — "Could not add the EnrollmentRoleAssignment."
- `EnrollmentNotFound` (NOT_FOUND) — "The given Enrollment could not be found."
