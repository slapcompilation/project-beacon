<!-- source: https://palantir.com/docs/foundry/api/filesystem-v2-resources/resources/delete-resource/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Delete Resource

`DELETE /api/v2/filesystem/resources/{resourceRid}`

Move the given resource to the trash. Following this operation, the resource can be restored, using the
`restore` operation, or permanently deleted using the `permanentlyDelete` operation.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Path parameters

- `resourceRid` · string · required
  "The unique resource identifier (RID) of a resource."

## Errors

- `TrashingSpaceNotSupported` (INVALID_ARGUMENT) — "Spaces cannot be trashed."
- `TrashingAutosavedResourcesNotSupported` (INVALID_ARGUMENT) — "Auto-saved resources cannot be trashed."
- `TrashingHiddenResourcesNotSupported` (INVALID_ARGUMENT) — "Hidden resources cannot be trashed."
- `DeleteResourcePermissionDenied` (PERMISSION_DENIED) — "Could not delete the Resource."
- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
