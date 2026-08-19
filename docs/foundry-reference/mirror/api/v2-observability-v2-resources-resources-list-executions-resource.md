<!-- source: https://palantir.com/docs/foundry/api/v2/observability-v2-resources/resources/list-executions-resource/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Executions Resource

`POST /api/v2/observability/resources/{resourceRid}/listExecutions`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

List recent executions (function runs, automation runs, etc.) for a given resource.
Returns execution summaries ordered by most recent first.
Only completed executions are included in the results.

If neither `startTime` nor `endTime` is specified, executions from the last 24 hours
are returned.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:observability-read`.

Scopes: `api:observability-read`

## Path parameters

- `resourceRid` · string · required
  "The Resource Identifier (RID) of the Foundry resource."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `ListExecutionsResourceRequest` · object · required
  - `startTime` · string
    "Return executions that started at or after this time. Defaults to 24 hours ago."
  - `endTime` · string
    "Return executions that started before this time (exclusive). Defaults to now."
  - `where` · union
    "Optional filter to narrow the execution results."
    - `not` · object
      "Negates a filter."
      - `filter` · union · required
        "Filter for execution search. Operators (`eq`, `gte`, `lte`, `in`, `isNull`) are the discriminator; the `field` parameter names the Execution property to filter on; `value` is the operand. Compose with `and`, `or`, and `not`. Not every operator is valid for every field; invalid combinations are rejected with `InvalidExecutionFilter`. See `ExecutionField` for the available fields."
    - `or` · object
      "Combines multiple filters with OR logic. At least one filter must match."
      - `filters` · list
        - `ExecutionFilter` · union · required
          "Filter for execution search. Operators (`eq`, `gte`, `lte`, `in`, `isNull`) are the discriminator; the `field` parameter names the Execution property to filter on; `value` is the operand. Compose with `and`, `or`, and `not`. Not every operator is valid for every field; invalid combinations are rejected with `InvalidExecutionFilter`. See `ExecutionField` for the available fields."
    - `in` · object
      "Matches executions where the specified field is one of the values in the list."
      - `field` · enum · required
        one of `status`, `duration`, `userId`, `callerRid`, `resourceVersion`, `failureReason`, `foundryTraceId`, `traceOwningRid`
        "The Execution property being filtered. Each field supports a specific set of operators: - `status` (enum: SUCCEEDED, FAILED): `eq`, `in` - `duration` (Core.Duration): `gte`, `lte` - `userId` (Core.UserId): `eq`, `in`, `isNull` - `callerRid` (string): `eq`, `in`, `isNull` - `resourceVersion` (string): `eq`, `in` - `failureReason` (string): `eq`, `in` - `foundryTraceId` (string): `eq`, `in` - `traceOwningRid` (string): `eq`, `in`"
      - `value` · list
        "List of values to match against. Element type depends on the field."
    - `and` · object
      "Combines multiple filters with AND logic. All filters must match."
      - `filters` · list
        - `ExecutionFilter` · union · required
          "Filter for execution search. Operators (`eq`, `gte`, `lte`, `in`, `isNull`) are the discriminator; the `field` parameter names the Execution property to filter on; `value` is the operand. Compose with `and`, `or`, and `not`. Not every operator is valid for every field; invalid combinations are rejected with `InvalidExecutionFilter`. See `ExecutionField` for the available fields."
    - `isNull` · object
      "Matches executions where the specified field is absent. Only valid for optional fields (e.g., `callerRid` for "no caller", `userId` for system-triggered executions)."
      - `field` · enum · required
        one of `status`, `duration`, `userId`, `callerRid`, `resourceVersion`, `failureReason`, `foundryTraceId`, `traceOwningRid`
        "The Execution property being filtered. Each field supports a specific set of operators: - `status` (enum: SUCCEEDED, FAILED): `eq`, `in` - `duration` (Core.Duration): `gte`, `lte` - `userId` (Core.UserId): `eq`, `in`, `isNull` - `callerRid` (string): `eq`, `in`, `isNull` - `resourceVersion` (string): `eq`, `in` - `failureReason` (string): `eq`, `in` - `foundryTraceId` (string): `eq`, `in` - `traceOwningRid` (string): `eq`, `in`"
    - `gte` · object
      "Matches executions where the specified field is greater than or equal to the value. Only valid for ordered fields (currently `duration`)."
      - `field` · enum · required
        one of `status`, `duration`, `userId`, `callerRid`, `resourceVersion`, `failureReason`, `foundryTraceId`, `traceOwningRid`
        "The Execution property being filtered. Each field supports a specific set of operators: - `status` (enum: SUCCEEDED, FAILED): `eq`, `in` - `duration` (Core.Duration): `gte`, `lte` - `userId` (Core.UserId): `eq`, `in`, `isNull` - `callerRid` (string): `eq`, `in`, `isNull` - `resourceVersion` (string): `eq`, `in` - `failureReason` (string): `eq`, `in` - `foundryTraceId` (string): `eq`, `in` - `traceOwningRid` (string): `eq`, `in`"
      - `value` · object · required
        "The lower bound (inclusive). Supported units: MILLISECONDS, SECONDS, MINUTES, HOURS. Negative values are rejected."
        - `value` · integer · required
          "The duration value."
        - `unit` · enum · required
          one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
          "The unit of duration."
    - `eq` · object
      "Matches executions where the specified field equals the value exactly."
      - `field` · enum · required
        one of `status`, `duration`, `userId`, `callerRid`, `resourceVersion`, `failureReason`, `foundryTraceId`, `traceOwningRid`
        "The Execution property being filtered. Each field supports a specific set of operators: - `status` (enum: SUCCEEDED, FAILED): `eq`, `in` - `duration` (Core.Duration): `gte`, `lte` - `userId` (Core.UserId): `eq`, `in`, `isNull` - `callerRid` (string): `eq`, `in`, `isNull` - `resourceVersion` (string): `eq`, `in` - `failureReason` (string): `eq`, `in` - `foundryTraceId` (string): `eq`, `in` - `traceOwningRid` (string): `eq`, `in`"
      - `value` · any · required
        "The value to match against. Type depends on the field — see `ExecutionField` docs."
    - `lte` · object
      "Matches executions where the specified field is less than or equal to the value. Only valid for ordered fields (currently `duration`)."
      - `field` · enum · required
        one of `status`, `duration`, `userId`, `callerRid`, `resourceVersion`, `failureReason`, `foundryTraceId`, `traceOwningRid`
        "The Execution property being filtered. Each field supports a specific set of operators: - `status` (enum: SUCCEEDED, FAILED): `eq`, `in` - `duration` (Core.Duration): `gte`, `lte` - `userId` (Core.UserId): `eq`, `in`, `isNull` - `callerRid` (string): `eq`, `in`, `isNull` - `resourceVersion` (string): `eq`, `in` - `failureReason` (string): `eq`, `in` - `foundryTraceId` (string): `eq`, `in` - `traceOwningRid` (string): `eq`, `in`"
      - `value` · object · required
        "The upper bound (inclusive). Supported units: MILLISECONDS, SECONDS, MINUTES, HOURS. Negative values are rejected."
        - `value` · integer · required
          "The duration value."
        - `unit` · enum · required
          one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
          "The unit of duration."
  - `pageSize` · integer
    "The maximum number of executions to return per page. Maximum value is 100."
  - `pageToken` · string
    "A token to retrieve the next page of results from a previous request."

## Response

- `ListExecutionsResponse` · object · required
  "A page of execution results."
  - `data` · list
    "The list of executions matching the query."
    - `Execution` · object · required
      "A single run of a Foundry compute resource (e.g., one function invocation, one automation run)."
      - `traceOwningRid` · string · required
        "The RID of the resource that owns the trace context for this execution. Pair with `foundryTraceId` to retrieve logs for the execution."
      - `foundryTraceId` · string · required
        "The Foundry trace ID for this execution. Uniquely identifies the trace, but on its own is not yet sufficient to look up logs — pair with `traceOwningRid` to retrieve logs for the execution."
      - `resourceRid` · string · required
        "The Resource Identifier (RID) of the resource that produced this execution."
      - `resourceVersion` · string · required
        "The version of the resource at the time of execution."
      - `status` · enum · required
        one of `SUCCEEDED`, `FAILED`
        "Whether the execution succeeded or failed."
      - `failureReason` · string
        "An enumerated reason for why the execution failed, if applicable. This is a classification string (e.g., "invalid_parameter", "timeout"), not free-text."
      - `startTime` · string · required
        "The time at which the execution started."
      - `duration` · object · required
        "The total duration of the execution."
        - `value` · integer · required
          "The duration value."
        - `unit` · enum · required
          one of `MILLISECONDS`, `SECONDS`, `MINUTES`, `HOURS`, `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
          "The unit of duration."
      - `callerRid` · string
        "The RID of the caller that triggered the execution (e.g., the Workshop app or automation that initiated it)."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `InvalidExecutionFilter` (INVALID_ARGUMENT) — "The provided execution filter is invalid. This may be due to missing required fields
or other malformed filter parameters."
- `ListExecutionsPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to list executions for this resource."
- `ListExecutionsResourcePermissionDenied` (PERMISSION_DENIED) — "Could not listExecutions the Resource."
- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
