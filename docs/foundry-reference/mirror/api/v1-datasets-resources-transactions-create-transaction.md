<!-- source: https://palantir.com/docs/foundry/api/v1/datasets-resources/transactions/create-transaction/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Transaction

`POST /api/v1/datasets/{datasetRid}/transactions`

Creates a Transaction on a Branch of a Dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of the Dataset on which to create the Transaction."

## Query parameters

- `branchId` · string
  "The identifier (name) of the Branch on which to create the Transaction. Defaults to `master` for most enrollments."

## Request

- `CreateTransactionRequest` · object · required
  - `transactionType` · enum
    one of `APPEND`, `UPDATE`, `SNAPSHOT`, `DELETE`
    "The type of a Transaction."

## Response

- `Transaction` · object · required
  "An operation that modifies the files within a dataset."
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

- `OpenTransactionAlreadyExists` (CONFLICT) — "A transaction is already open on this dataset and branch. A branch of a dataset can only have one open transaction at a time."
- `CreateTransactionPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to create a transaction on this dataset."
- `InvalidBranchId` (INVALID_ARGUMENT) — "The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs."
- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
