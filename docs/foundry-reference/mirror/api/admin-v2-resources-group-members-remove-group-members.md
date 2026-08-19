<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/group-members/remove-group-members/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Remove Group Members

`POST /api/v2/admin/groups/{groupId}/groupMembers/remove`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `groupId` · string · required
  "A Foundry Group ID."

## Request

- `RemoveGroupMembersRequest` · object · required
  - `principalIds` · list
    - `PrincipalId` · string · required
      "The ID of a Foundry Group or User."

## Errors

- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `RemoveGroupMembersPermissionDenied` (PERMISSION_DENIED) — "Could not remove the GroupMember."
- `GroupNotFound` (NOT_FOUND) — "The given Group could not be found."
