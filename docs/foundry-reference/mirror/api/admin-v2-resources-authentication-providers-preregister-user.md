<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/authentication-providers/preregister-user/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Preregister User

`POST /api/v2/admin/enrollments/{enrollmentRid}/authenticationProviders/{authenticationProviderRid}/preregisterUser`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Register a User with a given username before they log in to the platform for the first time through this
Authentication Provider. Preregistered users can be assigned to groups and roles prior to first login.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `enrollmentRid` · string · required
- `authenticationProviderRid` · string · required

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `PreregisterUserRequest` · object · required
  - `username` · string · required
    "The new user's username. This must match one of the provider's supported username patterns."
  - `organization` · string · required
    "The RID of the user's primary Organization. This may be changed when the user logs in for the first time depending on any configured Organization assignment rules."
  - `givenName` · string
  - `familyName` · string
  - `email` · string
  - `attributes` · map
    - `AttributeName` · string · required
    - `AttributeValues` · list · required
      - `AttributeValue` · string · required

## Response

- `PrincipalId` · string · required
  "The ID of a Foundry Group or User."

## Errors

- `PreregisterUserPermissionDenied` (PERMISSION_DENIED) — "Could not preregisterUser the AuthenticationProvider."
- `AuthenticationProviderNotFound` (NOT_FOUND) — "The given AuthenticationProvider could not be found."
