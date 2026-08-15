<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/marking-members/add-marking-members/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Add Marking Members

`POST /api/v2/admin/markings/{markingId}/markingMembers/add`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `markingId` · string · required
  "The ID of a security marking."

## Request

- `AddMarkingMembersRequest` · object · required
  - `principalIds` · list
    - `PrincipalId` · string · required
      "The ID of a Foundry Group or User."

## Errors

- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `GetMarkingPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the marking."
- `AddMarkingMembersPermissionDenied` (PERMISSION_DENIED) — "Could not add the MarkingMember."
- `MarkingNotFound` (NOT_FOUND) — "The given Marking could not be found."
