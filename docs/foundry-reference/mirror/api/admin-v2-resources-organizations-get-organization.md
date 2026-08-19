<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/organizations/get-organization/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Organization

`GET /api/v2/admin/organizations/{organizationRid}`

Get the Organization with the specified rid.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `organizationRid` · string · required

## Response

- `Organization` · object · required
  - `rid` · string · required
  - `name` · string · required
  - `description` · string
  - `markingId` · string · required
    "The ID of this Organization's underlying marking. Organization guest access can be managed by updating the membership of this Marking."
  - `host` · string
    "The primary host name of the Organization. This should be used when constructing URLs for users of this Organization."

## Errors

- `OrganizationNotFound` (NOT_FOUND) — "The given Organization could not be found."
