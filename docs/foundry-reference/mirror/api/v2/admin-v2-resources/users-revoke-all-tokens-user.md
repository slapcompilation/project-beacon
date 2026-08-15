<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/users/revoke-all-tokens-user/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Revoke All Tokens User

`POST /api/v2/admin/users/{userId}/revokeAllTokens`

Revoke all active authentication tokens for the user including active browser sessions and long-lived 
development tokens. If the user has active sessions in a browser, this will force re-authentication.

The caller must have permission to manage users for the target user's organization.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `userId` · string · required
  "A Foundry User ID."

## Errors

- `UserDeleted` (INVALID_ARGUMENT) — "The user is deleted."
- `RevokeAllTokensUserPermissionDenied` (PERMISSION_DENIED) — "Could not revokeAllTokens the User."
- `UserNotFound` (NOT_FOUND) — "The given User could not be found."
