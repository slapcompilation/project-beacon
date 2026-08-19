<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/branches/delete-branch/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Delete Branch

`DELETE /api/v2/datasets/{datasetRid}/branches/{branchName}`

Deletes the Branch with the given BranchName.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `branchName` · string · required
  "The name of a Branch."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `InvalidBranchName` (INVALID_ARGUMENT) — "The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs."
- `DeleteBranchPermissionDenied` (PERMISSION_DENIED) — "Could not delete the Branch."
