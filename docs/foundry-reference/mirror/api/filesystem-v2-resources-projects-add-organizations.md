<!-- source: https://palantir.com/docs/foundry/api/filesystem-v2-resources/projects/add-organizations/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Add Organizations

`POST /api/v2/filesystem/projects/{projectRid}/addOrganizations`

Adds a list of Organizations to a Project.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Path parameters

- `projectRid` · string · required
  "The unique resource identifier (RID) of a Project."

## Request

- `AddOrganizationsRequest` · object · required
  - `organizationRids` · list
    - `OrganizationRid` · string · required

## Errors

- `OrganizationsNotFound` (NOT_FOUND) — "At least one organization RID could not be found."
- `InvalidOrganizationHierarchy` (INVALID_ARGUMENT) — "Organizations on a project must also exist on the parent space. This error is thrown if the configuration 
of a project's organizations (on creation or subsequently) results in the project being marked with either 
no organizations in a marked space, or with an organization that is not present on the parent space."
- `AddOrganizationsPermissionDenied` (PERMISSION_DENIED) — "Could not addOrganizations the Project."
- `ProjectNotFound` (NOT_FOUND) — "The given Project could not be found."
