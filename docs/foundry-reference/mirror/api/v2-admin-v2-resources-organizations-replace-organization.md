<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/organizations/replace-organization/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Replace Organization

`PUT /api/v2/admin/organizations/{organizationRid}`

Replace the Organization with the specified rid.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `organizationRid` · string · required

## Request

- `ReplaceOrganizationRequest` · object · required
  - `name` · string · required
  - `host` · string
    "The primary host name of the Organization. This should be used when constructing URLs for users of this Organization."
  - `description` · string

## Response

- `Organization` · object · required
  "The replaced Organization"
  - `rid` · string · required
  - `name` · string · required
  - `description` · string
  - `markingId` · string · required
    "The ID of this Organization's underlying marking. Organization guest access can be managed by updating the membership of this Marking."
  - `host` · string
    "The primary host name of the Organization. This should be used when constructing URLs for users of this Organization."

## Errors

- `InvalidHostName` (INVALID_ARGUMENT) — "The provided hostname must be a valid domain name. The only allowed characters are letters, numbers, periods, and hyphens."
- `OrganizationNameAlreadyExists` (INVALID_ARGUMENT) — "An organization with the same name already exists."
- `ReplaceOrganizationPermissionDenied` (PERMISSION_DENIED) — "Could not replace the Organization."
- `OrganizationNotFound` (NOT_FOUND) — "The given Organization could not be found."
