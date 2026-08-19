<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/experiment-series-list/json-experiment-series/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Json Experiment Series

`GET /api/v2/models/{modelRid}/experiments/{experimentRid}/series/{experimentSeriesName}/json`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Retrieve raw time-series data for a single series in JSON format.
Results are paginated with a default page size of 200 and a maximum of 1000.


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

- `pageSize` · integer
  "Maximum number of values to return per page. Default is 200, maximum is 1000."
- `offset` · integer
  "Number of values to skip from the beginning. Defaults to 0."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `Series` · union · required
  "A series of values logged over time."
  - `doubleV1` · object
    "A series of double values."
    - `series` · list
      - `DoubleSeriesValueV1` · object · required
        "A single double value in a series."
        - `value` · number · required
        - `timestamp` · string · required
          "Milliseconds since unix time zero"
        - `step` · string · required

## Errors

- `ExperimentSeriesNotFound` (NOT_FOUND) — "The requested series was not found in the experiment."
- `ModelExperimentNotFound` (NOT_FOUND) — "The requested experiment was not found or the user lacks permission to access it."
- `JsonExperimentSeriesPermissionDenied` (PERMISSION_DENIED) — "Could not json the ExperimentSeries."
