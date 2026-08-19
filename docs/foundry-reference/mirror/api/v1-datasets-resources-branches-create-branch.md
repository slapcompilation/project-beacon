<!-- source: https://palantir.com/docs/foundry/api/v1/datasets-resources/branches/create-branch/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Branch

`POST /api/v1/datasets/{datasetRid}/branches`

Creates a branch on an existing dataset. A branch may optionally point to a (committed) transaction.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of the Dataset on which to create the Branch."

## Request

- `CreateBranchRequest` · object · required
  - `branchId` · string · required
    "The identifier (name) of a Branch."
  - `transactionRid` · string
    "The Resource Identifier (RID) of a Transaction."

## Response

- `Branch` · object · required
  "A Branch of a Dataset."
  - `branchId` · string · required
    "The identifier (name) of a Branch."
  - `transactionRid` · string
    "The Resource Identifier (RID) of a Transaction."

## Errors

- `InvalidBranchId` (INVALID_ARGUMENT) — "The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs."
- `TransactionNotCommitted` (INVALID_ARGUMENT) — "The given transaction has not been committed."
- `TransactionNotFound` (NOT_FOUND) — "The requested transaction could not be found on the dataset, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `CreateBranchPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to create a branch of this dataset."
- `BranchAlreadyExists` (CONFLICT) — "The branch cannot be created because a branch with that name already exists."
