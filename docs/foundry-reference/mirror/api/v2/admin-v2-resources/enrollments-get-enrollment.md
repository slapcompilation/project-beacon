<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/enrollments/get-enrollment/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Enrollment

`GET /api/v2/admin/enrollments/{enrollmentRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the Enrollment with the specified rid.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `enrollmentRid` · string · required

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

- `EnrollmentNotFound` (NOT_FOUND) — "The given Enrollment could not be found."
