<!-- source: https://palantir.com/docs/foundry/transforms-python/duckdb/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# DuckDB API

Foundry offers support for streamed, lazy execution using DuckDB, similar to the [Polars lazy API](/docs/foundry/transforms-python/polars-lazy/).

To access a preconfigured DuckDB connection in your transform, use the Context object as shown below:

```python
from transforms.api import transform, Input, Output

@transform.using(
    output=Output("/Users/jsmith/output"),
    my_input=Input("/Users/jsmith/input"),
)
def compute(ctx, output, my_input):
    conn = ctx.duckdb().conn
    query = conn.sql("""SELECT * FROM my_input""")
    output.write_table(query)
```

The DuckDB connection comes preconfigured with all input datasets registered as unmaterialized DuckDB tables, using the input names as table names. This allows easy access to input data without manual configuration.

## When to use DuckDB

DuckDB is a highly performant, efficient query engine which will often outperform other single-node compute engines like Pandas or Polars for many workloads. Consider using DuckDB for:

* Single-node transforms that operate on very large scale data.
* Transforms that need strict control over memory usage.

However, DuckDB does not yet support a Python DataFrame API like Polars or Pandas, instead requiring raw SQL queries for data manipulation. Third party libraries such as Ibis can be used to provide a dataframe API on top of DuckDB, see [Using Ibis with DuckDB](#use-ibis-with-duckdb) below.

## Incremental workflows

Similar to other compute engines, the DuckDB API lets you configure incremental read modes on inputs.

Like with other compute engines, this defaults to `added` when running incrementally, and `current` when running
non-incrementally.

```python
from transforms.api import transform, Input, Output, incremental

@incremental()
@transform.using(
    output=Output("/Users/jsmith/output"),
    my_input=Input("/Users/jsmith/input"),
)
def compute(ctx, output, my_input):
    ddb = ctx.duckdb(read_modes={my_input: "current"})
    result = ddb.conn.sql("""SELECT * FROM my_input""")
    output.write_table(result)

```

## Read from a .sql file

Some DuckDB workflows may involve complex SQL queries that are better managed in separate `.sql` files. You can reference such files using the `sql_from_file` method on the DuckDB connection. The paths are relative to the file containing the call to `sql_from_file`.

```sql
# -- query.sql
SELECT * FROM my_input WHERE column_a > 100;
```

```python
from transforms.api import transform, Input, Output, incremental

@incremental()
@transform.using(
    output=Output("/Users/jsmith/output"),
    my_input=Input("/Users/jsmith/input"),
)
def compute(ctx, output, my_input):
    conn = ctx.duckdb().conn
    query = conn.sql_from_file("query.sql")
    output.write_table(query)
```

## Use Ibis with DuckDB

:::callout{theme="warning"}
Ibis is a third-party dependency unaffiliated with Palantir. Its use in DuckDB transforms comes with no product support guarantees.
:::

[Ibis ↗](https://ibis-project.org/) is a Python library that provides a portable dataframe API that can be used with nearly 20 different backends. DuckDB is supported, providing a dataframe API on its otherwise SQL backend.

To use Ibis, first install `ibis-framework` and `ibis-duckdb` packages in your environment. For details on adding packages to the repository, see the [package tab documentation](/docs/foundry/transforms-python/use-python-libraries/#discover-and-use-python-libraries).

```python
import ibis
from transforms.api import Input, Output, transform, LightweightInput, LightweightOutput, LightweightContext

@transform.using(
    output=Output("/Users/jsmith/output"),
    my_input=Input("/Users/jsmith/input"),
)
def compute(ctx, output, my_input) -> None:
    conn = ctx.duckdb().conn
    ibis_conn = ibis.duckdb.from_connection(conn)
    table = ibis_conn.table("my_input")
    # Ibis dataframe transforms
    sql = ibis.to_sql(table, dialect="duckdb")
    output.write_table(conn.sql(sql))
```

For more details on writing Ibis dataframe transformations, consult the [official Ibis documentation ↗](https://ibis-project.org/reference).

## Use SQLFrame with DuckDB

:::callout{theme="warning"}
SQLFrame is a third-party dependency unaffiliated with Palantir. Its use in DuckDB transforms comes with no product support guarantees.
:::

[SQLFrame ↗](https://github.com/eakmanrq/sqlframe) is a Python library that allows the execution of PySpark DataFrame API code on SQL-based query engines, including DuckDB.

To use SQLFrame, first install the `sqlframe` package in your environment. For details on adding packages to the repository, see the [package tab documentation](/docs/foundry/transforms-python/use-python-libraries/#discover-and-use-python-libraries).

```python
from sqlframe import activate
from transforms.api import Input, Output, transform, LightweightInput, LightweightOutput, LightweightContext

@transform.using(
    output=Output("/Users/jsmith/output"),
    my_input=Input("/Users/jsmith/input"),
)
def compute(ctx, output, my_input) -> None:
    conn = ctx.duckdb().conn

    activate("duckdb", conn=conn)

    from pyspark.sql import SparkSession
    # Other pyspark imports must come after activate

    session = SparkSession.builder.getOrCreate()
    input_df = session.table("my_input")  # inputs are referenced by alias

    # Pyspark dataframe transforms

    sql = result_df.sql(optimize=True, dialect="duckdb")
    output.write_table(conn.sql(sql))
```

For more details on writing SQLFrame dataframe transformations, consult the [official SQLFrame documentation ↗](https://github.com/eakmanrq/sqlframe/tree/main/docs).

### Migrate a Spark transform to DuckDB with SQLFrame

Existing Spark transforms can be refactored to run on DuckDB with SQLFrame. In this section, we will refactor the Spark example below:

```python
from transforms.api import transform, Input, Output
from pyspark.sql import functions as F

@transform.spark.using(
    output=Output("/Users/jsmith/meteorite_enriched"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
    meteorite_stats=Input("/Users/jsmith/meteorite_stats"),
)
def enriched(output, meteorite_landings, meteorite_stats):
    df_landings = meteorite_landings.dataframe()
    df_stats = meteorite_stats.dataframe()

    enriched_together = df_landings.join(df_stats, "class")
    greater_mass = enriched_together.withColumn(
        'greater_mass', F.col("mass") > F.col("avg_mass_per_class")
    )
    result = greater_mass.filter(F.col("greater_mass")).select(
        F.col("name"),
        F.col("class"),
        F.col("mass"),
        F.col("greater_mass")
    )
    output.write_dataframe(result)
```

First, change the decorator to make this a single node transform by default, and add a `LightweightContext` to the compute function.

```diff
- from transforms.api import transform, Input, Output
+ from transforms.api import transform, Input, Output, LightweightContext
+ from sqlframe import activate
  from pyspark.sql import functions as F

- @transform.spark.using(
+ @transform.using(
      output=Output("/Users/jsmith/meteorite_enriched"),
      meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
      meteorite_stats=Input("/Users/jsmith/meteorite_stats"),
  )
- def enriched(output, meteorite_landings, meteorite_stats):
+ def enriched(ctx: LightweightContext, output, meteorite_landings, meteorite_stats):
```

Next, activate SQLFrame with a DuckDB connection and move PySpark imports into the compute function.

```diff
  from transforms.api import transform, Input, Output, LightweightContext
  from sqlframe import activate
- from pyspark.sql import functions as F

  def enriched(ctx: LightweightContext, output, meteorite_landings, meteorite_stats):
+     conn = ctx.duckdb().conn
+     activate("duckdb", conn=conn)
+
+     # Import PySpark AFTER activation
+     from pyspark.sql import SparkSession, functions as F
```

Now, you can generate the input DataFrames from the SQLFrame SparkSession.

```diff
-     df_landings = meteorite_landings.dataframe()
-     df_stats = meteorite_stats.dataframe()
+     df_landings = session.table("meteorite_landings")  # Use alias from decorator
+     df_stats = session.table("meteorite_stats")
```

Finally, convert the result to SQL to be written as output.

```diff
      result = greater_mass.filter("greater_mass")
-     output.write_dataframe(result)
+     sql = result.sql(optimize=True, dialect="duckdb")
+     output.write_table(conn.sql(sql))
```

The complete refactored transform is shown below:

```python
from transforms.api import transform, Input, Output, LightweightContext
from sqlframe import activate

@transform.using(
    output=Output("/Users/jsmith/meteorite_enriched"),
    meteorite_landings=Input("/Users/jsmith/meteorite_landings"),
    meteorite_stats=Input("/Users/jsmith/meteorite_stats"),
)
def enriched(ctx: LightweightContext, output, meteorite_landings, meteorite_stats):
    conn = ctx.duckdb().conn
    activate("duckdb", conn=conn)

    from pyspark.sql import SparkSession, functions as F

    session = SparkSession.builder.getOrCreate()

    df_landings = session.table("meteorite_landings")
    df_stats = session.table("meteorite_stats")

    # PySpark DataFrame transformations work as-is
    enriched_together = df_landings.join(df_stats, "class")
    greater_mass = enriched_together.withColumn(
        'greater_mass', F.col("mass") > F.col("avg_mass_per_class")
    )
    result = greater_mass.filter(F.col("greater_mass")).select(
        F.col("name"),
        F.col("class"),
        F.col("mass"),
        F.col("greater_mass")
    )

    # Convert to SQL and write
    sql = result.sql(optimize=True, dialect="duckdb")
    output.write_table(conn.sql(sql))
```

## DuckDB configuration

Unlike many other single-node compute engines, DuckDB supports resource configuration to control memory usage and parallelism, which allows fine-grained optimization for different workloads. This is especially important for memory-constrained contexts, where DuckDB can self-limit its memory consumption to avoid out-of-memory errors, at the cost of performance.

You can set these options when initializing the DuckDB connection via the `duckdb` method on the Context object. A full list of configuration options can be found in the [official documentation ↗](https://duckdb.org/docs/stable/configuration/overview#configuration-reference).

```python
conn = ctx.duckdb().conn
conn.execute("SET memory_limit='2GB';")
conn.execute("SET threads=4;")
```

## Advanced use cases

Some DuckDB workflows require access to lower level APIs than simple references to input datasets. Examples include

* Custom formatting that require configuration of DuckDB's [read\_parquet ↗](https://duckdb.org/docs/stable/data/parquet/overview#parameters) or [read\_csv ↗](https://duckdb.org/docs/stable/data/csv/overview#parameters) methods
* Custom [write settings ↗](https://duckdb.org/docs/stable/sql/statements/copy#copy--to-options), like partitioning or compression options.

For these use cases, you can read your dataset's raw Parquet or CSV fields with a preconfigured DuckDB UDF called `<input_name>_files()`.
This function returns a list of file paths for the underlying data files of the input dataset, which can then be passed to DuckDB's read functions with custom parameters.

You can then copy your output to an intermediate location on disk, or directly stream the output back to Foundry using DuckDB's `COPY TO` command.

To infer a schema from files that have been manually uploaded with `COPY TO` without calling `write_table`, you can use the `put_metadata()` method on the Output object.

```python
import uuid

from transforms.api import transform, Input, Output

@transform.using(
    output=Output("/Users/jsmith/output"),
    my_input=Input("/Users/jsmith/input"),
)
def compute(ctx, output, my_input):
    conn = ctx.duckdb().conn

    # Write to disk, then upload dataset from disk
    query = conn.sql(f"""
    COPY (
        SELECT *
        FROM read_parquet(my_input_files(), file_row_number=True)
        WHERE my_column = 'abc'
        LIMIT 10
    ) TO '{output.path_for_write_table}'
    (FORMAT 'parquet', PER_THREAD_OUTPUT TRUE)
    """)
    output.write_table(output.path_for_write_table)

    # Directly stream inputs and outputs
    path_uuid = str(uuid.uuid4())
    conn.execute(f"""
        COPY (
            SELECT *
            FROM read_parquet(my_input_files(), file_row_number=True)
            WHERE my_column = 'abc'
            LIMIT 10
        ) TO '{output.path_for_object_store_write_table}'
        (FORMAT PARQUET, PARTITION_BY (date), WRITE_PARTITION_COLUMNS true, FILENAME_PATTERN 'file_{path_uuid}')
        """
    )
    output.put_metadata()
```

### Incremental outputs

Users have direct control over the outputs to their datasets using `COPY TO` syntax, including the file names of the output files. For incremental workflows, users should ensure that sequential writes do not share file names with previous transactions to avoid conflicts and overwrites between files. DuckDB provides the ability to provide a [filename pattern ↗](https://duckdb.org/docs/stable/data/partitioning/partitioned_writes#filename-pattern) for outputs, and users are encouraged to append a UUID to their filenames, per the example above, to ensure uniqueness.

### Partitioned outputs

Note that DuckDB's partitioning behavior differs from defaults in common libraries like Polars or Spark. When writing partitioned datasets, you are strongly encouraged to set `WRITE_PARTITION_COLUMNS` to `true`, as in the example above, to ensure compatibility with other transforms. You should also note that DuckDB uses the string `null` in Hive filepaths for missing values, instead of the Hive standard of `__HIVE_DEFAULT_PARTITION__`, and take special care to ensure that downstream transforms parse these partitions properly, generally by infilling nulls on the partition column before writing outputs with DuckDB.

### Eager download

By default, Foundry's DuckDB integration uses lazy streamed downloading of input datasets to optimize performance and resource usage. However, in some scenarios, users may want to eagerly download all input data to disk at the start of the transform. You can pull to disk and query inputs by calling `path()` on the input:

```python
import duckdb
from transforms.api import transform, Output, Input


@transform.using(my_input=Input('my-input'), my_output=Output('my-output'))
def my_duckdb_transform(my_input, my_output):
    duckdb.connect(database=':memory:').execute(f"""
        COPY
        (
            SELECT *
            FROM parquet_scan('{my_input.path()}/**/*.parquet')
            WHERE Name LIKE 'John%'
        )
        TO '{my_output.path_for_write_table}'
        (FORMAT 'parquet', PER_THREAD_OUTPUT TRUE)
    """)  # Optimize performance by writing a separate Parquet file per thread in parallel

    my_output.write_table(my_output.path_for_write_table)
```
