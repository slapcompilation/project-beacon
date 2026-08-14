<!-- source: https://palantir.com/docs/foundry/transforms-python/tables-snowflake/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Snowflake compute pushdown

To use compute pushdown with Snowflake, create a [Python repository](/docs/foundry/transforms-python/overview/) and install the most recent version of the `transforms-tables` library.

A [Snowpark ↗](https://www.snowflake.com/en/data-cloud/snowpark/) session will be configured based on the connection details of the Snowflake tables configured as inputs and/or outputs to the transforms. Data can be transformed using the Snowpark DataFrame API. For complete guidance on the Snowpark API, consult the [Snowpark documentation ↗](https://docs.snowflake.com/en/developer-guide/snowpark/index).

:::callout{theme="neutral"}
Note the use of Foundry lightweight API syntax rather than Foundry Spark syntax.
:::

An example of a Snowpark transform is shown below:

```python
from snowflake.snowpark.functions import col, udf
from snowflake.snowpark.types import StringType
import snowflake.snowpark as snow
from transforms.api import transform
from transforms.tables import (
    SnowflakeTable,
    TableInput,
    TableOutput,
    SnowflakeInput,
    SnowflakeOutput,
)

ID_PREFIX = "CUSTOMER-NO-"


@transform.snowflake.using(
    input_table=TableInput("ri.tables.main.table.1234"),
    output_table=TableOutput(
        "ri.tables.main.table.5678",
        "ri.magritte..source.1234",
        SnowflakeTable("DATABASE", "PUBLIC", "CUSTOMERS_CLEANED"),
    ),
)
def compute_in_snowflake(input_table: SnowflakeInput, output_table: SnowflakeOutput):
    """
    With Snowflake tables, you can perform lightweight transforms using the Snowpark APIs. All compute for these
    is pushed down to the underlying Snowflake instance, so this can tackle big data workloads. In a set up like this,
    all data must live in the same Snowpark instance and be accessible through the same connection.
    """
    # Get a Snowpark DataFrame instance
    df: snow.DataFrame = input_table.dataframe()
    session: snow.Session = df.session

    # Define a UDF to apply to our data
    @udf(session=session, return_type=StringType())
    def fix_id_col(ident: int) -> str:
        """
        UDF to convert ID to string and prepend "CUSTOMER-NO-".
        """
        return ID_PREFIX + str(ident)

    # Apply UDF
    df = df.with_column("ID", fix_id_col(col("ID")))

    # Write back to the new table
    output_table.write(df)
```

## Compute configuration

By default, Foundry uses the warehouse you configure on the source to allocate compute resources.

Alternatively, you can use `.with_warehouse(warehouse="MY_WAREHOUSE")` to configure a connection with a specific warehouse:

```python
from transforms.api import transform
from transforms.tables import (
    SnowflakeTable,
    TableInput,
    TableOutput,
    SnowflakeInput,
    SnowflakeOutput,
)

# Transform with custom warehouse configuration
@transform.snowflake(
    source_table=TableInput(
        "ri.tables.main.table.my_snowflake_input_table"
    ),
    output_table=TableOutput(
        "ri.tables.main.table.my_snowflake_output_table",
        "ri.magritte..source.my_snowflake_source",
        SnowflakeTable("MY_DATABASE", "PUBLIC", "MY_TABLE"),
    ),
).with_warehouse("my_warehouse")
def compute(source_table: SnowflakeInput, output_table: SnowflakeOutput):
    df: snow.DataFrame = source_table.dataframe()
    output_table.write(df)
```

## Use PySpark API with Spark Connect

As an alternative to Snowpark, you can use `.with_engine(engine="pyspark")` to establish a Snowpark Connect session. This will enable the use of PySpark APIs through Spark Connect. See [Snowpark Connect ↗](https://docs.snowflake.com/en/developer-guide/snowpark-connect/snowpark-connect-overview) for more information.

```python
from pyspark.sql.connect.dataframe import DataFrame
from pyspark.sql.connect.functions import lit
from pyspark.sql.connect.session import SparkSession
from transforms.api import transform
from transforms.tables import (
    TableInput,
    TableOutput,
    SnowparkConnectInput,
    SnowparkConnectOutput,
    SnowflakeTable
)

@transform.snowflake.using(
    input_table=TableInput("ri.tables.main.table.1234"),
    output_table=TableOutput(
        "ri.tables.main.table.5678",
        "ri.magritte..source.1234",
        SnowflakeTable("DATABASE", "PUBLIC", "CUSTOMERS_CLEANED_ANON"),
    ),
).with_engine("pyspark")
def compute(source_table: SnowparkConnectInput, output_table: SnowparkConnectOutput):
    # This will be a Spark Connect Dataframe instead of Snowpark
    df: DataFrame = source_table.dataframe()
    # Similarly this will be a Spark Connect session
    session: SparkSession = source_table.session

    df = df.withColumn("test", lit(3))
    output_table.write_dataframe(df)

```

## Convert data into a pandas DataFrame

The Snowpark API allows data to be converted into a pandas DataFrame. If the scale of your data is small enough, this can be used to bring the data from Snowflake into Foundry lightweight compute. This enables the use of transforms beyond the capabilities of the Snowpark APIs, and allows Snowflake tables to be combined with other Foundry data.

```python
import hashlib
from transforms.api import transform
from transforms.tables import (
    SnowflakeTable,
    TableInput,
    TableOutput,
    SnowflakeInput,
    SnowflakeOutput,
)


@transform.snowflake.using(
    input_table=TableInput("ri.tables.main.table.1234"),
    output_table=TableOutput(
        "ri.tables.main.table.5678",
        "ri.magritte..source.1234",
        SnowflakeTable("DATABASE", "PUBLIC", "CUSTOMERS_CLEANED_ANON"),
    ),
)
def compute_local(input_table: SnowflakeInput, output_table: SnowflakeOutput):
    """
    Snowpark also supports conversion to pandas DataFrames, meaning that you can use lightweight
    transforms on top of Snowflake tables to conduct in-container compute work. You can use
    this to go beyond the scope of what is supported in Snowpark.
    """
    # Get a Snowpark DataFrame instance
    df = input_table.dataframe()
    session = df.session

    # Convert to pandas
    pd_df = df.to_pandas()

    # Create ANON_CODE by hashing the concatenation of CITY, STATE, and ZIP_CODE
    def generate_anon_code(row):
        concatenated = f"{row['CITY']}{row['STATE']}{row['ZIP_CODE']}"
        return hashlib.sha256(concatenated.encode("utf-8")).hexdigest()

    # Apply the function to create the ANON_CODE column
    pd_df["ANON_CODE"] = pd_df.apply(generate_anon_code, axis=1)

    # Select the ID and ANON_CODE columns
    result_data = pd_df[["ID", "ANON_CODE"]]

    # Write back to the new table
    new_df = session.create_dataframe(result_data, schema=["ID", "ANON_CODE"])
    output_table.write(new_df)
```

:::callout{theme="neutral"}
Incremental computation using the `@incremental` decorator is not currently supported when using compute pushdown to Snowflake.
:::
