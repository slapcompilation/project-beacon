<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/marking-members/remove-marking-members/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Remove Marking Members

`POST /api/v2/admin/markings/{markingId}/markingMembers/remove`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `markingId` · string · required
  "The ID of a security marking."

## Request

- `RemoveMarkingMembersRequest` · object · required
  - `principalIds` · list
    - `PrincipalId` · string · required
      "The ID of a Foundry Group or User."

## Errors

- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `GetMarkingPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the marking."
- `RemoveMarkingMembersPermissionDenied` (PERMISSION_DENIED) — "Could not remove the MarkingMember."
- `MarkingNotFound` (NOT_FOUND) — "The given Marking could not be found."
