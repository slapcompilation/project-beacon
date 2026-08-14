<!-- source: https://palantir.com/docs/foundry/transforms-python/unstructured-files/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Read and write unstructured files

:::callout{theme="warning" title="Warning"}
Unstructured file access is an advanced topic. Ensure you are familiar with the rest of the content in this user guide before reading this page.
:::

You may want to access files in a data transformation for a variety of reasons. File access is particularly useful if you want to process files in non-tabular formats (such as `XML` or `JSON`) or compressed formats (such as `gz` or `zip`).

The `transforms` Python library allows users to read and write files in Foundry datasets. `transforms.api.TransformInput` exposes a read-only FileSystem object while `transforms.api.TransformOutput` exposes a write-only FileSystem object. These `FileSystem` objects allow file access based on the path of a file within the Foundry dataset, abstracting away the underlying storage.

:::callout{theme="neutral"}
If you want to have access to files in your data transformation, you must construct your `Transform` object using the `transform()` decorator. This is because FileSystem objects are exposed by `TransformInput` and `TransformOutput` objects. `transform()` is the only decorator that expects the input(s) and output(s) to its compute function to be of type `TransformInput` and `TransformOutput`, respectively.
:::

## Import files

Files can be uploaded into Foundry using manual file imports or synced via a [data connection](/docs/foundry/data-connection/overview/). Structured and unstructured files can be imported into Foundry datasets to be processed in downstream applications. Files can also be uploaded as a raw file without modifying the extension. The examples below refer to files uploaded as Foundry datasets, rather than as raw files.

Foundry also has functionality to automatically infer a schema for certain file types uploaded to a dataset. For example, when importing a file of `CSV` type, the `Apply a schema` button is available to automatically apply a schema. Learn more about [manually uploading data](/docs/foundry/compass/manually-upload-data/).

## Browse files

Files in a dataset can be listed using the `transforms.api.FileSystem.ls()` method. This method returns a generator of `transforms.api.FileStatus` objects. These objects capture the path, size (in bytes), and modified timestamp (milliseconds since Unix epoch) for each file. Consider the following `Transform` object:

```python tab="Polars"
from transforms.api import transform, Input, Output

@transform.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_eye_color(hair_eye_color, processed):
    # type: (TransformInput, TransformOutput) -> None
    # your data transformation code
    pass
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output

@transform.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_eye_color(ctx, hair_eye_color, processed):
    # your data transformation code
    pass
```

```python tab="Pandas"
from transforms.api import transform, Input, Output

@transform.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_eye_color(hair_eye_color, processed):
    # type: (TransformInput, TransformOutput) -> None
    # your data transformation code
    pass
```

```python tab="PySpark"
from transforms.api import transform, Input, Output

@transform.spark.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_eye_color(hair_eye_color, processed):
    # type: (TransformInput, TransformOutput) -> None
    # your data transformation code
    pass
```

In your data transformation code, you can browse your dataset files:

```python
list(hair_eye_color.filesystem().ls())
# Result: [FileStatus(path='students.csv', size=688, modified=...)]
```

It is also possible to filter the results of the `ls()` call by passing either a glob or a regex pattern:

```python
list(hair_eye_color.filesystem().ls(glob='*.csv'))
# Result: [FileStatus(path='students.csv', size=688, modified=...)]

list(hair_eye_color.filesystem().ls(regex='[A-Z]*\.csv'))
# Result: []
```

## Read files

Files can be opened using the `transforms.api.FileSystem.open()` method. This returns a Python file-like stream object. All options accepted by [`io.open()` ↗](https://docs.python.org/3/library/io.html#io.open) are also supported. Note that files are read as streams meaning that random access is not supported.

:::callout{theme="neutral"}
The file-like stream object returned by the `open()` method does not support the `seek` or `tell` methods. Thus, random access is not supported.
:::

Consider the following `Transform` object:

```python tab="Polars"
from transforms.api import transform, Input, Output

@transform.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_eye_color(hair_eye_color, processed):
    # type: (TransformInput, TransformOutput) -> None
    # your data transformation code
    pass
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output

@transform.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_eye_color(ctx, hair_eye_color, processed):
    # your data transformation code
    pass
```

```python tab="Pandas"
from transforms.api import transform, Input, Output

@transform.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_eye_color(hair_eye_color, processed):
    # type: (TransformInput, TransformOutput) -> None
    # your data transformation code
    pass
```

```python tab="PySpark"
from transforms.api import transform, Input, Output

@transform.spark.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_eye_color(hair_eye_color, processed):
    # type: (TransformInput, TransformOutput) -> None
    # your data transformation code
    pass
```

In your data transformation code, you can read your dataset files as shown below:

```python
with hair_eye_color.filesystem().open('students.csv') as f:
   f.readline()

# Result: 'id,hair,eye,sex\n'
```

The stream can also be passed into parsing libraries. For instance, we can parse a CSV file.

```python
import csv
with hair_eye_color.filesystem().open('students.csv') as f:
    reader = csv.reader(f, delimiter=',')
    next(reader)

# Result: ['id', 'hair', 'eye', 'sex']
```

As mentioned earlier, you can also process files in non-tabular formats such as `XML` or `JSON`, or compressed formats such as `gz` or `zip`. For instance, you can read the CSV files in a zipped file and return their contents as a DataFrame with the code below:

```python tab="Polars"
from transforms.api import Input, Output, transform

import polars as pl
import zipfile


@transform.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def read_zip(hair_eye_color, processed):
    fs = hair_eye_color.filesystem()

    def process_zip_file(file_path):
        with fs.open(file_path, "rb") as f:
            with zipfile.ZipFile(f) as archive:
                for filename in archive.namelist():
                    # Skip directory entries
                    if filename.endswith("/"):
                        continue
                    with archive.open(filename) as f2:
                        df = pl.read_csv(f2, has_header=True)
                        yield df

    all_dfs = []
    for file_status in fs.ls():
        for df in process_zip_file(file_status.path):
            all_dfs.append(df)
    # Concatenate all DataFrames
    final_df = pl.concat(all_dfs, how="vertical")
    processed.write_table(final_df)
```

```python tab="DuckDB"
from transforms.api import Input, Output, transform

import zipfile
import tempfile


@transform.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def read_zip(ctx, hair_eye_color, processed):
    fs = hair_eye_color.filesystem()
    conn = ctx.duckdb().conn

    def process_zip_file(file_path):
        with fs.open(file_path, "rb") as f:
            with zipfile.ZipFile(f) as archive:
                for filename in archive.namelist():
                    # Skip directory entries
                    if filename.endswith("/"):
                        continue
                    with archive.open(filename) as f2:
                        # Write to temporary file for DuckDB to read
                        with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix='.csv') as tmp:
                            tmp.write(f2.read())
                            tmp.flush()
                            df = conn.sql(f"SELECT * FROM read_csv('{tmp.name}', header=true)")
                            yield df

    all_queries = []
    for file_status in fs.ls():
        for df in process_zip_file(file_status.path):
            all_queries.append(df)

    # Union all queries
    if all_queries:
        union_query = ' UNION ALL '.join([f'({query.query})' for query in all_queries])
        final_result = conn.sql(union_query)
        processed.write_table(final_result)
```

```python tab="Pandas"
from transforms.api import Input, Output, transform

import zipfile
import pandas as pd


@transform.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def read_zip(hair_eye_color, processed):
    fs = hair_eye_color.filesystem()

    def process_zip_file(file_path):
        with fs.open(file_path, "rb") as f:
            with zipfile.ZipFile(f) as archive:
                for filename in archive.namelist():
                    # Skip directory entries
                    if filename.endswith("/"):
                        continue
                    with archive.open(filename) as f2:
                        df = pd.read_csv(f2, header=0)
                        yield df

    all_dfs = []
    for file_status in fs.ls():
        for df in process_zip_file(file_status.path):
            all_dfs.append(df)

    # Concatenate all DataFrames
    final_df = pd.concat(all_dfs, axis=0, ignore_index=True)
    processed.write_table(final_df)
```

```python tab="PySpark"
from transforms.api import transform, Input, Output

import tempfile
import shutil
import zipfile
import io

@transform.spark.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def read_zip(hair_eye_color, processed):
    fs = hair_eye_color.filesystem()
    def process_file(file_status):
        with fs.open(file_status.path, 'rb') as f:
            with tempfile.NamedTemporaryFile() as tmp:
                shutil.copyfileobj(f, tmp)
                tmp.flush()
                with zipfile.ZipFile(tmp) as archive:
                    for filename in archive.namelist():
                        # Skip directory entries
                        if filename.endswith("/"):
                            continue
                        with archive.open(filename) as f2:
                            br = io.BufferedReader(f2)
                            tw = io.TextIOWrapper(br)
                            tw.readline() # Skip the first line of each CSV
                            for line in tw:
                                yield Row(*line.split(","))
    rdd = fs.files().rdd
    rdd = rdd.flatMap(process_file)
    df = rdd.toDF()
    processed.write_dataframe(df)
```

### Random access

:::callout{theme="warning" title="Warning"}
Using random access leads to significant performance degradation. We recommend rewriting your code so that it does not rely on the `seek` method. If you still want to use random access, refer below for information on how to do so.
:::

Since the `open()` method returns stream objects, random access is not supported. If you need to have random access, you can buffer the file into memory or onto disk. Assuming `hair_eye_color` corresponds to a `TransformInput` object, here are some examples:

```python
import io
import shutil
s = io.StringIO()
with hair_eye_color.filesystem().open('students.csv') as f:
    shutil.copyfileobj(f, s)
s.getvalue()

# Result: 'id,hair,eye,sex\n...'
```

```python
with hair_eye_color.filesystem().open('students.csv') as f:
    lines = f.read().splitlines()
lines[0]

# Result: 'id,hair,eye,sex'
```

```python
import tempfile
with tempfile.NamedTemporaryFile() as tmp:
    with hair_eye_color.filesystem().open('students.csv', 'rb') as f:
        shutil.copyfileobj(f, tmp)
        tmp.flush()  # shutil.copyfileobj does not flush
    with open(tmp.name) as t:
        t.readline()

# Result: 'id,hair,eye,sex\n'
```

## Write files

Files are written in a similar way using the `open()` method. This returns a Python file-like stream object that can only be written to. All keyword arguments accepted by [`io.open()` ↗](https://docs.python.org/3/library/io.html#io.open) are also supported. Note that files are written as streams meaning that random access is not supported. Consider the following `Transform` object:

```python
from transforms.api import transform, Input, Output

@transform.spark.using(
    hair_eye_color=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def filter_eye_color(hair_eye_color, processed):
    # type: (TransformInput, TransformOutput) -> None
    # your data transformation code
    pass
```

It is possible to write to an output filesystem in your data transformation code. For example, you can generate and write to CSV files as shown in the example below:

```python tab="Polars"
from transforms.api import transform, Input, Output
import polars as pl


@transform.using(
    processed=Output("/examples/csv_files"),
)
def compute(processed):
    with processed.filesystem().open("csv1.csv", "wb") as f1:
        df1 = pl.DataFrame(
            {
                "student_id": ["001", "002", "003"],
                "hair_color": ["brown", "blonde", "black"],
                "eye_color": ["blue", "green", "brown"],
            }
        )
        df1.write_csv(f1)
    with processed.filesystem().open("csv2.csv", "wb") as f2:
        df2 = pl.DataFrame(
            {
                "student_id": ["004", "005", "006"],
                "hair_color": ["red", "green", "blue"],
                "eye_color": ["purple", "grey", "black"],
            }
        )
        df2.write_csv(f2)
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output
import tempfile


@transform.using(
    processed=Output("/examples/csv_files"),
)
def compute(ctx, processed):
    conn = ctx.duckdb().conn

    # Create first CSV file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp1:
        conn.execute(f"""COPY (
            SELECT * FROM VALUES
            ('001', 'brown', 'blue'),
            ('002', 'blonde', 'green'),
            ('003', 'black', 'brown')
            AS t(student_id, hair_color, eye_color)
        ) TO '{tmp1.name}' (HEADER)""")

        with open(tmp1.name, 'r') as src:
            with processed.filesystem().open("csv1.csv", "w") as f1:
                f1.write(src.read())

    # Create second CSV file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as tmp2:
        conn.execute(f"""COPY (
            SELECT * FROM VALUES
            ('004', 'red', 'purple'),
            ('005', 'green', 'grey'),
            ('006', 'blue', 'black')
            AS t(student_id, hair_color, eye_color)
        ) TO '{tmp2.name}' (HEADER)""")

        with open(tmp2.name, 'r') as src:
            with processed.filesystem().open("csv2.csv", "w") as f2:
                f2.write(src.read())
```

```python tab="Pandas"
from transforms.api import transform, Input, Output
import pandas as pd


@transform.using(
    processed=Output("/examples/csv_files"),
)
def compute(processed):
    with processed.filesystem().open("csv1.csv", "w") as f1:
        df1 = pd.DataFrame(
            {
                "student_id": ["001", "002", "003"],
                "hair_color": ["brown", "blonde", "black"],
                "eye_color": ["blue", "green", "brown"],
            }
        )
        df1.to_csv(f1)
    with processed.filesystem().open("csv2.csv", "w") as f2:
        df2 = pd.DataFrame(
            {
                "student_id": ["004", "005", "006"],
                "hair_color": ["red", "green", "blue"],
                "eye_color": ["purple", "grey", "black"],
            }
        )
        df2.to_csv(f2)
```

In the following example, you can persist a model using the `pickle` module, the built-in Python serializer:

```python
import pickle

with processed.filesystem().open('model.pickle', 'wb') as f:
    pickle.dump(model, f)
```

## Parallelized processing

You can parallelize file processing by manually operating in multiple processes.

```python tab="Polars"
from transforms.api import transform, Input, Output
import polars as pl
from concurrent.futures import ThreadPoolExecutor

@transform.using(
    processed=Output("/Mint/Transforms/lightweight/abort/out"),
    hair_eye_color=Input("/Mint/Transforms/lightweight/abort/csvs"),
)
def example_computation(hair_eye_color, processed):
    fs = hair_eye_color.filesystem()
    # Step 1: List all CSV files
    csv_files = list(fs.ls(glob="*.csv"))

    # Step 2: Function to process a single file
    def process_file(dataset_file):
        path = dataset_file.path
        with fs.open(path) as csv_file:
            # Read CSV as Polars DataFrame
            df = pl.read_csv(csv_file)
            # Optionally, select or rename columns to match schema
            return df.select(["student_id", "hair_color", "eye_color"])

    # Step 3: Process files in parallel
    with ThreadPoolExecutor() as executor:
        dfs = list(executor.map(process_file, csv_files))

    # Step 4: Concatenate all DataFrames
    result_df = pl.concat(dfs)
    processed.write_table(result_df)
```

```python tab="DuckDB"
from transforms.api import transform, Input, Output
import io
from concurrent.futures import ThreadPoolExecutor

@transform.using(
    processed=Output('/examples/hair_eye_color_processed'),
    hair_eye_color=Input('/examples/students_hair_eye_color_csv'),
)
def example_computation(ctx, hair_eye_color, processed):
    fs = hair_eye_color.filesystem()
    conn = ctx.duckdb().conn

    # Step 1: List all CSV files
    csv_files = list(fs.ls(glob="*.csv"))

    # Step 2: Function to process a single file
    def process_file(dataset_file):
        path = dataset_file.path
        with fs.open(path) as csv_file:
            # Read CSV content into memory
            csv_content = csv_file.read()
            df = conn.sql("SELECT student_id, hair_color, eye_color FROM read_csv_auto($1)", [csv_content])
            return df.fetchdf()

    # Step 3: Process files in parallel
    with ThreadPoolExecutor() as executor:
        dfs = list(executor.map(process_file, csv_files))

    # Step 4: Concatenate all DataFrames using DuckDB
    if dfs:
        # Create temporary table from first DataFrame
        conn.register('temp_result', dfs[0])
        result_query = conn.sql("SELECT * FROM temp_result")

        # Union with remaining DataFrames
        for i, df in enumerate(dfs[1:], 1):
            conn.register(f'temp_{i}', df)
            result_query = conn.sql(f"SELECT * FROM ({result_query.query}) UNION ALL SELECT * FROM temp_{i}")

        processed.write_table(result_query)
```

```python tab="Pandas"
from transforms.api import transform, Input, Output
import pandas as pd
from concurrent.futures import ThreadPoolExecutor

@transform.using(
    processed=Output('/examples/hair_eye_color_processed'),
    hair_eye_color=Input('/examples/students_hair_eye_color_csv'),
)
def example_computation(hair_eye_color, processed):
    fs = hair_eye_color.filesystem()

    # Step 1: List all CSV files
    csv_files = list(fs.ls(glob="*.csv"))

    # Step 2: Function to process a single file
    def process_file(dataset_file):
        path = dataset_file.path
        with fs.open(path) as csv_file:
            # Read CSV as pandas DataFrame
            df = pd.read_csv(csv_file)
            # Optionally, select or rename columns to match schema
            return df[["student_id", "hair_color", "eye_color"]]

    # Step 3: Process files in parallel
    with ThreadPoolExecutor() as executor:
        dfs = list(executor.map(process_file, csv_files))

    # Step 4: Concatenate all DataFrames and write out
    result_df = pd.concat(dfs, ignore_index=True)
    processed.write_table(result_df)
```

## Parallelized processing with PySpark

Unlike data transformations expressed in terms of [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) objects, or defined using standard non-Spark transforms, it is important to understand the difference between driver and executor code with file-based transformations in PySpark. The compute function is executed on the driver, which is a single machine. Spark automatically distributes [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) functions to the executors (many machines) as it sees fit.

To benefit from distributed processing with the files API, we have to leverage Spark to distribute the computation. To do so, we create a [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) of `FileStatus` and distribute this across our executors. Each task on the executor can then open the file that it has been assigned and process it with the results being aggregated by Spark.

The files API exposes the `files()` function that accepts the same arguments as the `ls()` function but, instead, returns a [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) of `FileStatus` objects. This DataFrame is partitioned by file size to help balance the computation when file sizes vary. The partitioning can be controlled using two Spark configuration options:

* [spark.sql.files.maxPartitionBytes ↗](https://spark.apache.org/docs/latest/configuration.html#execution-behavior) is the maximum number of bytes to pack into a single partition when reading files.

* [spark.sql.files.openCostInBytes ↗](https://spark.apache.org/docs/latest/configuration.html#execution-behavior) is the estimated cost to open a file, measured by the number of bytes that could be scanned in the same time. This is added to the file size to calculate the total number of bytes used by the file in the partition.

To modify the values for these properties, you must create a custom Transforms profile and apply it to your Transform using the `configure()` decorator. For more information, refer to the section on defining Transforms profiles in the Code Repositories documentation.
Now, let’s step through an example. Say we have CSV files that we want to parse and concatenate. We make use of [`flatMap()` ↗](https://spark.apache.org/docs/latest/api/python/reference/api/pyspark.RDD.flatMap.html) to apply a processing function to each `FileStatus` object. This processing function must yield rows according to [`pyspark.sql.SparkSession.createDataFrame()` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.SparkSession.createDataFrame.html).

```python tab="PySpark"
import csv
from pyspark.sql import Row
from pyspark.sql.types import StructType, StructField, StringType
from transforms.api import transform, Input, Output

@transform.spark.using(
    processed=Output('/examples/hair_eye_color_processed'),
    hair_eye_color=Input('/examples/students_hair_eye_color_csv'),
)
def example_computation(hair_eye_color, processed):
    def process_file(file_status):
        with hair_eye_color.filesystem().open(file_status.path) as f:
            r = csv.reader(f)
            # Construct a pyspark.Row from our header row
            header = next(r)
            MyRow = Row(*header)
            for row in r:
                yield MyRow(*row)

    schema = StructType([
        StructField('student_id', StringType(), True),
        StructField('hair_color', StringType(), True),
        StructField('eye_color', StringType(), True),
    ])

    files_df = hair_eye_color.filesystem().files('**/*.csv')
    processed_df = files_df.rdd.flatMap(process_file).toDF(schema)
    processed.write_dataframe(processed_df)
```

:::callout{theme="warning" title="Warning"}
Although it is possible to call `toDF()` without passing a schema, if your file processing returns zero rows then Spark’s schema inference will fail throwing a `ValueError: RDD is empty` exception. We therefore recommend you always manually specify a schema.
:::
