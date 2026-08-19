<!-- source: https://palantir.com/docs/foundry/api/v2/functions-v2-resources/queries/execute-query/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Execute Query

`POST /api/v2/functions/queries/{queryApiName}/execute`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Executes a Query and returns the result as a single JSON object. By default, this executes
the highest semantic version of the query, excluding pre-release versions. To resolve the
most recently published version instead, including pre-release versions, set
`latestVersionResolution` to `PUBLISH_TIME`.

This endpoint executes global (non-ontology-scoped) query functions. For ontology-scoped
functions, use the equivalent endpoint under
`/v2/ontologies/{ontology}/queries/{queryApiName}/execute`. For streaming or incremental
result delivery, use `streamingExecute`.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:functions-execute`.

Scopes: `api:functions-execute`

## Path parameters

- `queryApiName` · string · required
  "The name of the Query in the API."

## Query parameters

- `transactionId` · string
  "The ID of a transaction to read from. Transactions are an experimental feature and not all workflows may be supported."
- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `ExecuteQueryRequest` · object · required
  - `parameters` · map
    - `ParameterId` · string · required
      "The unique identifier of the parameter. Parameters are used as inputs when an action or query is applied. Parameters can be viewed and managed in the **Ontology Manager**."
    - `DataValue` · any · required
      "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                        | JSON encoding                                         | Example                                                                       | |-----------------------------|-------------------------------------------------------|-------------------------------------------------------------------------------| | Array                       | array                                                 | `["alpha", "bravo", "charlie"]`                                               | | Attachment                  | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`       | | Boolean                     | boolean                                               | `true`                                                                        | | Byte                        | number                                                | `31`                                                                          | | Date                        | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                | | Decimal                     | string                                                | `"2.718281828"`                                                               | | Float                       | number                                                | `3.14159265`                                                                  | | Double                      | number                                                | `3.14159265`                                                                  | | Integer                     | number                                                | `238940`                                                                      | | Long                        | string                                                | `"58319870951433"`                                                            | | Marking                     | string                                                | `"MU"`                                                                        | | Null                        | null                                                  | `null`                                                                        | | Set                         | array                                                 | `["alpha", "bravo", "charlie"]`                                               | | Short                       | number                                                | `8739`                                                                        | | String                      | string                                                | `"Call me Ishmael"`                                                           | | Struct                      | JSON object                                           | `{"name": "John Doe", "age": 42}`                                             | | TwoDimensionalAggregation   | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}` | | ThreeDimensionalAggregation | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`| | Timestamp                   | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                      |"
  - `version` · string
    "The version of the query to execute. When used with `branch`, the specified version must exist on the branch."
  - `branch` · string
    "The Foundry branch to execute the query from. If not specified, the default branch is used. When provided without `version`, the latest version on this branch is used. When provided with `version`, the specified version must exist on the branch."
  - `latestVersionResolution` · enum
    one of `PUBLISH_TIME`, `SEMANTIC_VERSION`
    "Controls how latest version is resolved when `version` is omitted. Defaults to `SEMANTIC_VERSION`."
  - `includePrerelease` · boolean
    "When resolving the latest version, whether prerelease versions are considered. Defaults to `false`, except when `latestVersionResolution` is `PUBLISH_TIME`. Not supported together with `version`."

## Response

- `ExecuteQueryResponse` · object · required
  - `value` · any · required
    "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                        | JSON encoding                                         | Example                                                                       | |-----------------------------|-------------------------------------------------------|-------------------------------------------------------------------------------| | Array                       | array                                                 | `["alpha", "bravo", "charlie"]`                                               | | Attachment                  | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`       | | Boolean                     | boolean                                               | `true`                                                                        | | Byte                        | number                                                | `31`                                                                          | | Date                        | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                | | Decimal                     | string                                                | `"2.718281828"`                                                               | | Float                       | number                                                | `3.14159265`                                                                  | | Double                      | number                                                | `3.14159265`                                                                  | | Integer                     | number                                                | `238940`                                                                      | | Long                        | string                                                | `"58319870951433"`                                                            | | Marking                     | string                                                | `"MU"`                                                                        | | Null                        | null                                                  | `null`                                                                        | | Set                         | array                                                 | `["alpha", "bravo", "charlie"]`                                               | | Short                       | number                                                | `8739`                                                                        | | String                      | string                                                | `"Call me Ishmael"`                                                           | | Struct                      | JSON object                                           | `{"name": "John Doe", "age": 42}`                                             | | TwoDimensionalAggregation   | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}` | | ThreeDimensionalAggregation | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`| | Timestamp                   | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                      |"

## Errors

- `ExecuteQueryPermissionDenied` (PERMISSION_DENIED) — "Could not execute the Query."
