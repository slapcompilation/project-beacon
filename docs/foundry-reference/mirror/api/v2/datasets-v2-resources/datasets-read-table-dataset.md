<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/datasets/read-table-dataset/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Read Table Dataset

`GET /api/v2/datasets/{datasetRid}/readTable`

Gets the content of a dataset as a table in the specified format.

This endpoint currently does not support views (virtual datasets composed of other datasets).


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."

## Query parameters

- `branchName` · string
  "The name of the Branch."
- `startTransactionRid` · string
  "The Resource Identifier (RID) of the start Transaction."
- `endTransactionRid` · string
  "The Resource Identifier (RID) of the end Transaction."
- `format` · enum · required
  one of `ARROW`, `CSV`
  "The export format. Must be `ARROW` or `CSV`."
- `columns` · list
  "A subset of the dataset columns to include in the result. Defaults to all columns."
- `rowLimit` · integer
  "A limit on the number of rows to return. Note that row ordering is non-deterministic."

## Response

- `body` · string · required

## Errors

- `ColumnTypesNotSupported` (INVALID_ARGUMENT) — "The dataset contains column types that are not supported."
- `ReadTableDatasetPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to read the given dataset as a table."
- `ReadTableError` (INTERNAL) — "An error occurred while reading the table. Refer to the message for more details."
- `ReadTableRowLimitExceeded` (INVALID_ARGUMENT) — "The request to read the table generates a result that exceeds the allowed number of rows. For datasets not
stored as Parquet there is a limit of 1 million rows. For datasets stored as Parquet there is no limit."
- `ReadTableTimeout` (TIMEOUT) — "The request to read the table timed out."
- `DatasetReadNotSupported` (INVALID_ARGUMENT) — "The dataset does not support being read."
- `SchemaNotFound` (NOT_FOUND) — "A schema could not be found for the given dataset and branch, or the client token does not have access to it."
- `InvalidParameterCombination` (INVALID_ARGUMENT) — "The given parameters are individually valid but cannot be used in the given combination."
