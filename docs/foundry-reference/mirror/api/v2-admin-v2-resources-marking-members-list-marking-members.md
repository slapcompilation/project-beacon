<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/marking-members/list-marking-members/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Marking Members

`GET /api/v2/admin/markings/{markingId}/markingMembers`

Lists all principals who can view resources protected by the given Marking. Ignores the `pageSize` parameter.
Requires `api:admin-write` because only marking administrators can view marking members.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `markingId` · string · required
  "The ID of a security marking."

## Query parameters

- `transitive` · boolean
  "When true, includes the transitive members of groups contained within groups that are members of this Marking. For example, say the Marking has member Group A, and Group A has member User B. If `transitive=false` only Group A will be returned, but if `transitive=true` then Group A and User B will be returned. This will recursively resolve Groups through all layers of nesting. Defaults to false."
- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListMarkingMembersResponse` · object · required
  - `data` · list
    - `MarkingMember` · object · required
      - `principalType` · enum · required
        one of `USER`, `GROUP`
      - `principalId` · string · required
        "The ID of a Foundry Group or User."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ListMarkingMembersPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to list the members of this marking."
- `GetMarkingPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the marking."
- `MarkingNotFound` (NOT_FOUND) — "The given Marking could not be found."
