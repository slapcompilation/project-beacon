<!-- source: https://palantir.com/docs/foundry/code-workbook/workbooks-languages/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Languages

## Supported languages and versions

Code Workbook currently supports three languages: Python, R, and SQL.

The currently supported versions of Python in Code Workbook include Python 3.10 and Python 3.12. Lower versions of Python are not supported, and environments using them will fail to resolve. We strongly recommend using the latest available version of Python, as Palantir Foundry discontinues support for Python versions that are [considered end-of-life ↗](https://devguide.python.org/versions/) by Python Developer documentation.

The currently supported versions of R include R 3.6, R 4.0, R 4.1 and R 4.2. The versions R 3.3, R 3.4, and R 3.5 are not supported, and their respective environments will fail to initialize.

The SQL variant supported in Code Workbook is [Spark SQL ↗](https://spark.apache.org/sql/).

To enable a specific language on a Code Workbook profile, see the Conda Environment section of the [Configuring Code Workbook profiles](/docs/foundry/administration/configure-code-workbook-profiles/#conda-environment) documentation. A series of examples for each of the supported languages are provided below, in the respective introductions to [Python](#introduction-to-python), [R](#introduction-to-r), and [SQL](#introduction-to-python).

### Enable languages in a workbook

Specific configuration is necessary for supported languages to function, as discussed in the sections below.

#### Enable R

:::callout{theme="warning"}
R is not yet available for self-service.
:::

Two things must be true in order to have the ability to create an R transform in Code Workbook:

* The R language must be specifically enabled on your enrollment. Contact your Palantir representative for assistance with enablement.
* The package `vector-spark-module-r` must be present in the environment currently used in the workbook. This can be achieved in either of the following ways:
  * Toggle the **R** checkbox in the profile's configuration in Control Panel. This will automatically add the `vector-spark-module-r` package to the profile's environment.
  * Manually add `vector-spark-module-r` to the environment using the **Add package** dropdown menu.

See [Configuring Code Workbook profiles](/docs/foundry/administration/configure-code-workbook-profiles/#conda-environment) for more information.

#### Enable Python

The package `vector-spark-module-py` must be present in the environment currently in use in the workbook. This can be achieved in either of the following ways:

* Toggle the Python checkbox in the profile's configuration in Control Panel. This will automatically add the `vector-spark-module-py` package to the environment.
* Manually add `vector-spark-module-py` to the environment using the **Add package** dropdown menu.

See [Configuring Code Workbook profiles](/docs/foundry/administration/configure-code-workbook-profiles/#conda-environment) for more information.

#### Enable SQL

SQL transforms do not require any additional packages to function. As a result, SQL transforms will always be available by default for any given profile.

:::callout{theme="success"}
If you do not plan on using either Python or R on a given profile, consider removing the associated `vector-spark-module` package to reduce your environment. You can always add them back when you need them.
:::

## Introduction to Python

### Python transforms

A Python transform is defined as a Python function with any number of inputs, at most one output, and optionally one or more visualizations. By referencing a transform's alias as a function argument, Code Workbook will automatically pass as input of the transform the output of the mentioned alias. For more information about transforms in Code Workbook, consult the [Transforms overview](/docs/foundry/code-workbook/transforms-overview/) documentation.

A simple example of a Python transform could include a single PySpark DataFrame as input, transform the data using PySpark syntax, and have a transformed Spark DataFrame as output.

```python
def child(input_spark_dataframe):
    from pyspark.sql import functions as F
    return input_spark_dataframe.filter(F.col('A') == 'value').withColumn('new_column', F.lit(2))
```

### Conversion between Spark and Pandas in Python

Within a Python transform, converting between Spark and Pandas dataframes is straightforward.

```python
# Convert to PySpark
spark_df = spark.createDataFrame(pandas_df)
# Convert to pandas
pandas_df = spark_df.toPandas()
```

Converting to pandas means collecting data to the driver. As a result, the size of the data is constrained by the available driver memory on the Spark module. If you are working with a large dataset, you may want to first filter and aggregate your data using Spark, then collect it into a pandas DataFrame.

```python
from pyspark.sql import functions as F
def filtering_before_pandas(input_spark_dataframe):
    # Use PySpark to filter the data
    filtered_spark_df = input_spark_dataframe.select("name", "age").filter(F.col("age") <= 18)

    # Convert to a pandas df, which collects the data to the driver
    pandas_df = filtered_spark_df.toPandas()

    # Perform pandas operations
    mean_age = pandas_df["age"].mean()
    pandas_df["age_difference_to_mean"] = pandas_df["age"] - mean_age

    # Output the resulting DataFrame
    return pandas_df
```

:::callout{theme="neutral"}
To keep the order of a sorted pandas DataFrame after saving, save it as a Spark DataFrame with a single partition:

```python
import pyspark.pandas as p

return p.from_pandas(df).to_spark().coalesce(1)
```
:::

## Introduction to R

### R Transforms

An R transform is defined as an R function, with any number of inputs, at most one output, and optionally one or more visualizations. By referencing a transform's alias as a function argument, Code Workbook will automatically pass as input of the transform the output of the mentioned alias. For more information about transforms in Code Workbook, consult the [transforms overview](/docs/foundry/code-workbook/transforms-overview/) documentation.

A simple example of an R transform could include one parent R data.frame, transform the data using R, and have one R data.frame as output.

```r
child <- def(r_dataframe) {
    library(tidyverse)
    new_df <- r_dataframe %>% dplyr::select(col_A, col_B) %>% dplyr::filter(col_A == true) %>% dplyr::mutate(new_column=1000)
    return(new_df)
}
```

### Conversion between Spark and R dataframes

Within an R transform, converting between Spark DataFrames and R data.frame is straightforward:

```r
# Convert from Spark DataFrame to R data.frame
new_r_df <- SparkR::collect(spark_df)

# Convert from R data.frame to Spark DataFrame
 spark_df <- SparkR::as.DataFrame(r_df)
```

Note that converting to an R data.frame means collecting data to the driver. As a result, the size of the data is constrained by the available driver memory on the Spark module. If you are working with a large dataset, you may want to first filter and aggregate your data using Spark, then collect it into an R data.frame.

```r
output_dataset <- function(spark_df) {
    library(tidyverse)

    # Use SparkR to filter the data
    input_dataset_filtered <- SparkR::select(spark_df, 'column_A', 'column_B')

    # Convert to R data.frame
    local_df <- SparkR::collect(input_dataset_filtered)

    # Use tidyverse functions to transform your data
    local_df <- local_df %>% dplyr::filter(column_A == true) %>% dplyr::mutate(new_column = 1000)

    # Output an R data.frame
    return(local_df)
}
```

### R troubleshooting

When an imported dataset in Code Workbook is read in as an R data.frame, the dataset is converted from a Spark DataFrame to an R data.frame by collecting to the driver.

* You will not be able to read in arbitrarily large data as an R data.frame. The size of data is constrained by driver memory on the Spark module. To work with large data, consider first reading in your dataset as a Spark DataFrame, using SparkR to transform the data into something smaller, and then calling `SparkR::collect()` to convert it to an R data.frame. Alternately, use Python or SQL to transform your data into something smaller prior to using R.
* There are some known issues when collecting certain data types to R data.frame. In the majority of cases, when collecting we use a library called [r-arrow ↗](https://arrow.apache.org/docs/r/), which speeds up serialization and deserialization. In particular, when using r-arrow the `Long`, `Array`, `Map`, `Struct`, and `Datetime` types are not convertible. Consider dropping these columns or casting them to other data types (such as `String`). You will receive a warning in the interface when attempting to read an input with these types as an R data.frame.

R in Code Workbook is single-threaded, meaning only one R job can be run at a time on the same Spark module. If you initiate multiple R jobs at the same time, they will run serially; jobs that are queued will appear as "Queueing in Code Workbook."

* If you have a long-running job or jobs where the transforms are saved as datasets, we recommend that you run a batch build. The batch build will run on its own Spark module, allowing you to continue iterating in the same workbook or other workbooks that share the Spark module.

## Introduction to SQL

The SQL variant supported in Code Workbook is [Spark SQL ↗](https://spark.apache.org/sql/). The only supported input and output types are Spark DataFrames.

A simple example of a SQL transform could join two input DataFrames on a join key.

```sql
SELECT table_b.col_A, table_b.col_B, table_a.*
FROM table_a
JOIN table_b ON table_a.col_C == table_B.col_C
```

To add a parent to a SQL node, referencing the alias within the code is not sufficient. You must use the UI by selecting the input bar, or create the child node using the **+** button.
