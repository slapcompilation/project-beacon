<!-- source: https://palantir.com/docs/foundry/transforms-python/tables-databricks/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Databricks compute pushdown

Foundry offers the ability to push down compute to Databricks when using [virtual tables](/docs/foundry/data-integration/virtual-tables/). When using Databricks virtual tables registered to the same source as inputs and outputs to a pipeline, it is possible to fully federate compute to Databricks.

This documentation walks you through the process of authoring a [Python transform](/docs/foundry/transforms-python/transforms/) in Code Repositories that can be executed entirely in your Databricks environment. This capability leverages Databricks Connect. Refer to the [official Databricks documentation ↗](https://docs.databricks.com/aws/en/dev-tools/databricks-connect) for more information on the features and limitations of Databricks Connect.

## Quick start

This example shows how to use a Databricks transform in a [Python transform pipeline](/docs/foundry/transforms-python/transforms/). Suppose we have the following Spark pipeline using PySpark via `@transform`:

```python
from pyspark.sql.functions import col
from transforms.api import transform, Input, Output


@transform.spark.using(
    source_table=Input('/Project/folder/input'),
    output_table=Output('/Project/folder/output'),
)
def compute(source_table: TransformInput, output_table: TransformOutput):
    df = source_table.dataframe()
    df = df.filter(col('id') > 1)
    output_table.write_dataframe(df)
```

To turn this into a Databricks transform, you must:

1. Review the [prerequisites to using tables in Python transforms](/docs/foundry/transforms-python/tables-overview/#prerequisites).
2. Install `databricks-connect` from the [**Libraries** tab](/docs/foundry/transforms-python/use-python-libraries/).
3. Import and apply the `@databricks` decorator to your transform.

For more details, consult the [setup](#setup) section of the documentation below.

```python
from pyspark.sql.functions import col
from transforms.api import transform
from transforms.tables import (
    databricks,
    DatabricksInput,
    DatabricksOutput,
    TableInput,
    TableOutput,
)


@transform.databricks.using(
    source_table=TableInput('/Project/folder/input'),
    output_table=TableOutput(
        '/Project/folder/output', # Where to register the Databricks output as a virtual table in Foundry
        "ri.magritte..source.1234", # Your Databricks source connection
       "CATALOG.SCHEMA.TABLE", # The location to which the transform output will be written in Databricks
    ),
)
def compute(source_table: DatabricksInput, output_table: DatabricksOutput):
    df = source_table.dataframe()
    df = df.filter(col('id') > 1)
    output_table.write_dataframe(df)
```

Given Databricks Connect uses the [`pyspark.sql.DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) API, you will see the logic of the code itself is largely unchanged. The primary difference is the transform uses Spark compute running in Databricks.

`TableInput` and `TableOutput` parameters are used instead of `Input` and `Output` to reference the input and output Databricks virtual tables of the transform. The transform function is passed `DatabricksInput` and `DatabricksOutput` parameters that can be used to read from and write to tables in Databricks.

:::callout{theme="neutral"}
The `@databricks` decorator, as shown above, is only compatible with `TableInput` and `TableOutput` parameters. The tables referenced as inputs and outputs to the transform must be registered on the same [Databricks source](/docs/foundry/available-connectors/databricks/).

Incremental computation using the `@incremental` decorator is not currently supported when using compute pushdown to Databricks.
:::

## Setup

To use compute pushdown with Databricks:

1. Create a [Python code repository](/docs/foundry/transforms-python/overview/).
2. Review the [prerequisites to using tables in Python transforms](/docs/foundry/transforms-python/tables-overview/#prerequisites).
3. Install the `databricks-connect` library. We recommend using version 16.4, as this is fully compatible with serverless compute. If using classic compute, you must use a version that is compatible with your Databricks cluster version. Refer to the [official Databricks documentation ↗](https://docs.databricks.com/aws/en/dev-tools/databricks-connect/requirements#databricks-connect-versions) for more information.

The `databricks-connect` library can be installed using the [**Libraries** tab](/docs/foundry/transforms-python/use-python-libraries/) of your Code Repository environment. Note that `databricks-connect` is only available via PyPI, and is not available through Conda. Alternatively, you can manually add the library under the `pip` requirements block in the `conda_recipe/meta.yaml` file. For example, to install version 16.4 of `databricks-connect`, add:

```yaml
requirements:
  pip:
   - databricks-connect >=16.4.0,<17.0.0
```

## API highlights

The following sections highlight the differences between the Databricks transform API and a regular Python transform. Before using `@databricks`, ensure you have performed the [setup](#setup) steps above.

A Databricks transform uses `transforms.tables.TableInput` and `transforms.tables.TableOutput` parameters to reference the input and output Databricks virtual tables. A `TableInput` can reference a virtual table by file path or RID. A `TableOutput` requires:

1. The file path in Foundry where the virtual table will be created.
2. The [source](/docs/foundry/data-connection/set-up-source/) where the virtual table will be registered.
3. The location in Databricks where the table will be written. This can be specified using `DatabricksTable("<catalog>", "<schema>", "<table>")` or `"<catalog>.<schema>.<table>"` syntax. `catalog`, `schema` and `table` correspond to the three-level namespace structure of a table identifier in Unity Catalog. Refer to the [official Databricks documentation ↗](https://docs.databricks.com/aws/en/database-objects/) for more information.

The API of `DatabricksInput` and `DatabricksOutput` are similar to a regular Python transform. `.dataframe()` loads the input table as a `pyspark.sql.DataFrame`. `.write_dataframe()` writes a `pyspark.sql.DataFrame` to the output table. The transform logic itself can be expressed using PySpark transformation.

:::callout{theme="warning"}
Not all features of PySpark are supported in Databricks Connect. Refer to the [official Databricks documentation ↗](https://docs.databricks.com/aws/en/dev-tools/databricks-connect/python/limitations) for details on feature availability and limitations.
:::

### Output table types

You can write output tables in Databricks using one of the following table types:

* **Managed Delta:** Table stored in Delta Lake format in Databricks-managed storage.
* **External Delta:** Table stored in Delta Lake format in an external storage location.
* **Managed Iceberg:** Table stored in Iceberg format in Databricks-managed storage.

You can use the `format` and `location` parameters on `DatabricksTable` or `write_dataframe` to configure the output table type. If `format` and `location` are not specified the table will be written as a managed Delta table (the default table type in Databricks). Use `format="iceberg"` to write the output as a managed Iceberg table. Use `location="<STORAGE_LOCATION>"` to write the output as an external Delta table, where `<STORAGE_LOCATION>` refers to an external storage path in cloud object storage where the table will be stored.

The example below shows a transform writing to three output tables of different types.

```python
from transforms.tables import (
    databricks,
    DatabricksTable,
    DatabricksInput,
    DatabricksOutput,
    TableInput,
    TableOutput,
)

@transform.databricks.using(
    source_table=TableInput('/Project/folder/input'),
    managed_delta_output_table=TableOutput(
        '/Project/folder/output',
        "ri.magritte..source.1234",
       "CATALOG.SCHEMA.MANAGED_DELTA_TABLE",
    ),
    managed_iceberg_output_table=TableOutput(
        '/Project/folder/output',
        "ri.magritte..source.1234",
       "CATALOG.SCHEMA.MANAGED_ICEBERG_TABLE",
    ),
    external_delta_output_table=TableOutput(
        '/Project/folder/output',
        "ri.magritte..source.1234",
        DatabricksTable(
            catalog="CATALOG",
            schema="SCHEMA",
            table="EXTERNAL_DELTA_TABLE",
            location="s3://some-bucket/path/to/table"
        ),
    ),
)
def compute(
    source_table: DatabricksInput,
    managed_delta_output_table: DatabricksOutput,
    managed_iceberg_output_table: DatabricksOutput,
    external_delta_output_table: DatabricksOutput,
):
    df = source_table.dataframe()

    # write to a managed Delta table
    managed_delta_output_table.write_dataframe(df)

    # write to a managed Iceberg table by specifying the format option inline
    managed_iceberg_output_table.write_dataframe(df, format="iceberg")

    # write to an external table where the location has been specified in the DatabricksTable
    external_delta_output_table.write_dataframe(df)
```

Refer to the [official Databricks documentation ↗](https://docs.databricks.com/aws/en/tables) for more information on tables types.

### Compute configuration

By default, a Databricks Connect session will be established using serverless compute. This is equivalent to using `@databricks(serverless=True)`.

Alternatively, you can use `with_compute(cluster_id="<cluster-id>")` to configure a connection to a specific compute cluster.

For information on compute configuration for Databricks Connect, review the [official Databricks documentation ↗](https://docs.databricks.com/aws/en/dev-tools/databricks-connect/cluster-config).

### User-defined functions (UDFs)

[User-defined functions (UDFs)](/docs/foundry/transforms-python-spark/pyspark-udfs/) are supported in Databricks Connect. When you execute a PySpark DataFrame operation that includes UDFs, Databricks Connect serializes the UDF and sends it to the server as part of the request. For full details on UDF features and limitations, refer to the [official Databricks documentation ↗](https://docs.databricks.com/aws/en/dev-tools/databricks-connect/python/udf).

The example below defines a simple UDF that squares the values in a column:

```python
from pyspark.sql.functions import col, udf
from pyspark.sql.types import IntegerType
from transforms.api import transform
from transforms.tables import (
    databricks,
    DatabricksInput,
    DatabricksOutput,
    TableInput,
    TableOutput,
)


@udf(returnType=IntegerType())
def double(x):
    return x * x


@transform.databricks.using(
    source_table=TableInput('/Project/folder/input'),
    output_table=TableOutput(
        '/Project/folder/output',
        "ri.magritte..source.1234",
       "CATALOG.SCHEMA.TABLE",
    ),
)
def compute(source_table: DatabricksInput, output_table: DatabricksOutput):
    df = source_table.dataframe()
    df = df.withColumn("doubled", double(col("id")))
    output_table.write_dataframe(df)
```

#### Specify Python dependencies for UDFs

Databricks Connect supports specifying Python dependencies required for UDFs. These dependencies are installed on Databricks compute as part of the UDF's Python environment. You can use `with_dependencies(dependencies=["<dependency>"])` to configure additional dependencies to be installed in the UDF environment.

The example below defines a UDF that depends on the `pyjokes` package:

```python
from pyspark.sql.functions import col, udf
from pyspark.sql.types import StringType
from transforms.api import transform
from transforms.tables import databricks, DatabricksOutput, TableOutput


@udf(returnType=StringType())
def get_joke():
    from pyjokes import get_joke
    return get_joke()


@transform.databricks.using(
    output_table=TableOutput(
        '/Project/folder/output',
        "ri.magritte..source.1234",
       "CATALOG.SCHEMA.TABLE",
    ),
).with_dependencies(dependencies=["pyjokes<1"])
def compute(output_table: DatabricksOutput):
    df = output_table.spark_session.range(1, 10)
    df = df.withColumn("jokes", get_joke())
    output_table.write_dataframe(df)
```

:::callout{theme="neutral"}
If you encounter an error such as `ModuleNotFoundError: No module named 'myproject'`, it usually means your UDF is referencing code that exists only in your local environment and is not available to the Databricks Spark workers executing the UDF. To avoid this error, ensure that your UDF does not directly depend on functions or classes defined in local modules. You can resolve this in one of the following ways:

* **Inline the necessary logic** directly within the UDF definition.
* **Define both the UDF and its supporting code** within the body of the `@transform` function.
* **Wrap the UDF and its supporting code in a function** that returns a reference to the UDF, and call this function within the transform to create the UDF.
:::
