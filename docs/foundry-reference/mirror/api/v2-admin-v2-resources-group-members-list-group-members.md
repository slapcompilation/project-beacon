<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/group-members/list-group-members/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Group Members

`GET /api/v2/admin/groups/{groupId}/groupMembers`

Lists all members (which can be a User or a Group) of a given Group.

This is a paged endpoint. Each page may be smaller or larger than the requested page size. However, 
it is guaranteed that if there are more results available, the `nextPageToken` field will be populated. 
To get the next page, make the same request again, but set the value of the `pageToken` query parameter 
to be value of the `nextPageToken` value of the previous response. If there is no `nextPageToken` field 
in the response, you are on the last page.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `groupId` · string · required
  "A Foundry Group ID."

## Query parameters

- `transitive` · boolean
  "When true, includes the transitive members of groups contained within this group. For example, say the Group has member Group A, and Group A has member User B. If `transitive=false` only Group A will be returned, but if `transitive=true` then Group A and User B will be returned. This will recursively resolve Groups through all layers of nesting. If `transitive` is true, `includeExpirations` cannot also be set to true. Defaults to false."
- `includeExpirations` · boolean
  "When true, includes the expiration time of any temporary members of this group. `includeExpirations` cannot be set to true if `transitive` is also set to true. Defaults to false."
- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListGroupMembersResponse` · object · required
  - `data` · list
    - `GroupMember` · object · required
      - `principalType` · enum · required
        one of `USER`, `GROUP`
      - `principalId` · string · required
        "The ID of a Foundry Group or User."
      - `expiration` · string
        "The time at which this member's membership in the group will expire. This field will always be empty unless the `includeExpirations` query parameter is set to true in the list operation."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `InvalidPageSize` (INVALID_ARGUMENT) — "The provided page size was zero or negative. Page sizes must be greater than zero."
- `ExpirationForTransitiveGroupMembersNotSupported` (INVALID_ARGUMENT) — "You cannot pass includeExpirations if transitive is true."
- `ListGroupMembersPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the members of the given group."
- `GroupNotFound` (NOT_FOUND) — "The given Group could not be found."
