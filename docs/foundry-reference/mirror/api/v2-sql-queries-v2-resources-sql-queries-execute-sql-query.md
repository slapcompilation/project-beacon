<!-- source: https://palantir.com/docs/foundry/api/v2/sql-queries-v2-resources/sql-queries/execute-sql-query/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Execute Sql Query

`POST /api/v2/sqlQueries/execute`

Executes a new query. Only the user that invoked the query can operate on the query. The size of query
results are limited by default to 1 million rows. Contact your Palantir representative to discuss limit
increases.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:sql-queries-execute`.

Scopes: `api:sql-queries-execute`

## Request

- `ExecuteSqlQueryRequest` · object · required
  - `query` · string · required
    "The SQL query to execute. Queries should conform to the [Spark SQL dialect](https://spark.apache.org/docs/latest/sql-ref.html). This supports SELECT queries only. Datasets can be referenced in SQL queries by path or by RID. See the [documentation](https://www.palantir.com/docs/foundry/analytics-connectivity/odbc-jdbc-drivers/#use-sql-to-query-foundry-datasets) for more details."
  - `fallbackBranchIds` · list
    "The list of branch ids to use as fallbacks if the query fails to execute on the primary branch. If a is not explicitly provided in the SQL query, the resource will be queried on the first fallback branch provided that exists. If no fallback branches are provided the default branch is used. This is `master` for most enrollments."
    - `BranchName` · string · required
      "The name of a Branch."
  - `serializationFormat` · enum
    one of `ARROW`, `CSV`
    "The format used to serialize query results. If not specified, defaults to `ARROW`."

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

- `ColumnTypesNotSupported` (INVALID_ARGUMENT) — "The query result contains column types that are not supported by the requested serialization format."
- `ReadQueryInputsPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to access the inputs to the query."
- `QueryParseError` (INVALID_ARGUMENT) — "The query cannot be parsed."
- `QueryCanceled` (INVALID_ARGUMENT) — "The query was canceled."
- `QueryPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to access the given query."
- `QueryFailed` (INTERNAL) — "The query failed."
- `QueryRunning` (INVALID_ARGUMENT) — "The query is running."
- `ExecuteSqlQueryPermissionDenied` (PERMISSION_DENIED) — "Could not execute the SqlQuery."
