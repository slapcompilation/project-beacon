<!-- source: https://palantir.com/docs/foundry/api/datasets-resources/transactions/get-transaction/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Transaction

`GET /api/v1/datasets/{datasetRid}/transactions/{transactionRid}`

Gets a Transaction of a Dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

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

- `TransactionNotFound` (NOT_FOUND) — "The requested transaction could not be found on the dataset, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
