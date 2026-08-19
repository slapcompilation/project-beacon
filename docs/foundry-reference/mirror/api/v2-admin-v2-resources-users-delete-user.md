<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/users/delete-user/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Delete User

`DELETE /api/v2/admin/users/{userId}`

Delete the User with the specified id.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `userId` · string · required
  "A Foundry User ID."

## Errors

- `UserDeleted` (INVALID_ARGUMENT) — "The user is deleted."
- `DeleteUserPermissionDenied` (PERMISSION_DENIED) — "Could not delete the User."
- `UserNotFound` (NOT_FOUND) — "The given User could not be found."
