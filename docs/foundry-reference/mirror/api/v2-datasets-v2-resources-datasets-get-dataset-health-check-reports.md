<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/datasets/get-dataset-health-check-reports/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Dataset Health Check Reports

`GET /api/v2/datasets/{datasetRid}/getHealthCheckReports`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the most recent Data Health Check report for each check configured on the given Dataset.
Returns one report per check, representing the current health status of the dataset.

To get the list of checks configured on a Dataset, use
[Get Dataset Health Checks](/docs/foundry/api/datasets/get-dataset-health-checks/).
For the full report history of a specific check, use
[Get Latest Check Reports](/docs/foundry/api/v2/data-health-v2-resources/checks/get-latest-check-reports).


Third-party applications using this endpoint via OAuth2 must request the following operation scopes: `api:data-health-read api:datasets-read`.

Scopes: `api:data-health-read`, `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."

## Query parameters

- `branchName` · string
  "The name of the Branch. If none is provided, the default Branch name - `master` for most enrollments - will be used."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `GetHealthCheckReportsResponse` · object · required
  - `data` · map
    "A map from Check RID to the most recent report for that check. If a check is configured but has not yet produced a report, the value will be absent."
    - `CheckRid` · string · required
      "The unique resource identifier (RID) of a Data Health Check."
    - `CheckReport` · object · required
      - `rid` · string · required
        "The unique resource identifier (RID) of a Data Health Check Report."
      - `check` · object · required
        "Snapshot of the check configuration when this report was created. This will not change if the check is later modified."
        - `rid` · string · required
          "The unique resource identifier (RID) of a Data Health Check."
        - `groups` · list
          - `CheckGroupRid` · string · required
            "The unique resource identifier (RID) of a CheckGroup."
        - `config` · union · required
          "Configuration of a check."
          - `numericColumnRange` · object
            "Checks that values in a numeric column fall within a specified range."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `columnName` · string · required
            - `numericBoundsConfig` · object · required
              "Configuration for numeric bounds check with severity settings."
              - `numericBounds` · object · required
                "The range of numeric values a check is expected to be within."
                - `lowerBound` · number
                - `upperBound` · number
              - `severity` · enum · required
                one of `MODERATE`, `CRITICAL`
                "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `jobStatus` · object
            "Checks the status of the most recent job run on the dataset."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `statusCheckConfig` · object · required
              - `severity` · enum · required
                one of `MODERATE`, `CRITICAL`
                "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `escalationConfig` · object
                "The configuration for when the severity of the failing health check should be escalated to CRITICAL – after a given number of failures, possibly within a time interval."
                - `failuresToCritical` · integer · required
                - `timeIntervalInSeconds` · string
          - `numericColumnMean` · object
            "Checks the mean value of a numeric column."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `numericColumnCheckConfig` · object · required
              "Configuration for numeric column-based checks (such as mean or median). At least one of numericBounds or trend must be specified. Both may be provided to validate both the absolute value range and the trend behavior over time."
              - `columnName` · string · required
              - `numericBounds` · object
                "Configuration for numeric bounds check with severity settings."
                - `numericBounds` · object · required
                  "The range of numeric values a check is expected to be within."
                  - `lowerBound` · number
                  - `upperBound` · number
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `trend` · object
                "Configuration for trend-based validation with severity settings. At least one of trendType or differenceBounds must be specified. Both may be provided to validate both the trend pattern and the magnitude of change."
                - `trendType` · enum
                  one of `NON_INCREASING`, `NON_DECREASING`, `STRICTLY_INCREASING`, `STRICTLY_DECREASING`, `CONSTANT`
                  "The type of trend to validate: - NON_INCREASING: Values should not increase over time - NON_DECREASING: Values should not decrease over time - STRICTLY_INCREASING: Values should strictly increase over time - STRICTLY_DECREASING: Values should strictly decrease over time - CONSTANT: Values should remain constant over time"
                - `differenceBounds` · object
                  "The range of numeric values a check is expected to be within."
                  - `lowerBound` · number
                  - `upperBound` · number
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `dateColumnRange` · object
            "Checks that values in a date column fall within a specified range."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `columnName` · string · required
            - `dateBoundsConfig` · object · required
              "Configuration for date bounds check with severity settings."
              - `dateBounds` · object · required
                "The range of date values a check is expected to be within."
                - `lowerBound` · string
                - `upperBound` · string
              - `severity` · enum · required
                one of `MODERATE`, `CRITICAL`
                "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `jobDuration` · object
            "Checks the total time a job takes to complete."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `timeCheckConfig` · object · required
              - `timeBounds` · object
                "Configuration for time bounds check with severity settings."
                - `timeBounds` · object · required
                  "The configuration for the range of time between which the health check is expected to succeed."
                  - `lowerBoundInSeconds` · string
                  - `upperBoundInSeconds` · string
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `medianDeviation` · object
                "Configuration for median deviation check with severity settings."
                - `medianDeviation` · object · required
                  "The number of thresholds the build's duration differs from the median."
                  - `boundsType` · enum
                    one of `LOWER_BOUND`, `UPPER_BOUND`, `TWO_TAILED`
                    "The three types of median deviations a bounds type can have: - LOWER_BOUND – Tests for significant deviations below the median value, - UPPER_BOUND – Tests for significant deviations above the median value, - TWO_TAILED – Tests for significant deviations in either direction from the median value."
                  - `dataPoints` · integer · required
                  - `deviationThreshold` · number · required
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `approximateUniquePercentage` · object
            "Checks the approximate percentage of unique values in a specific column."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `percentageCheckConfig` · object · required
              "Configuration for percentage-based checks (such as null percentage)."
              - `columnName` · string · required
              - `percentageBounds` · object
                "Configuration for percentage bounds check with severity settings."
                - `percentageBounds` · object · required
                  "The configuration for the range of percentage values between which the health check is expected to succeed."
                  - `lowerBoundPercentage` · number
                    "A percentage value in the range 0.0 to 100.0. Validation rules: * must be greater than or equal to 0.0 * must be less than or equal to 100.0"
                  - `upperBoundPercentage` · number
                    "A percentage value in the range 0.0 to 100.0. Validation rules: * must be greater than or equal to 0.0 * must be less than or equal to 100.0"
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `medianDeviation` · object
                "Configuration for median deviation check with severity settings."
                - `medianDeviation` · object · required
                  "The number of thresholds the build's duration differs from the median."
                  - `boundsType` · enum
                    one of `LOWER_BOUND`, `UPPER_BOUND`, `TWO_TAILED`
                    "The three types of median deviations a bounds type can have: - LOWER_BOUND – Tests for significant deviations below the median value, - UPPER_BOUND – Tests for significant deviations above the median value, - TWO_TAILED – Tests for significant deviations in either direction from the median value."
                  - `dataPoints` · integer · required
                  - `deviationThreshold` · number · required
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `buildStatus` · object
            "Checks the status of the most recent build of the dataset."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `statusCheckConfig` · object · required
              - `severity` · enum · required
                one of `MODERATE`, `CRITICAL`
                "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `escalationConfig` · object
                "The configuration for when the severity of the failing health check should be escalated to CRITICAL – after a given number of failures, possibly within a time interval."
                - `failuresToCritical` · integer · required
                - `timeIntervalInSeconds` · string
          - `columnType` · object
            "Checks the existence and optionally the type of a specific column."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `columnTypeConfig` · object · required
              "Configuration for column type validation with severity settings."
              - `columnName` · string · required
              - `expectedType` · enum
                one of `ARRAY`, `BINARY`, `BOOLEAN`, `BYTE`, `DATE`, `DECIMAL`, `DOUBLE`, `FLOAT`, `INTEGER`, `LONG`, `MAP`, `SHORT`, `STRING`, `STRUCT`, `TIMESTAMP`
                "The data type of a column in a dataset schema."
              - `severity` · enum · required
                one of `MODERATE`, `CRITICAL`
                "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `allowedColumnValues` · object
            "Checks that values in a column are within an allowed set of values."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `columnName` · string · required
            - `allowedValues` · list
              - `ColumnValue` · union · required
                "A column value that can be of different types."
                - `date` · object
                  "A date column value."
                  - `value` · string · required
                - `boolean` · object
                  "A boolean column value."
                  - `value` · boolean · required
                - `string` · object
                  "A string column value."
                  - `value` · string · required
                - `numeric` · object
                  "A numeric column value."
                  - `value` · number · required
            - `allowNull` · boolean
            - `severity` · enum · required
              one of `MODERATE`, `CRITICAL`
              "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `timeSinceLastUpdated` · object
            "Checks the total time since the dataset has updated."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `timeCheckConfig` · object · required
              "Defines the configuration of a transaction-based time check."
              - `timeBounds` · object
                "Configuration for time bounds check with severity settings."
                - `timeBounds` · object · required
                  "The configuration for the range of time between which the health check is expected to succeed."
                  - `lowerBoundInSeconds` · string
                  - `upperBoundInSeconds` · string
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `medianDeviation` · object
                "Configuration for median deviation check with severity settings."
                - `medianDeviation` · object · required
                  "The number of thresholds the build's duration differs from the median."
                  - `boundsType` · enum
                    one of `LOWER_BOUND`, `UPPER_BOUND`, `TWO_TAILED`
                    "The three types of median deviations a bounds type can have: - LOWER_BOUND – Tests for significant deviations below the median value, - UPPER_BOUND – Tests for significant deviations above the median value, - TWO_TAILED – Tests for significant deviations in either direction from the median value."
                  - `dataPoints` · integer · required
                  - `deviationThreshold` · number · required
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `ignoreEmptyTransactions` · boolean
                "Whether empty transactions should be ignored when calculating time since last updated. If true (default), only transactions with actual data changes are considered."
          - `scheduleStatus` · object
            "Checks the status of the most recent schedule run."
            - `subject` · object · required
              "A schedule resource type."
              - `scheduleRid` · string · required
                "The RID of a Schedule."
            - `statusCheckConfig` · object · required
              - `severity` · enum · required
                one of `MODERATE`, `CRITICAL`
                "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `escalationConfig` · object
                "The configuration for when the severity of the failing health check should be escalated to CRITICAL – after a given number of failures, possibly within a time interval."
                - `failuresToCritical` · integer · required
                - `timeIntervalInSeconds` · string
          - `nullPercentage` · object
            "Checks the percentage of null values in a specific column."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `percentageCheckConfig` · object · required
              "Configuration for percentage-based checks (such as null percentage)."
              - `columnName` · string · required
              - `percentageBounds` · object
                "Configuration for percentage bounds check with severity settings."
                - `percentageBounds` · object · required
                  "The configuration for the range of percentage values between which the health check is expected to succeed."
                  - `lowerBoundPercentage` · number
                    "A percentage value in the range 0.0 to 100.0. Validation rules: * must be greater than or equal to 0.0 * must be less than or equal to 100.0"
                  - `upperBoundPercentage` · number
                    "A percentage value in the range 0.0 to 100.0. Validation rules: * must be greater than or equal to 0.0 * must be less than or equal to 100.0"
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `medianDeviation` · object
                "Configuration for median deviation check with severity settings."
                - `medianDeviation` · object · required
                  "The number of thresholds the build's duration differs from the median."
                  - `boundsType` · enum
                    one of `LOWER_BOUND`, `UPPER_BOUND`, `TWO_TAILED`
                    "The three types of median deviations a bounds type can have: - LOWER_BOUND – Tests for significant deviations below the median value, - UPPER_BOUND – Tests for significant deviations above the median value, - TWO_TAILED – Tests for significant deviations in either direction from the median value."
                  - `dataPoints` · integer · required
                  - `deviationThreshold` · number · required
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `scheduleDuration` · object
            "Checks the total time a schedule takes to complete."
            - `subject` · object · required
              "A schedule resource type."
              - `scheduleRid` · string · required
                "The RID of a Schedule."
            - `timeCheckConfig` · object · required
              - `timeBounds` · object
                "Configuration for time bounds check with severity settings."
                - `timeBounds` · object · required
                  "The configuration for the range of time between which the health check is expected to succeed."
                  - `lowerBoundInSeconds` · string
                  - `upperBoundInSeconds` · string
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `medianDeviation` · object
                "Configuration for median deviation check with severity settings."
                - `medianDeviation` · object · required
                  "The number of thresholds the build's duration differs from the median."
                  - `boundsType` · enum
                    one of `LOWER_BOUND`, `UPPER_BOUND`, `TWO_TAILED`
                    "The three types of median deviations a bounds type can have: - LOWER_BOUND – Tests for significant deviations below the median value, - UPPER_BOUND – Tests for significant deviations above the median value, - TWO_TAILED – Tests for significant deviations in either direction from the median value."
                  - `dataPoints` · integer · required
                  - `deviationThreshold` · number · required
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `totalColumnCount` · object
            "Checks the total number of columns in the dataset."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `columnCountConfig` · object · required
              "Configuration for column count validation with severity settings."
              - `expectedValue` · string · required
              - `severity` · enum · required
                one of `MODERATE`, `CRITICAL`
                "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `numericColumnMedian` · object
            "Checks the median value of a numeric column."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `numericColumnCheckConfig` · object · required
              "Configuration for numeric column-based checks (such as mean or median). At least one of numericBounds or trend must be specified. Both may be provided to validate both the absolute value range and the trend behavior over time."
              - `columnName` · string · required
              - `numericBounds` · object
                "Configuration for numeric bounds check with severity settings."
                - `numericBounds` · object · required
                  "The range of numeric values a check is expected to be within."
                  - `lowerBound` · number
                  - `upperBound` · number
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `trend` · object
                "Configuration for trend-based validation with severity settings. At least one of trendType or differenceBounds must be specified. Both may be provided to validate both the trend pattern and the magnitude of change."
                - `trendType` · enum
                  one of `NON_INCREASING`, `NON_DECREASING`, `STRICTLY_INCREASING`, `STRICTLY_DECREASING`, `CONSTANT`
                  "The type of trend to validate: - NON_INCREASING: Values should not increase over time - NON_DECREASING: Values should not decrease over time - STRICTLY_INCREASING: Values should strictly increase over time - STRICTLY_DECREASING: Values should strictly decrease over time - CONSTANT: Values should remain constant over time"
                - `differenceBounds` · object
                  "The range of numeric values a check is expected to be within."
                  - `lowerBound` · number
                  - `upperBound` · number
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `buildDuration` · object
            "Checks the total time a build takes to complete."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `timeCheckConfig` · object · required
              - `timeBounds` · object
                "Configuration for time bounds check with severity settings."
                - `timeBounds` · object · required
                  "The configuration for the range of time between which the health check is expected to succeed."
                  - `lowerBoundInSeconds` · string
                  - `upperBoundInSeconds` · string
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
              - `medianDeviation` · object
                "Configuration for median deviation check with severity settings."
                - `medianDeviation` · object · required
                  "The number of thresholds the build's duration differs from the median."
                  - `boundsType` · enum
                    one of `LOWER_BOUND`, `UPPER_BOUND`, `TWO_TAILED`
                    "The three types of median deviations a bounds type can have: - LOWER_BOUND – Tests for significant deviations below the median value, - UPPER_BOUND – Tests for significant deviations above the median value, - TWO_TAILED – Tests for significant deviations in either direction from the median value."
                  - `dataPoints` · integer · required
                  - `deviationThreshold` · number · required
                - `severity` · enum · required
                  one of `MODERATE`, `CRITICAL`
                  "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `schemaComparison` · object
            "Checks the dataset schema against an expected schema."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `schemaComparisonConfig` · object · required
              "Configuration for schema comparison validation with severity settings."
              - `expectedSchema` · object · required
                "Information about a dataset schema including all columns."
                - `columns` · list
                  - `ColumnInfo` · object · required
                    "Information about a column including its name and type."
                    - `name` · string · required
                    - `columnType` · enum
                      one of `ARRAY`, `BINARY`, `BOOLEAN`, `BYTE`, `DATE`, `DECIMAL`, `DOUBLE`, `FLOAT`, `INTEGER`, `LONG`, `MAP`, `SHORT`, `STRING`, `STRUCT`, `TIMESTAMP`
                      "The data type of a column in a dataset schema."
              - `schemaComparisonType` · enum · required
                one of `EXACT_MATCH_ORDERED_COLUMNS`, `EXACT_MATCH_UNORDERED_COLUMNS`, `COLUMN_ADDITIONS_ALLOWED`, `COLUMN_ADDITIONS_ALLOWED_STRICT`
                "The type of schema comparison to perform: - EXACT_MATCH_ORDERED_COLUMNS: Schemas must have identical columns in the same order. - EXACT_MATCH_UNORDERED_COLUMNS: Schemas must have identical columns but order doesn't matter. - COLUMN_ADDITIONS_ALLOWED: Expected schema columns must be present, additional columns are allowed and missing column types are ignored. - COLUMN_ADDITIONS_ALLOWED_STRICT: Expected schema columns must be present, additional columns are allowed. Both expected and actual columns must specify types and they must match exactly."
              - `severity` · enum · required
                one of `MODERATE`, `CRITICAL`
                "The severity level of the check. Possible values are MODERATE or CRITICAL."
          - `primaryKey` · object
            "Checks the uniqueness and non-null values of one or more columns (primary key constraint)."
            - `subject` · object · required
              "A dataset resource type."
              - `datasetRid` · string · required
                "The Resource Identifier (RID) of a Dataset."
              - `branchId` · string · required
                "The name of a Branch."
            - `primaryKeyConfig` · object · required
              "Configuration for primary key validation with severity settings."
              - `columnNames` · list
                - `ColumnName` · string · required
              - `severity` · enum · required
                one of `MODERATE`, `CRITICAL`
                "The severity level of the check. Possible values are MODERATE or CRITICAL."
        - `intent` · string
          "A note about why the Check was set up."
        - `createdBy` · string
          "The user that created the Check."
        - `updatedTime` · string
          "The timestamp when the Check was last updated."
      - `result` · object · required
        "The result of running a check."
        - `status` · enum · required
          one of `PASSED`, `FAILED`, `WARNING`, `ERROR`, `NOT_APPLICABLE`, `NOT_COMPUTABLE`
          "The status of a check report execution."
        - `message` · string
          "Further details about the result of the check."
      - `createdTime` · string · required
        "The time at which the resource was created."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `CheckTypeNotSupported` (INVALID_ARGUMENT) — "The type of the requested check is not yet supported in the Platform API."
- `GetDatasetHealthCheckReportsPermissionDenied` (PERMISSION_DENIED) — "Could not getHealthCheckReports the Dataset."
