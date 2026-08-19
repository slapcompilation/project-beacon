<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/organizations/create-organization/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Organization

`POST /api/v2/admin/organizations`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Creates a new Organization.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `CreateOrganizationRequest` · object · required
  - `administrators` · list
    "The initial administrators of the Organization. At least one principal must be provided."
    - `PrincipalId` · string · required
      "The ID of a Foundry Group or User."
  - `enrollmentRid` · string · required
    "The RID of the Enrollment that this Organization belongs to. This must be provided."
  - `name` · string · required
  - `host` · string
    "The primary host name of the Organization. This should be used when constructing URLs for users of this Organization."
  - `description` · string

## Response

- `Organization` · object · required
  "The created Organization"
  - `rid` · string · required
  - `name` · string · required
  - `description` · string
  - `markingId` · string · required
    "The ID of this Organization's underlying marking. Organization guest access can be managed by updating the membership of this Marking."
  - `host` · string
    "The primary host name of the Organization. This should be used when constructing URLs for users of this Organization."

## Errors

- `CreateOrganizationMissingInitialAdminRole` (INVALID_ARGUMENT) — "At least one organization:administrator role grant must be provided when creating a organization."
- `OrganizationNameAlreadyExists` (INVALID_ARGUMENT) — "An organization with the same name already exists."
- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `CreateOrganizationPermissionDenied` (PERMISSION_DENIED) — "Could not create the Organization."
- `EnrollmentNotFound` (NOT_FOUND) — "The given Enrollment could not be found."
- `OrganizationNotFound` (NOT_FOUND) — "The given Organization could not be found."
