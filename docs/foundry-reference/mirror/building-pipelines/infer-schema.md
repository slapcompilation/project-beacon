<!-- source: https://palantir.com/docs/foundry/building-pipelines/infer-schema/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Infer a schema for CSV or JSON files

It's easiest to work with datasets in Foundry if they have a schema. Foundry allows you to manually add a schema to datasets containing CSV or JSON files by selecting the  **Apply a schema** button in the dataset. The **Apply a schema** button will automatically infer the schema based on a subset of the data. Once a schema is applied, select **Edit schema** in the dataset view to modify column types or apply additional parsing options to drop jagged rows, change encoding, or add additional columns like file path, byte offset for row, import timestamp, or row number.

Schemas applied statically based on the initial dataset's files can become out of date if data changes. Thus, it can be helpful to have Spark dynamically infer a schema as the first step of a transforms pipeline on semi-structured data.

Note that inferring a schema dynamically on each pipeline build has a performance cost, so this technique should only be used sparingly (for instance, when the schema may change).

Below are examples for CSV and JSON inputs.

:::callout{theme="neutral"}
Parquet, the default output file format for Transforms, does not allow certain special characters that may be present in an automatically-inferred schema. Therefore, we recommend that you use `sanitize_schema_for_parquet` as in the examples below to prevent potential issues.
:::

:::callout{theme="neutral"}
Other than dynamic schema inference, there are many other use-cases for reading all or a subset of dataset files with [SparkSession.read ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.SparkSession.read.html) as in the examples below. If your use-case is one that does not actually need the dynamic schema inference behavior, you should disable it either by setting `inferSchema` to `False` (which will result in all columns being strings) or by leaving that option out and [explicitly passing a schema ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrameReader.schema.html#pyspark.sql.DataFrameReader.schema). Disabling automatic schema inference will result in significantly better performance and consistency especially for incremental pipelines where different schema inference results between incremental batches can be problematic.
:::

### CSV

```python
from transforms.api import transform, Input, Output
from transforms.verbs.dataframes import sanitize_schema_for_parquet

@transform(
    output=Output("/Company/sourceA/parsed/data"),
    raw=Input("/Company/sourceA/raw/data_csv"),
)
def read_csv(ctx, raw, output):
    filesystem = raw.filesystem()
    hadoop_path = filesystem.hadoop_path
    files = [f"{hadoop_path}/{f.path}" for f in filesystem.ls()]
    df = (
        ctx
        .spark_session
        .read
        .option("encoding", "UTF-8")  # UTF-8 is the default
        .option("header", True)
        .option("inferSchema", True)
        .csv(files)
    )
    output.write_dataframe(sanitize_schema_for_parquet(df))
```

### JSON

```python
from transforms.api import transform, Input, Output
from transforms.verbs.dataframes import sanitize_schema_for_parquet

@transform(
    output=Output("/Company/sourceA/parsed/data"),
    raw=Input("/Company/sourceA/raw/data_json"),
)
def read_json(ctx, raw, output):
    filesystem = raw.filesystem()
    hadoop_path = filesystem.hadoop_path
    files = [f"{hadoop_path}/{f.path}" for f in filesystem.ls()]
    df = (
        ctx
        .spark_session
        .read
        .option("multiline", False)  # False is the default; use True if each file contains a single JSON object instead of newline-delimited JSON objects
        .json(files)
    )
    output.write_dataframe(sanitize_schema_for_parquet(df))
```
