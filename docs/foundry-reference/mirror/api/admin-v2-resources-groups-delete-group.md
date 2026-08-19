<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/groups/delete-group/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Delete Group

`DELETE /api/v2/admin/groups/{groupId}`

Delete the Group with the specified id.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `groupId` · string · required
  "A Foundry Group ID."

## Errors

- `DeleteGroupPermissionDenied` (PERMISSION_DENIED) — "Could not delete the Group."
- `GroupNotFound` (NOT_FOUND) — "The given Group could not be found."
