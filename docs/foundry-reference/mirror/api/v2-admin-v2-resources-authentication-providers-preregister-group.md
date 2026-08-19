<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/authentication-providers/preregister-group/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Preregister Group

`POST /api/v2/admin/enrollments/{enrollmentRid}/authenticationProviders/{authenticationProviderRid}/preregisterGroup`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Register a Group with a given name before any users with this group log in through this Authentication Provider.
Preregistered groups can be used anywhere other groups are used in the platform.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `enrollmentRid` · string · required
- `authenticationProviderRid` · string · required

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `PreregisterGroupRequest` · object · required
  - `name` · string · required
    "The name of the Group."
  - `organizations` · list
    "The RIDs of the Organizations that can view this group."
    - `OrganizationRid` · string · required

## Response

- `PrincipalId` · string · required
  "The ID of a Foundry Group or User."

## Errors

- `PreregisterGroupPermissionDenied` (PERMISSION_DENIED) — "Could not preregisterGroup the AuthenticationProvider."
- `AuthenticationProviderNotFound` (NOT_FOUND) — "The given AuthenticationProvider could not be found."
