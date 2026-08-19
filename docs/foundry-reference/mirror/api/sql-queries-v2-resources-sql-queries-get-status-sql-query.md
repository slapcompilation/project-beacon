<!-- source: https://palantir.com/docs/foundry/api/sql-queries-v2-resources/sql-queries/get-status-sql-query/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Status Sql Query

`GET /api/v2/sqlQueries/{sqlQueryId}/getStatus`

Gets the status of a query.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:sql-queries-read`.

Scopes: `api:sql-queries-read`

## Path parameters

- `sqlQueryId` · string · required
  "The unique identifier for a query. Note that query IDs are not URL-safe and must be URL-encoded when used in API endpoints."

## Response

- `QueryStatus` · union · required
  - `running` · object
    - `queryId` · string · required
      "The identifier of a SQL Query."
  - `canceled` · object
  - `failed` · object
    - `errorMessage` · string · required
      "An error message describing why the query failed."
  - `succeeded` · object
    - `queryId` · string · required
      "The identifier of a SQL Query."

## Errors

- `QueryPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to access the given query."
- `QueryCanceled` (INVALID_ARGUMENT) — "The query was canceled."
- `QueryFailed` (INTERNAL) — "The query failed."
- `QueryParseError` (INVALID_ARGUMENT) — "The query cannot be parsed."
- `QueryRunning` (INVALID_ARGUMENT) — "The query is running."
- `ReadQueryInputsPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to access the inputs to the query."
- `GetStatusSqlQueryPermissionDenied` (PERMISSION_DENIED) — "Could not getStatus the SqlQuery."
