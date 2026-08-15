<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/branches/get-branch-transaction-history/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Branch Transaction History

`GET /api/v2/datasets/{datasetRid}/branches/{branchName}/transactions`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the Transaction history for the given Dataset. When requesting all transactions, the endpoint returns them in reverse chronological order.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `branchName` · string · required
  "The name of a Branch."

## Query parameters

- `pageSize` · integer
  "The default pageSize is 20 transactions and the maximum allowed pageSize is 50 transactions"
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ListTransactionsResponse` · object · required
  - `data` · list
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
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `GetBranchTransactionHistoryPermissionDenied` (PERMISSION_DENIED) — "Could not transactions the Branch."
