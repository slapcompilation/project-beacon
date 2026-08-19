<!-- source: https://palantir.com/docs/foundry/api/v1/datasets-resources/branches/delete-branch/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Delete Branch

`DELETE /api/v1/datasets/{datasetRid}/branches/{branchId}`

Deletes the Branch with the given BranchId.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of the Dataset that contains the Branch."
- `branchId` · string · required
  "The identifier (name) of the Branch."

## Errors

- `DeleteBranchPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to delete the given branch from this dataset."
- `InvalidBranchId` (INVALID_ARGUMENT) — "The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs."
- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
