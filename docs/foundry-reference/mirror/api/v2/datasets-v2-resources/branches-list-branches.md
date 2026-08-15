<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/branches/list-branches/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Branches

`GET /api/v2/datasets/{datasetRid}/branches`

Lists the Branches of a Dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListBranchesResponse` · object · required
  - `data` · list
    - `Branch` · object · required
      - `name` · string · required
        "The name of a Branch."
      - `transactionRid` · string
        "The most recent OPEN or COMMITTED transaction on the branch. This will never be an ABORTED transaction."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `InvalidPageSize` (INVALID_ARGUMENT) — "The provided page size was zero or negative. Page sizes must be greater than zero."
