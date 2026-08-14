<!-- source: https://palantir.com/docs/foundry/optimizing-pipelines/hive-style-partitioning/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Hive-style partitioning

Hive-style partitioning is a method for optimizing the layout of data in a dataset in order to dramatically improve the performance of queries that filter on particular columns. In the context of Foundry Spark-based transforms, hive-style partitioning is performed in the following fashion:

* When writing data to the output dataset, for each partition in the Spark dataframe and each combination of unique values for the specified partition columns, write a separate file to the output dataset.
* For each file written in this way, include the partition column values in the file path.
* In the transaction metadata, record the fact that the dataset is partitioned by the partition columns.

Dataset readers that use compute engines such as Spark or Polars and that filter on these columns can automatically leverage the metadata in the transaction metadata and file paths in order to narrow down the files to read.

Because at least one file is written for each unique combination of partition column values in the data, and writing an excessive amount of files results in poor write and subsequent read performance, hive-style partitioning is not suited for columns with very high cardinality (many unique values and only a few rows for each value).

## Configuration of hive-style partitioning

The below minimal examples show how to configure hive-style partitioning when writing data to the output in Python and Java.

In these examples, we repartition the dataframe using [repartitionByRange ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.repartitionByRange.html) on the partition columns before writing to the output. Repartitioning ensures that the output contains only one file per unique combination of partition column values, rather than one file per unique combination of partition column values *in each input dataframe partition*. Skipping this repartition step can result in an excessive amount of files in the output dataset, causing poor write and read performance.

:::callout{theme="neutral"}
`repartitionByRange` is generally preferred over [repartition ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.repartition.html) in the context of hive-style partitioning because `repartitionByRange` uses sampling to estimate partition ranges that will distribute data as evenly as possible. Conversely, `repartition` uses a hash function modulo by the number of partitions to assign values to dataframe partitions; for columns with low cardinality, this hash-and-modulo operation has a high likelihood of distributing data unevenly, even if the original data is relatively evenly distributed across values. Uneven data distribution (skew) can cause Spark executor out-of-memory errors and job failures.
:::

### Python transforms example of hive-style partitioning

```python
from transforms.api import transform, Input, Output


@transform(
    transform_output=Output("/path/to/output"),
    transform_input=Input("/path/to/input"),
)
def compute(transform_output, transform_input):
    transform_output.write_dataframe(
        transform_input.dataframe().repartitionByRange("record_date", "department"),
        partition_cols=["record_date", "department"],
    )
```

### Java transforms example of hive-style partitioning

```java
package myproject.datasets;

import com.palantir.foundry.spark.api.DatasetFormatSettings;
import com.palantir.transforms.lang.java.api.Compute;
import com.palantir.transforms.lang.java.api.FoundryInput;
import com.palantir.transforms.lang.java.api.FoundryOutput;
import com.palantir.transforms.lang.java.api.Input;
import com.palantir.transforms.lang.java.api.Output;

import static org.apache.spark.sql.functions.col;

public final class HivePartitioningInJava {

    @Compute
    public void myComputeFunction(
            @Input("ri.foundry.main.dataset.e2dd4bcf-7985-461c-9d08-ee0edd734a1a") FoundryInput myInput,
            @Output("ri.foundry.main.dataset.4b62bf9b-3700-40f6-9e85-505eaf87e57d") FoundryOutput myOutput) {
        myOutput.getDataFrameWriter(
                        myInput.asDataFrame().read().repartitionByRange(col("record_date"), col("department")))
                .setFormatSettings(DatasetFormatSettings.builder()
                        .addPartitionColumns("record_date", "department")
                        .build())
                .write();
    }
}
```

## Advanced `repartitionByRange` usage

In the above code examples, we invoke `repartitionByRange` without specifying a partition count, and we specify the same partition columns as we do in the hive-style partitioning settings. This simple implementation is generally fine, but there are two situations involving very large-scale data in which it can lead to issues.

* If the data for a single value combination is too large to fit into a single Spark executor's memory, we will encounter out-of-memory errors, because `repartitionByRange`, like `repartition`, assigns each unique value combination to exactly one partition.
* Because we do not specify a partition count, Spark will use the default number of partitions as configured by the `spark.sql.shuffle.partitions` setting. If the unique number of value combinations of the partition columns is greater than that value, then at least one partition will contain the data for multiple value combinations. This increases the likelihood of Spark out-of-memory errors, even if the data for a single value combination is small enough to fit into a single Spark executor's memory.

The below Python code sample represents a typical implementation that avoids both of these issues, at the cost of increased complexity. Per the sample's logic, each unique value combination of `department` and `record_date` will be spread across an average of eight Spark partitions, meaning that each value combination will have roughly eight files in the output dataset instead of one.

```python
from transforms.api import transform, Input, Output


@transform(
    transform_output=Output("/path/to/output"),
    transform_input=Input("/path/to/input"),
)
def compute(transform_output, transform_input):
    input_df = transform_input.dataframe()
    unique_date_department_combinations = input_df.select("department", "record_date").distinct().count()
    partition_count = unique_date_department_combinations * 8
    transform_output.write_dataframe(
        input_df.repartitionByRange(partition_count, "department", "record_date", "record_timestamp"),
        partition_cols=["department", "record_date"],
    )
```
