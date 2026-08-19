<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/enrollment-role-assignments/list-enrollment-role-assignments/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Enrollment Role Assignments

`GET /api/v2/admin/enrollments/{enrollmentRid}/roleAssignments`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

List all principals who are assigned a role for the given Enrollment.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `enrollmentRid` · string · required

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ListEnrollmentRoleAssignmentsResponse` · object · required
  - `data` · list
    - `EnrollmentRoleAssignment` · object · required
      - `principalType` · enum · required
        one of `USER`, `GROUP`
      - `principalId` · string · required
        "The ID of a Foundry Group or User."
      - `roleId` · string · required
        "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."

## Errors

- `ListEnrollmentRoleAssignmentsPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to list assigned roles for this enrollment."
- `EnrollmentNotFound` (NOT_FOUND) — "The given Enrollment could not be found."
