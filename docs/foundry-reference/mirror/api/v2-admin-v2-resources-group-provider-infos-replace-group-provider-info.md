<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/group-provider-infos/replace-group-provider-info/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Replace Group Provider Info

`PUT /api/v2/admin/groups/{groupId}/providerInfo`

Replace the GroupProviderInfo.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `groupId` · string · required
  "A Foundry Group ID."

## Request

- `ReplaceGroupProviderInfoRequest` · object · required
  - `providerId` · string · required
    "The ID of the Group in the external authentication provider. This value is determined by the authentication provider. At most one Group can have a given provider ID in a given Realm."

## Response

- `GroupProviderInfo` · object · required
  "The replaced GroupProviderInfo"
  - `providerId` · string · required
    "The ID of the Group in the external authentication provider. This value is determined by the authentication provider. At most one Group can have a given provider ID in a given Realm."

## Errors

- `GetGroupProviderInfoPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the provider information for the given group."
- `CannotReplaceProviderInfoForPrincipalInProtectedRealm` (INVALID_ARGUMENT) — "Provider information for Principals in this Realm cannot be replaced."
- `ReplaceGroupProviderInfoPermissionDenied` (PERMISSION_DENIED) — "Could not replace the GroupProviderInfo."
- `GroupNotFound` (NOT_FOUND) — "The given Group could not be found."
- `GroupProviderInfoNotFound` (NOT_FOUND) — "The given GroupProviderInfo could not be found."
