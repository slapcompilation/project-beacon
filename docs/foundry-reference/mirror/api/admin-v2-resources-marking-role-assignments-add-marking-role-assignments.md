<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/marking-role-assignments/add-marking-role-assignments/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Add Marking Role Assignments

`POST /api/v2/admin/markings/{markingId}/roleAssignments/add`

Adds role assignments for the given Marking. For Organization markings, only the USE and DECLASSIFY
roles are supported; the ADMINISTER role must be managed via the Organization Role Assignment endpoints.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `markingId` · string · required
  "The ID of a security marking."

## Request

- `AddMarkingRoleAssignmentsRequest` · object · required
  - `roleAssignments` · list
    - `MarkingRoleUpdate` · object · required
      - `role` · enum · required
        one of `ADMINISTER`, `DECLASSIFY`, `USE`
        "Represents the operations that a user can perform with regards to a Marking. * ADMINISTER: The user can add and remove members from the Marking, update Marking Role Assignments, and change Marking metadata. * DECLASSIFY: The user can remove the Marking from resources in the platform and stop the propagation of the Marking during a transform. * USE: The user can apply the marking to resources in the platform."
      - `principalId` · string · required
        "The ID of a Foundry Group or User."

## Errors

- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `GetMarkingPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the marking."
- `OrganizationMarkingAdministerRoleNotSupported` (INVALID_ARGUMENT) — "The ADMINISTER role on Organization markings cannot be managed through the Marking Role Assignments
endpoints. To manage administrator roles for an Organization, use the Organization Role Assignment endpoints
instead."
- `AddMarkingRoleAssignmentsPermissionDenied` (PERMISSION_DENIED) — "Could not add the MarkingRoleAssignment."
- `MarkingNotFound` (NOT_FOUND) — "The given Marking could not be found."
