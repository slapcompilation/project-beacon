<!-- source: https://palantir.com/docs/foundry/api/v2/connectivity-v2-resources/table-imports/list-table-imports/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Table Imports

`GET /api/v2/connectivity/connections/{connectionRid}/tableImports`

Lists all table imports defined for this connection.
Only table imports that the user has permissions to view will be returned.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:connectivity-table-import-read`.

Scopes: `api:connectivity-table-import-read`

## Path parameters

- `connectionRid` · string · required
  "The Resource Identifier (RID) of a Connection (also known as a source)."

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListTableImportsResponse` · object · required
  - `data` · list
    - `TableImport` · object · required
      - `rid` · string · required
        "The Resource Identifier (RID) of a TableImport (also known as a batch sync)."
      - `connectionRid` · string · required
        "The RID of the Connection (also known as a source) that the Table Import uses to import data."
      - `datasetRid` · string · required
        "The RID of the output dataset. Can not be modified after the table import is created."
      - `branchName` · string
        "The branch name in the output dataset that will contain the imported data. Defaults to `master` for most enrollments. Can not be modified after the table import is created."
      - `displayName` · string · required
      - `importMode` · enum · required
        one of `SNAPSHOT`, `APPEND`
        "Import mode governs how data is read from an external system, and written into a Foundry dataset. SNAPSHOT: Defines a new dataset state consisting only of data from a particular import execution. APPEND: Purely additive and yields data from previous import executions in addition to newly added data."
      - `allowSchemaChanges` · boolean · required
        "Allow the TableImport to succeed if the schema of imported rows does not match the existing dataset's schema. Defaults to false for new table imports."
      - `config` · union · required
        "The import configuration for a specific [connector type](/docs/foundry/data-integration/source-type-overview)."
        - `databricksImportConfig` · object
          "The table import configuration for a [Databricks connection](/docs/foundry/available-connectors/databricks)."
          - `query` · string · required
            "A single SQL query can be executed per sync, which should output a data table and avoid operations like invoking stored procedures. The query results are saved to the output dataset in Foundry."
          - `initialIncrementalState` · union
            "The incremental configuration for a table import enables append-style transactions from the same table without duplication of data. You must provide a monotonically increasing column such as a timestamp or id and an initial value for this column. An incremental table import will import rows where the value is greater than the largest already imported. You can use the '?' character to reference the incremental state value when constructing your query. Normally this would be used in a WHERE clause or similar filter applied in order to only sync data with an incremental column value larger than the previously observed maximum value stored in the incremental state."
            - `stringColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a string data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the string column to reference in the query."
            - `dateColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a date type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the date column to reference in the query."
            - `integerColumnInitialIncrementalState` · object
              "The state for an incremental table import using a numeric integer datatype."
              - `columnName` · string · required
              - `currentValue` · integer · required
                "The initial incremental state value for the integer column to reference in the query."
            - `timestampColumnInitialIncrementalState` · object
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the timestamp column in UTC to reference in the query."
            - `longColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a numeric long datatype."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the long column to reference in the query."
            - `decimalColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a decimal data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the decimal column to reference in the query."
        - `jdbcImportConfig` · object
          "The import configuration for a [custom JDBC connection](/docs/foundry/available-connectors/custom-jdbc-sources)."
          - `query` · string · required
            "A single SQL query can be executed per sync, which should output a data table and avoid operations like invoking stored procedures. The query results are saved to the output dataset in Foundry."
          - `initialIncrementalState` · union
            "The incremental configuration for a table import enables append-style transactions from the same table without duplication of data. You must provide a monotonically increasing column such as a timestamp or id and an initial value for this column. An incremental table import will import rows where the value is greater than the largest already imported. You can use the '?' character to reference the incremental state value when constructing your query. Normally this would be used in a WHERE clause or similar filter applied in order to only sync data with an incremental column value larger than the previously observed maximum value stored in the incremental state."
            - `stringColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a string data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the string column to reference in the query."
            - `dateColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a date type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the date column to reference in the query."
            - `integerColumnInitialIncrementalState` · object
              "The state for an incremental table import using a numeric integer datatype."
              - `columnName` · string · required
              - `currentValue` · integer · required
                "The initial incremental state value for the integer column to reference in the query."
            - `timestampColumnInitialIncrementalState` · object
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the timestamp column in UTC to reference in the query."
            - `longColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a numeric long datatype."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the long column to reference in the query."
            - `decimalColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a decimal data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the decimal column to reference in the query."
        - `microsoftSqlServerImportConfig` · object
          "The import configuration for a [Microsoft SQL Server connection](/docs/foundry/available-connectors/microsoft-sql-server)."
          - `query` · string · required
            "A single SQL query can be executed per sync, which should output a data table and avoid operations like invoking stored procedures. The query results are saved to the output dataset in Foundry."
          - `initialIncrementalState` · union
            "The incremental configuration for a table import enables append-style transactions from the same table without duplication of data. You must provide a monotonically increasing column such as a timestamp or id and an initial value for this column. An incremental table import will import rows where the value is greater than the largest already imported. You can use the '?' character to reference the incremental state value when constructing your query. Normally this would be used in a WHERE clause or similar filter applied in order to only sync data with an incremental column value larger than the previously observed maximum value stored in the incremental state."
            - `stringColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a string data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the string column to reference in the query."
            - `dateColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a date type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the date column to reference in the query."
            - `integerColumnInitialIncrementalState` · object
              "The state for an incremental table import using a numeric integer datatype."
              - `columnName` · string · required
              - `currentValue` · integer · required
                "The initial incremental state value for the integer column to reference in the query."
            - `timestampColumnInitialIncrementalState` · object
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the timestamp column in UTC to reference in the query."
            - `longColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a numeric long datatype."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the long column to reference in the query."
            - `decimalColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a decimal data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the decimal column to reference in the query."
        - `postgreSqlImportConfig` · object
          "The import configuration for a [PostgreSQL connection](/docs/foundry/available-connectors/postgresql)."
          - `query` · string · required
            "A single SQL query can be executed per sync, which should output a data table and avoid operations like invoking stored procedures. The query results are saved to the output dataset in Foundry."
          - `initialIncrementalState` · union
            "The incremental configuration for a table import enables append-style transactions from the same table without duplication of data. You must provide a monotonically increasing column such as a timestamp or id and an initial value for this column. An incremental table import will import rows where the value is greater than the largest already imported. You can use the '?' character to reference the incremental state value when constructing your query. Normally this would be used in a WHERE clause or similar filter applied in order to only sync data with an incremental column value larger than the previously observed maximum value stored in the incremental state."
            - `stringColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a string data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the string column to reference in the query."
            - `dateColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a date type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the date column to reference in the query."
            - `integerColumnInitialIncrementalState` · object
              "The state for an incremental table import using a numeric integer datatype."
              - `columnName` · string · required
              - `currentValue` · integer · required
                "The initial incremental state value for the integer column to reference in the query."
            - `timestampColumnInitialIncrementalState` · object
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the timestamp column in UTC to reference in the query."
            - `longColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a numeric long datatype."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the long column to reference in the query."
            - `decimalColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a decimal data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the decimal column to reference in the query."
        - `microsoftAccessImportConfig` · object
          "The import configuration for a [Microsoft Access connection](/docs/foundry/available-connectors/microsoft-access)."
          - `query` · string · required
            "A single SQL query can be executed per sync, which should output a data table and avoid operations like invoking stored procedures. The query results are saved to the output dataset in Foundry."
          - `initialIncrementalState` · union
            "The incremental configuration for a table import enables append-style transactions from the same table without duplication of data. You must provide a monotonically increasing column such as a timestamp or id and an initial value for this column. An incremental table import will import rows where the value is greater than the largest already imported. You can use the '?' character to reference the incremental state value when constructing your query. Normally this would be used in a WHERE clause or similar filter applied in order to only sync data with an incremental column value larger than the previously observed maximum value stored in the incremental state."
            - `stringColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a string data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the string column to reference in the query."
            - `dateColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a date type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the date column to reference in the query."
            - `integerColumnInitialIncrementalState` · object
              "The state for an incremental table import using a numeric integer datatype."
              - `columnName` · string · required
              - `currentValue` · integer · required
                "The initial incremental state value for the integer column to reference in the query."
            - `timestampColumnInitialIncrementalState` · object
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the timestamp column in UTC to reference in the query."
            - `longColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a numeric long datatype."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the long column to reference in the query."
            - `decimalColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a decimal data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the decimal column to reference in the query."
        - `snowflakeImportConfig` · object
          "The table import configuration for a [Snowflake connection](/docs/foundry/available-connectors/snowflake)."
          - `query` · string · required
            "A single SQL query can be executed per sync, which should output a data table and avoid operations like invoking stored procedures. The query results are saved to the output dataset in Foundry."
          - `initialIncrementalState` · union
            "The incremental configuration for a table import enables append-style transactions from the same table without duplication of data. You must provide a monotonically increasing column such as a timestamp or id and an initial value for this column. An incremental table import will import rows where the value is greater than the largest already imported. You can use the '?' character to reference the incremental state value when constructing your query. Normally this would be used in a WHERE clause or similar filter applied in order to only sync data with an incremental column value larger than the previously observed maximum value stored in the incremental state."
            - `stringColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a string data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the string column to reference in the query."
            - `dateColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a date type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the date column to reference in the query."
            - `integerColumnInitialIncrementalState` · object
              "The state for an incremental table import using a numeric integer datatype."
              - `columnName` · string · required
              - `currentValue` · integer · required
                "The initial incremental state value for the integer column to reference in the query."
            - `timestampColumnInitialIncrementalState` · object
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the timestamp column in UTC to reference in the query."
            - `longColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a numeric long datatype."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the long column to reference in the query."
            - `decimalColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a decimal data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the decimal column to reference in the query."
        - `oracleImportConfig` · object
          "The import configuration for an Oracle Database 21 connection."
          - `query` · string · required
            "A single SQL query can be executed per sync, which should output a data table and avoid operations like invoking stored procedures. The query results are saved to the output dataset in Foundry."
          - `initialIncrementalState` · union
            "The incremental configuration for a table import enables append-style transactions from the same table without duplication of data. You must provide a monotonically increasing column such as a timestamp or id and an initial value for this column. An incremental table import will import rows where the value is greater than the largest already imported. You can use the '?' character to reference the incremental state value when constructing your query. Normally this would be used in a WHERE clause or similar filter applied in order to only sync data with an incremental column value larger than the previously observed maximum value stored in the incremental state."
            - `stringColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a string data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the string column to reference in the query."
            - `dateColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a date type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the date column to reference in the query."
            - `integerColumnInitialIncrementalState` · object
              "The state for an incremental table import using a numeric integer datatype."
              - `columnName` · string · required
              - `currentValue` · integer · required
                "The initial incremental state value for the integer column to reference in the query."
            - `timestampColumnInitialIncrementalState` · object
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the timestamp column in UTC to reference in the query."
            - `longColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a numeric long datatype."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the long column to reference in the query."
            - `decimalColumnInitialIncrementalState` · object
              "The state for an incremental table import using a column with a decimal data type."
              - `columnName` · string · required
              - `currentValue` · string · required
                "The initial incremental state value for the decimal column to reference in the query."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ConnectionNotFound` (NOT_FOUND) — "The given Connection could not be found."
