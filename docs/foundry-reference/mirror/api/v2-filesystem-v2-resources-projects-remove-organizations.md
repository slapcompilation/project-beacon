<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/projects/remove-organizations/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Remove Organizations

`POST /api/v2/filesystem/projects/{projectRid}/removeOrganizations`

Removes Organizations from a Project.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Path parameters

- `projectRid` · string · required
  "The unique resource identifier (RID) of a Project."

## Request

- `RemoveOrganizationsRequest` · object · required
  - `organizationRids` · list
    - `OrganizationRid` · string · required

## Errors

- `OrganizationsNotFound` (NOT_FOUND) — "At least one organization RID could not be found."
- `OrganizationCannotBeRemoved` (INVALID_ARGUMENT) — "An organization cannot be removed from a project if it would result in a project with no organizations
under a space marked with an organization."
- `InvalidOrganizationHierarchy` (INVALID_ARGUMENT) — "Organizations on a project must also exist on the parent space. This error is thrown if the configuration 
of a project's organizations (on creation or subsequently) results in the project being marked with either 
no organizations in a marked space, or with an organization that is not present on the parent space."
- `RemoveOrganizationsPermissionDenied` (PERMISSION_DENIED) — "Could not removeOrganizations the Project."
- `ProjectNotFound` (NOT_FOUND) — "The given Project could not be found."
