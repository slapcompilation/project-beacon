<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/user-provider-infos/replace-user-provider-info/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Replace User Provider Info

`PUT /api/v2/admin/users/{userId}/providerInfo`

Replace the UserProviderInfo.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `userId` · string · required
  "A Foundry User ID."

## Request

- `ReplaceUserProviderInfoRequest` · object · required
  - `providerId` · string · required
    "The ID of the User in the external authentication provider. This value is determined by the authentication provider. At most one User can have a given provider ID in a given Realm."

## Response

- `UserProviderInfo` · object · required
  "The replaced UserProviderInfo"
  - `providerId` · string · required
    "The ID of the User in the external authentication provider. This value is determined by the authentication provider. At most one User can have a given provider ID in a given Realm."

## Errors

- `GetUserProviderInfoPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the provider information for the given user."
- `CannotReplaceProviderInfoForPrincipalInProtectedRealm` (INVALID_ARGUMENT) — "Provider information for Principals in this Realm cannot be replaced."
- `UserDeleted` (INVALID_ARGUMENT) — "The user is deleted."
- `ReplaceUserProviderInfoPermissionDenied` (PERMISSION_DENIED) — "Could not replace the UserProviderInfo."
- `UserNotFound` (NOT_FOUND) — "The given User could not be found."
- `UserProviderInfoNotFound` (NOT_FOUND) — "The given UserProviderInfo could not be found."
