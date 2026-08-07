<!-- source: https://palantir.com/docs/foundry/analytics-connectivity/architecture/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Architecture

:::callout{theme="warning"}
This page documents the architecture of the original Spark and Direct Read SQL engines. Foundry is transitioning to [Furnace](/docs/foundry/sql-warehousing/furnace/), a next-generation SQL engine with enhanced performance, flexibility, and compatibility. This transition is automatic and requires no changes to existing workflows.
:::

External SQL connectivity and the BI Tool integrations in this section are powered by a service called Foundry SQL Server. This service provides lightweight SQL session and statement management for read-only queries against Foundry Datasets. Palantir provides JDBC and ODBC drivers to facilitate client interactions with this service using open standards, as well as plugin implementations for certain third-party platforms which leverage these drivers.

## Supported SQL Dialects

Supported SQL dialects are `ANSI`, `ODBC`, and `SparkSQL`.

Note that support for these dialects is limited to read-only functionality.

## Execution Engines

Foundry SQL Server will automatically select an execution engine based on the complexity of the query. Each execution engine comes with a set of tradeoffs for overall performance, result size limitations, and supported query complexity.

### Spark Engine

The default execution engine for queries leverages Spark SQL functionality. This engine supports full SQL compute functionality such as aggregates, joins, order by, filters, etc. Queries which require use of this execution engine will be subject to limits regarding data scale, as results must be collected in memory on the Spark driver prior to delivering results to client applications. These limitations are a function of the number of rows and number of bytes in the result of the computation.

### Direct Read Engine

When possible, Foundry SQL Server will use the direct read engine to execute queries. When queries do not require SQL compute Foundry SQL Server will bypass Spark SQL and stream records directly from the backing files of a Dataset. Direct read queries are not subject to the same scale limitations as queries which require full SQL compute.

Queries are direct read eligible when:

1. Executed on a dataset. [Views](/docs/foundry/data-integration/views/) are not currently supported.
2. The dataset files are in a supported format. The formats currently supported by direct read are Parquet, CSV, Avro, and Soho.
3. The query does not require SQL compute. Queries which contain aggregate, filter, join, and order by predicates are not direct read eligible.
4. The query does not select from a column with a type that is ineligible for direct read. `array`, `map`, and `struct` are not direct read eligible.

Direct read queries are case-sensitive.

## Caveats

* This functionality is intended to support clients external to the Foundry Platform such as PowerBI, Tableau, or other downstream Applications. For SQL-powered transformations within the Foundry Platform see [SQL Transforms](/docs/foundry/code-workbook/workbooks-languages/#introduction-to-sql).
* The architecture of Foundry SQL Server has been optimized for ad-hoc interactive queries against moderate data scale.
