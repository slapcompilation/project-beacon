<!-- source: https://palantir.com/docs/foundry/api/v1/datasets-resources/transactions/abort-transaction/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Abort Transaction

`POST /api/v1/datasets/{datasetRid}/transactions/{transactionRid}/abort`

Aborts an open Transaction. File modifications made on this Transaction are not preserved and the Branch is
not updated.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of the Dataset that contains the Transaction."
- `transactionRid` · string · required
  "The Resource Identifier (RID) of the Transaction."

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

- `AbortTransactionPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to abort the given transaction on the given dataset."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `TransactionNotFound` (NOT_FOUND) — "The requested transaction could not be found on the dataset, or the client token does not have access to it."
- `TransactionNotOpen` (INVALID_ARGUMENT) — "The given transaction is not open."
