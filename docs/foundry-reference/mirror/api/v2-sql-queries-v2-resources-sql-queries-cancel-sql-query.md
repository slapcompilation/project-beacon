<!-- source: https://palantir.com/docs/foundry/api/v2/sql-queries-v2-resources/sql-queries/cancel-sql-query/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Cancel Sql Query

`POST /api/v2/sqlQueries/{sqlQueryId}/cancel`

Cancels a query. If the query is no longer running this is effectively a no-op.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:sql-queries-execute`.

Scopes: `api:sql-queries-execute`

## Path parameters

- `sqlQueryId` · string · required
  "The unique identifier for a query. Note that query IDs are not URL-safe and must be URL-encoded when used in API endpoints."

## Errors

- `QueryPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to access the given query."
- `QueryCanceled` (INVALID_ARGUMENT) — "The query was canceled."
- `QueryFailed` (INTERNAL) — "The query failed."
- `QueryParseError` (INVALID_ARGUMENT) — "The query cannot be parsed."
- `QueryRunning` (INVALID_ARGUMENT) — "The query is running."
- `ReadQueryInputsPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to access the inputs to the query."
- `CancelSqlQueryPermissionDenied` (PERMISSION_DENIED) — "Could not cancel the SqlQuery."
