<!-- source: https://palantir.com/docs/foundry/api/datasets-v2-resources/branches/create-branch/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Branch

`POST /api/v2/datasets/{datasetRid}/branches`

Creates a branch on an existing dataset. A branch may optionally point to a (committed) transaction.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."

## Request

- `CreateBranchRequest` · object · required
  - `transactionRid` · string
    "The most recent OPEN or COMMITTED transaction on the branch. This will never be an ABORTED transaction."
  - `name` · string · required
    "The name of a Branch."

## Response

- `Branch` · object · required
  "The created Branch"
  - `name` · string · required
    "The name of a Branch."
  - `transactionRid` · string
    "The most recent OPEN or COMMITTED transaction on the branch. This will never be an ABORTED transaction."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `TransactionNotCommitted` (INVALID_ARGUMENT) — "The given transaction has not been committed."
- `TransactionNotFound` (NOT_FOUND) — "The requested transaction could not be found on the dataset, or the client token does not have access to it."
- `CreateBranchPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to create a branch of this dataset."
- `BranchAlreadyExists` (CONFLICT) — "The branch cannot be created because a branch with that name already exists."
- `InvalidBranchName` (INVALID_ARGUMENT) — "The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs."
