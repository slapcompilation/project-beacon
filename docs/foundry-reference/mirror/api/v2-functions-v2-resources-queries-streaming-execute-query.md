<!-- source: https://palantir.com/docs/foundry/api/v2/functions-v2-resources/queries/streaming-execute-query/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Streaming Execute Query

`POST /api/v2/functions/queries/{queryApiName}/streamingExecute`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Executes a Query and returns results as a Server-Sent Events (`text/event-stream`) stream.
By default, this executes the highest semantic version of the query, excluding pre-release
versions. To resolve the most recently published version instead, including pre-release
versions, set `latestVersionResolution` to `PUBLISH_TIME`.

This endpoint supports all Query functions. Each SSE event's `data` field is a JSON-encoded
`StreamingExecuteQueryResponse` – either a data batch (`type: data`) carrying one or more
result values, or an error (`type: error`) emitted before stream termination if execution
fails. Non-streaming functions emit a single data event containing the entire result;
streaming functions emit a data event per batch as results become available.

Per the Server-Sent Events specification, each event is terminated by a blank line:

```
data: {"type":"data","value":[{"productId":"SKU-001","price":29.99}]}

data: {"type":"error","errorCode":"INVALID_ARGUMENT","errorName":"QueryRuntimeError","errorInstanceId":"3f8a9c7b-2e4d-4a1f-9b8c-7d6e5f4a3b2c","errorDescription":"Division by zero","parameters":{}}

```


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

- `StreamingExecuteQueryRequest` · object · required
  - `ontology` · string
    "Optional ontology identifier (RID or API name). When provided, executes an ontology-scoped function. When omitted, executes a global function."
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

- `StreamingExecuteQueryResponse` · union · required
  "Returns a stream of Server-Sent Events (`text/event-stream`). Each event's `data` field is a JSON-encoded payload of the type described below. A single message in a streaming Query execution response. Each message contains either a data batch or an error."
  - `data` · object
    "A batch of query results."
    - `value` · any · required
      "Represents the value of data in the following format. Note that these values can be nested, for example an array of structs. | Type                        | JSON encoding                                         | Example                                                                       | |-----------------------------|-------------------------------------------------------|-------------------------------------------------------------------------------| | Array                       | array                                                 | `["alpha", "bravo", "charlie"]`                                               | | Attachment                  | string                                                | `"ri.attachments.main.attachment.2f944bae-5851-4204-8615-920c969a9f2e"`       | | Boolean                     | boolean                                               | `true`                                                                        | | Byte                        | number                                                | `31`                                                                          | | Date                        | ISO 8601 extended local date string                   | `"2021-05-01"`                                                                | | Decimal                     | string                                                | `"2.718281828"`                                                               | | Float                       | number                                                | `3.14159265`                                                                  | | Double                      | number                                                | `3.14159265`                                                                  | | Integer                     | number                                                | `238940`                                                                      | | Long                        | string                                                | `"58319870951433"`                                                            | | Marking                     | string                                                | `"MU"`                                                                        | | Null                        | null                                                  | `null`                                                                        | | Set                         | array                                                 | `["alpha", "bravo", "charlie"]`                                               | | Short                       | number                                                | `8739`                                                                        | | String                      | string                                                | `"Call me Ishmael"`                                                           | | Struct                      | JSON object                                           | `{"name": "John Doe", "age": 42}`                                             | | TwoDimensionalAggregation   | JSON object                                           | `{"groups": [{"key": "alpha", "value": 100}, {"key": "beta", "value": 101}]}` | | ThreeDimensionalAggregation | JSON object                                           | `{"groups": [{"key": "NYC", "groups": [{"key": "Engineer", "value" : 100}]}]}`| | Timestamp                   | ISO 8601 extended offset date-time string in UTC zone | `"2021-01-04T05:00:00Z"`                                                      |"
  - `error` · object
    "An error that occurred during query execution."
    - `errorCode` · string · required
    - `errorName` · string · required
    - `errorInstanceId` · string · required
    - `errorDescription` · string
    - `parameters` · map

## Errors

- `StreamingExecuteQueryPermissionDenied` (PERMISSION_DENIED) — "Could not streamingExecute the Query."
