<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/marking-role-assignments/list-marking-role-assignments/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Marking Role Assignments

`GET /api/v2/admin/markings/{markingId}/roleAssignments`

List all principals who are assigned a role for the given Marking. Ignores the `pageSize` parameter.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `markingId` · string · required
  "The ID of a security marking."

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListMarkingRoleAssignmentsResponse` · object · required
  - `data` · list
    - `MarkingRoleAssignment` · object · required
      - `principalType` · enum · required
        one of `USER`, `GROUP`
      - `principalId` · string · required
        "The ID of a Foundry Group or User."
      - `role` · enum · required
        one of `ADMINISTER`, `DECLASSIFY`, `USE`
        "Represents the operations that a user can perform with regards to a Marking. * ADMINISTER: The user can add and remove members from the Marking, update Marking Role Assignments, and change Marking metadata. * DECLASSIFY: The user can remove the Marking from resources in the platform and stop the propagation of the Marking during a transform. * USE: The user can apply the marking to resources in the platform."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ListMarkingRoleAssignmentsPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to list assigned roles for this marking."
- `MarkingNotFound` (NOT_FOUND) — "The given Marking could not be found."
