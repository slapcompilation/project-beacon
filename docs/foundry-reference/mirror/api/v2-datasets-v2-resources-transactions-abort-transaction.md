<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/transactions/abort-transaction/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Abort Transaction

`POST /api/v2/datasets/{datasetRid}/transactions/{transactionRid}/abort`

Aborts an open Transaction. File modifications made on this Transaction are not preserved and the Branch is
not updated.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `transactionRid` · string · required
  "The Resource Identifier (RID) of a Transaction."

## Response

- `Transaction` · object · required
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

- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `TransactionNotFound` (NOT_FOUND) — "The requested transaction could not be found on the dataset, or the client token does not have access to it."
- `TransactionNotOpen` (INVALID_ARGUMENT) — "The given transaction is not open."
- `AbortTransactionPermissionDenied` (PERMISSION_DENIED) — "Could not abort the Transaction."
