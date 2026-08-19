<!-- source: https://palantir.com/docs/foundry/api/datasets-resources/branches/list-branches/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Branches

`GET /api/v1/datasets/{datasetRid}/branches`

Lists the Branches of a Dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of the Dataset on which to list Branches."

## Query parameters

- `pageSize` · integer
  "The desired size of the page to be returned. Defaults to 1,000. See [page sizes](/docs/foundry/api/general/overview/paging/#page-sizes) for details."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListBranchesResponse` · object · required
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
  - `data` · list
    "The list of branches in the current page."
    - `Branch` · object · required
      "A Branch of a Dataset."
      - `branchId` · string · required
        "The identifier (name) of a Branch."
      - `transactionRid` · string
        "The Resource Identifier (RID) of a Transaction."

## Errors

- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
