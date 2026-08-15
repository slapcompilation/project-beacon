<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/experiment-series-list/parquet-experiment-series/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Parquet Experiment Series

`GET /api/v2/models/{modelRid}/experiments/{experimentRid}/series/{experimentSeriesName}/parquet`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Retrieve raw time-series data for a single series as a streamed binary response in Apache Parquet format.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelRid` · string · required
  "The Resource Identifier (RID) of a Model."
- `experimentRid` · string · required
  "The Resource Identifier (RID) of an Experiment."
- `experimentSeriesName` · string · required
  "The name of a series (metrics tracked over time)."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `body` · string · required

## Errors

- `ExperimentSeriesNotFound` (NOT_FOUND) — "The requested series was not found in the experiment."
- `ModelExperimentNotFound` (NOT_FOUND) — "The requested experiment was not found or the user lacks permission to access it."
- `ParquetExperimentSeriesPermissionDenied` (PERMISSION_DENIED) — "Could not parquet the ExperimentSeries."
