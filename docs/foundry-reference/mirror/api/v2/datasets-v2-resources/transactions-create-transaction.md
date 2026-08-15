<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/transactions/create-transaction/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Create Transaction

`POST /api/v2/datasets/{datasetRid}/transactions`

Creates a Transaction on a Branch of a Dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."

## Query parameters

- `branchName` · string
  "The name of the Branch on which to create the Transaction. Defaults to `master` for most enrollments."

## Request

- `CreateTransactionRequest` · object · required
  - `transactionType` · enum · required
    one of `APPEND`, `UPDATE`, `SNAPSHOT`, `DELETE`
    "The type of a Transaction."

## Response

- `Transaction` · object · required
  "The created Transaction"
  - `rid` · string · required
    "The Resource Identifier (RID) of a Transaction."
  - `transactionType` · enum · required
    one of `APPEND`, `UPDATE`, `SNAPSHOT`, `DELETE`
    "The type of a Transaction."
  - `status` · enum · required
    one of `ABORTED`, `COMMITTED`, `OPEN`
    "The status of a Transaction."
  - `createdTime` · string · required
    "The timestamp when the transaction was created, in ISO 8601 timestamp format."
  - `closedTime` · string
    "The timestamp when the transaction was closed, in ISO 8601 timestamp format."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `OpenTransactionAlreadyExists` (CONFLICT) — "A transaction is already open on this dataset and branch. A branch of a dataset can only have one open transaction at a time."
- `InvalidBranchName` (INVALID_ARGUMENT) — "The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs."
- `CreateTransactionPermissionDenied` (PERMISSION_DENIED) — "Could not create the Transaction."
