<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/transactions/get-transaction/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Transaction

`GET /api/v2/datasets/{datasetRid}/transactions/{transactionRid}`

Gets a Transaction of a Dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

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
- `TransactionNotFound` (NOT_FOUND) — "The given Transaction could not be found."
