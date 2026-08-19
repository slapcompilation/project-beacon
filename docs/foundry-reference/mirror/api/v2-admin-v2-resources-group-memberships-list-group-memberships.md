<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/group-memberships/list-group-memberships/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Group Memberships

`GET /api/v2/admin/users/{userId}/groupMemberships`

Lists all Groups a given User is a member of.

This is a paged endpoint. Each page may be smaller or larger than the requested page size. However, 
it is guaranteed that if there are more results available, the `nextPageToken` field will be populated. 
To get the next page, make the same request again, but set the value of the `pageToken` query parameter 
to be value of the `nextPageToken` value of the previous response. If there is no `nextPageToken` field 
in the response, you are on the last page.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `userId` · string · required
  "A Foundry User ID."

## Query parameters

- `transitive` · boolean
  "When true, includes the transitive memberships of the Groups the User is a member of. For example, say the User is a member of Group A, and Group A is a member of Group B. If `transitive=false` only Group A will be returned, but if `transitive=true` then Groups A and B will be returned. This will recursively resolve Groups through all layers of nesting. Defaults to false."
- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListGroupMembershipsResponse` · object · required
  - `data` · list
    - `GroupMembership` · object · required
      - `groupId` · string · required
        "A Foundry Group ID."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `InvalidPageSize` (INVALID_ARGUMENT) — "The provided page size was zero or negative. Page sizes must be greater than zero."
- `UserDeleted` (INVALID_ARGUMENT) — "The user is deleted."
- `UserNotFound` (NOT_FOUND) — "The given User could not be found."
