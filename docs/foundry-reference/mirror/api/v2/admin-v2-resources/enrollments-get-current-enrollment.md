<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/enrollments/get-current-enrollment/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Current Enrollment

`GET /api/v2/admin/enrollments/getCurrent`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Returns the Enrollment associated with the current User's primary organization.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `Enrollment` · object · required
  - `rid` · string · required
  - `name` · string · required
  - `createdTime` · string
    "The time at which the resource was created."

## Errors

- `GetCurrentEnrollmentPermissionDenied` (PERMISSION_DENIED) — "Could not getCurrent the Enrollment."
- `EnrollmentNotFound` (NOT_FOUND) — "The given Enrollment could not be found."
