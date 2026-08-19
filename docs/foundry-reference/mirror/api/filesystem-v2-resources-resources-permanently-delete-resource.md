<!-- source: https://palantir.com/docs/foundry/api/filesystem-v2-resources/resources/permanently-delete-resource/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Permanently Delete Resource

`POST /api/v2/filesystem/resources/{resourceRid}/permanentlyDelete`

Permanently delete the given resource from the trash. If the resource is not directly trashed, a
`ResourceNotTrashed` error will be thrown.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Path parameters

- `resourceRid` · string · required
  "The unique resource identifier (RID) of a resource."

## Errors

- `ResourceNotTrashed` (INVALID_ARGUMENT) — "The resource should be directly trashed before being permanently deleted."
- `PermanentlyDeleteResourcePermissionDenied` (PERMISSION_DENIED) — "Could not permanentlyDelete the Resource."
- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
