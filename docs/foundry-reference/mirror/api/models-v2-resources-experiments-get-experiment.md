<!-- source: https://palantir.com/docs/foundry/api/models-v2-resources/experiments/get-experiment/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Experiment

`GET /api/v2/models/{modelRid}/experiments/{experimentRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Retrieve a single experiment with all metadata, parameters, series metadata, and summary metrics.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelRid` · string · required
  "The Resource Identifier (RID) of a Model."
- `experimentRid` · string · required
  "The Resource Identifier (RID) of an Experiment."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `Experiment` · object · required
  - `rid` · string · required
    "The Resource Identifier (RID) of an Experiment."
  - `modelRid` · string · required
    "The Resource Identifier (RID) of a Model."
  - `createdTime` · string · required
    "The time at which the resource was created."
  - `createdBy` · string · required
    "The Foundry user who created this resource"
  - `source` · union · required
    "The source from which the experiment was created."
    - `codeWorkspace` · object
      "Experiment created from a code workspace."
      - `containerRid` · string · required
      - `deploymentRid` · string
    - `authoring` · object
      "Experiment created from an authoring repository."
      - `stemmaRid` · string · required
    - `sdk` · object
      "Experiment created from the SDK."
  - `status` · enum · required
    one of `RUNNING`, `SUCCEEDED`, `FAILED`
    "The current status of an experiment."
  - `statusMessage` · string
  - `branch` · string · required
    "The name of a Branch."
  - `parameters` · list
    - `Parameter` · object · required
      "A parameter with its name and value."
      - `name` · string · required
        "The parameter name"
      - `value` · union · required
        "The parameter value"
        - `datetime` · object
          "A datetime parameter value."
          - `value` · string · required
        - `boolean` · object
          "A boolean parameter value."
          - `value` · boolean · required
        - `string` · object
          "A string parameter value."
          - `value` · string · required
        - `double` · object
          "A double parameter value."
          - `value` · number · required
        - `integer` · object
          "An integer parameter value."
          - `value` · string · required
  - `series` · list
    - `SeriesAggregations` · object · required
      "Series with precomputed aggregation values."
      - `name` · string · required
        "The series name"
      - `length` · string
        "Number of values in the series. This field may be absent when series aggregations are derived from summary metrics rather than the full series data."
      - `value` · union · required
        "Aggregated values for this series"
        - `double` · object
          "Aggregated statistics for numeric series."
          - `min` · number
            "Minimum value in the series. Absent if the metric has not been computed."
          - `max` · number
            "Maximum value in the series. Absent if the metric has not been computed."
          - `last` · number
            "Most recent value in the series. Absent if the metric has not been computed."
  - `summaryMetrics` · list
    - `SummaryMetric` · object · required
      "A summary metric with series name, aggregation type, and computed value."
      - `seriesName` · string · required
        "Name of the series this metric belongs to"
      - `aggregation` · enum · required
        one of `MIN`, `MAX`, `LAST`
        "Type of aggregation (MIN, MAX, LAST)"
      - `value` · number · required
        "The computed value"
  - `artifacts` · map
    - `ExperimentArtifactName` · string · required
      "The name of an experiment artifact."
    - `ExperimentArtifactMetadata` · object · required
      "Metadata about an experiment artifact."
      - `name` · string · required
        "The name of an experiment artifact."
      - `description` · string
      - `sizeBytes` · string · required
        "The size of the file or attachment in bytes."
      - `details` · union · required
        "Details about an experiment artifact."
        - `table` · object
          "Details about a table artifact."
          - `rowCount` · string · required
  - `tags` · list
    - `ExperimentTagText` · string · required
      "A tag associated with an experiment."
  - `linkedModelVersion` · string
    "The Resource Identifier (RID) of a Model Version."
  - `jobRid` · string
    "The RID of a Job."

## Errors

- `ModelExperimentNotFound` (NOT_FOUND) — "The requested experiment was not found or the user lacks permission to access it."
- `ExperimentNotFound` (NOT_FOUND) — "The given Experiment could not be found."
