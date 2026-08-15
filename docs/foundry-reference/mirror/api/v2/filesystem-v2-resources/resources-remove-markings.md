<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/resources/remove-markings/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Remove Markings

`POST /api/v2/filesystem/resources/{resourceRid}/removeMarkings`

Removes Markings from a resource.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Path parameters

- `resourceRid` · string · required
  "The unique resource identifier (RID) of a resource."

## Request

- `RemoveMarkingsRequest` · object · required
  - `markingIds` · list
    - `MarkingId` · string · required
      "The ID of a security marking."

## Errors

- `OrganizationMarkingNotSupported` (INVALID_ARGUMENT) — "Adding an organization marking as a regular marking is not supported. Use the organization endpoints on a 
project resource instead."
- `ForbiddenOperationOnHiddenResource` (INVALID_ARGUMENT) — "Performing this operation on a hidden resource is not supported."
- `ForbiddenOperationOnAutosavedResource` (INVALID_ARGUMENT) — "Performing this operation on an autosaved resource is not supported."
- `MarkingNotFound` (NOT_FOUND) — "A provided marking ID cannot be found."
- `RemoveMarkingsPermissionDenied` (PERMISSION_DENIED) — "Could not removeMarkings the Resource."
- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
