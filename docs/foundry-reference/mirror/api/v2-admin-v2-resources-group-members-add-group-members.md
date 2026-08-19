<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/group-members/add-group-members/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Add Group Members

`POST /api/v2/admin/groups/{groupId}/groupMembers/add`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `groupId` · string · required
  "A Foundry Group ID."

## Request

- `AddGroupMembersRequest` · object · required
  - `principalIds` · list
    - `PrincipalId` · string · required
      "The ID of a Foundry Group or User."
  - `expiration` · string

## Errors

- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `InvalidGroupMembershipExpiration` (INVALID_ARGUMENT) — "The member expiration you provided does not conform to the Group's requirements for member expirations."
- `AddGroupMembersPermissionDenied` (PERMISSION_DENIED) — "Could not add the GroupMember."
- `GroupNotFound` (NOT_FOUND) — "The given Group could not be found."
