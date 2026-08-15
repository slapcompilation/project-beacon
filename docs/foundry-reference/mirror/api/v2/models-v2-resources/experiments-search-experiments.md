<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/experiments/search-experiments/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Search Experiments

`POST /api/v2/models/{modelRid}/experiments/search`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Search experiments using complex nested queries on experiment metadata, parameters, series,
and summary metrics. Supports AND/OR/NOT combinations and various predicates.
Returns a maximum of 100 results per page.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelRid` · string · required
  "The Resource Identifier (RID) of a Model."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `SearchExperimentsRequest` · object · required
  - `where` · union
    "Optional search filter for filtering experiments. If not provided, all experiments for the model are returned."
    - `seriesFilter` · object
      "Filter that atomically binds a series name to a metric comparison, ensuring all conditions are evaluated on the same series."
      - `seriesName` · string · required
        "The name of the series to filter on."
      - `field` · enum · required
        one of `LENGTH`, `AGGREGATION_MIN`, `AGGREGATION_MAX`, `AGGREGATION_LAST`
        "The series metric to compare."
      - `operator` · enum · required
        one of `EQ`, `GT`, `LT`
        "The comparison operator (EQ, GT, or LT)."
      - `value` · any · required
        "The value to compare against."
    - `contains` · object
      "Filter for substring containment matches."
      - `field` · enum · required
        one of `EXPERIMENT_NAME`, `PARAMETER_NAME`, `SERIES_NAME`
        "Fields that support substring containment filtering."
      - `value` · any · required
    - `not` · object
      "Returns experiments where the filter is not satisfied."
      - `value` · union · required
        "Filter for searching experiments using operator-based composition. Supports equality, text matching, boolean combination operators, and compound filters that atomically bind a name to a value comparison. Example filters: - Simple status: {"eq": {"field": "STATUS", "value": "RUNNING"}} - Branch match: {"eq": {"field": "BRANCH", "value": "master"}} - Parameter filter: {"parameterFilter": {"parameterName": "learning_rate", "operator": "GT", "value": 0.01}} - Combined: {"and": {"filters": [ {"eq": {"field": "STATUS", "value": "SUCCEEDED"}}, {"parameterFilter": {"parameterName": "learning_rate", "operator": "GT", "value": 0.5}} ]}}"
    - `or` · object
      "Returns experiments where at least one filter is satisfied."
      - `filters` · list
        - `SearchExperimentsFilter` · union · required
          "Filter for searching experiments using operator-based composition. Supports equality, text matching, boolean combination operators, and compound filters that atomically bind a name to a value comparison. Example filters: - Simple status: {"eq": {"field": "STATUS", "value": "RUNNING"}} - Branch match: {"eq": {"field": "BRANCH", "value": "master"}} - Parameter filter: {"parameterFilter": {"parameterName": "learning_rate", "operator": "GT", "value": 0.01}} - Combined: {"and": {"filters": [ {"eq": {"field": "STATUS", "value": "SUCCEEDED"}}, {"parameterFilter": {"parameterName": "learning_rate", "operator": "GT", "value": 0.5}} ]}}"
    - `and` · object
      "Returns experiments where every filter is satisfied."
      - `filters` · list
        - `SearchExperimentsFilter` · union · required
          "Filter for searching experiments using operator-based composition. Supports equality, text matching, boolean combination operators, and compound filters that atomically bind a name to a value comparison. Example filters: - Simple status: {"eq": {"field": "STATUS", "value": "RUNNING"}} - Branch match: {"eq": {"field": "BRANCH", "value": "master"}} - Parameter filter: {"parameterFilter": {"parameterName": "learning_rate", "operator": "GT", "value": 0.01}} - Combined: {"and": {"filters": [ {"eq": {"field": "STATUS", "value": "SUCCEEDED"}}, {"parameterFilter": {"parameterName": "learning_rate", "operator": "GT", "value": 0.5}} ]}}"
    - `parameterFilter` · object
      "Filter that atomically binds a parameter name to a value comparison, ensuring both conditions are evaluated on the same parameter. Supported combinations: - EQ: boolean, double, integer, or datetime value - GT/LT: double, integer, or datetime value - CONTAINS: string value (substring match on the parameter's string value)"
      - `parameterName` · string · required
        "The exact name of the parameter to filter on."
      - `operator` · enum · required
        one of `EQ`, `GT`, `LT`, `CONTAINS`
        "The comparison operator to apply."
      - `value` · any · required
        "The value to compare against."
    - `summaryMetricFilter` · object
      "Filter that atomically binds a series name and aggregation type to a value comparison, ensuring all conditions are evaluated on the same summary metric."
      - `seriesName` · string · required
        "The name of the series this metric belongs to."
      - `aggregation` · enum · required
        one of `MIN`, `MAX`, `LAST`
        "The aggregation type (MIN, MAX, LAST)."
      - `operator` · enum · required
        one of `EQ`, `GT`, `LT`
        "The comparison operator (EQ, GT, or LT)."
      - `value` · any · required
        "The value to compare against."
    - `eq` · object
      "Filter for exact field value matches."
      - `field` · enum · required
        one of `STATUS`, `BRANCH`, `EXPERIMENT_NAME`, `EXPERIMENT_RID`, `JOB_RID`, `TAG`, `PARAMETER_NAME`, `SERIES_NAME`
        "Fields that support equality filtering."
      - `value` · any · required
    - `startsWith` · object
      "Filter for prefix matches."
      - `field` · enum · required
        one of `EXPERIMENT_NAME`, `PARAMETER_NAME`, `SERIES_NAME`
        "Fields that support prefix filtering."
      - `value` · any · required
  - `orderBy` · object
    "The field to sort by. Default is to sort by relevance."
    - `field` · enum · required
      one of `EXPERIMENT_NAME`, `CREATED_TIME`
      "Fields to order experiment search results by."
    - `direction` · enum · required
      one of `ASC`, `DESC`
      "Specifies the ordering direction (can be either `ASC` or `DESC`)"
  - `pageSize` · integer
    "The maximum number of results to return. Default 50, maximum of 100."
  - `pageToken` · string
    "PageToken to identify the next page to retrieve. Leave empty for the first request."

## Response

- `SearchExperimentsResponse` · object · required
  "Response from searching experiments."
  - `data` · list
    "List of experiments matching the search criteria."
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
  - `nextPageToken` · string
    "Token for retrieving the next page of results, if more results are available."

## Errors

- `InvalidExperimentSearchFilter` (INVALID_ARGUMENT) — "The search filter is invalid. This can occur when using an unsupported operator and value type
combination in a parameter filter, filtering by an unsupported status, or providing a malformed filter."
- `SearchExperimentsPermissionDenied` (PERMISSION_DENIED) — "Could not search the Experiment."
