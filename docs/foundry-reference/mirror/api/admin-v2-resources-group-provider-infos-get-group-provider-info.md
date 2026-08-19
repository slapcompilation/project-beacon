<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/group-provider-infos/get-group-provider-info/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Group Provider Info

`GET /api/v2/admin/groups/{groupId}/providerInfo`

Get the GroupProviderInfo.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `groupId` · string · required
  "A Foundry Group ID."

## Response

- `GroupProviderInfo` · object · required
  - `providerId` · string · required
    "The ID of the Group in the external authentication provider. This value is determined by the authentication provider. At most one Group can have a given provider ID in a given Realm."

## Errors

- `GetGroupProviderInfoPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the provider information for the given group."
- `GroupProviderInfoNotFound` (NOT_FOUND) — "The given GroupProviderInfo could not be found."
- `GroupNotFound` (NOT_FOUND) — "The given Group could not be found."
