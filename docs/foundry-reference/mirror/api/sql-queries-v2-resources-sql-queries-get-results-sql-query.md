<!-- source: https://palantir.com/docs/foundry/api/sql-queries-v2-resources/sql-queries/get-results-sql-query/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Results Sql Query

`GET /api/v2/sqlQueries/{sqlQueryId}/getResults`

Gets the results of a query. Results are returned in the `serializationFormat` specified at execute time
(defaulting to [Apache Arrow](https://arrow.apache.org/) if no format is provided).

This endpoint implements long polling and requests will time out after one minute. They can be safely
retried while the query is still running.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:sql-queries-read`.

Scopes: `api:sql-queries-read`

## Path parameters

- `sqlQueryId` · string · required
  "The unique identifier for a query. Note that query IDs are not URL-safe and must be URL-encoded when used in API endpoints."

## Response

- `body` · string · required

## Errors

- `QueryCanceled` (INVALID_ARGUMENT) — "The query was canceled."
- `QueryFailed` (INTERNAL) — "The query failed."
- `QueryParseError` (INVALID_ARGUMENT) — "The query cannot be parsed."
- `QueryRunning` (INVALID_ARGUMENT) — "The query is running."
- `ReadQueryInputsPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to access the inputs to the query."
- `QueryPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to access the given query."
- `GetResultsSqlQueryPermissionDenied` (PERMISSION_DENIED) — "Could not getResults the SqlQuery."
