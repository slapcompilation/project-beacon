<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/user-provider-infos/get-user-provider-info/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get User Provider Info

`GET /api/v2/admin/users/{userId}/providerInfo`

Get the UserProviderInfo.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `userId` · string · required
  "A Foundry User ID."

## Response

- `UserProviderInfo` · object · required
  - `providerId` · string · required
    "The ID of the User in the external authentication provider. This value is determined by the authentication provider. At most one User can have a given provider ID in a given Realm."

## Errors

- `GetUserProviderInfoPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the provider information for the given user."
- `UserDeleted` (INVALID_ARGUMENT) — "The user is deleted."
- `UserProviderInfoNotFound` (NOT_FOUND) — "The given UserProviderInfo could not be found."
- `UserNotFound` (NOT_FOUND) — "The given User could not be found."
