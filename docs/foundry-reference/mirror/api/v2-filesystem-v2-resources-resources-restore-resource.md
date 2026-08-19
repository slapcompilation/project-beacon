<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/resources/restore-resource/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Restore Resource

`POST /api/v2/filesystem/resources/{resourceRid}/restore`

Restore the given resource and any directly trashed ancestors from the trash. If the resource is not
trashed, this operation will be ignored.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Path parameters

- `resourceRid` · string · required
  "The unique resource identifier (RID) of a resource."

## Errors

- `ResourceNotDirectlyTrashed` (INVALID_ARGUMENT) — "The resource is not directly trashed."
- `RestoreResourcePermissionDenied` (PERMISSION_DENIED) — "Could not restore the Resource."
- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
