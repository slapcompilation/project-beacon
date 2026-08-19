<!-- source: https://palantir.com/docs/foundry/api/v1/datasets-resources/datasets/read-table/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Read Table

`GET /api/v1/datasets/{datasetRid}/readTable`

Gets the content of a dataset as a table in the specified format.

This endpoint currently does not support views (virtual datasets composed of other datasets). For more information, refer to the [views documentation](/docs/foundry/data-integration/views).


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The RID of the Dataset."

## Query parameters

- `branchId` · string
  "The identifier (name) of the Branch."
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
  "The content stream."

## Errors

- `InvalidParameterCombination` (INVALID_ARGUMENT) — "The given parameters are individually valid but cannot be used in the given combination."
- `SchemaNotFound` (NOT_FOUND) — "A schema could not be found for the given dataset and branch, or the client token does not have access to it."
- `ReadTablePermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to read the given dataset as a table."
- `ColumnTypesNotSupported` (INVALID_ARGUMENT) — "The dataset contains column types that are not supported."
- `DatasetReadNotSupported` (INVALID_ARGUMENT) — "The dataset does not support being read."
