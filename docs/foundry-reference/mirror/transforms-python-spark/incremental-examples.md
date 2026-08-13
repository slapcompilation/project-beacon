<!-- source: https://palantir.com/docs/foundry/transforms-python-spark/incremental-examples/ · mirrored 2026-08-13 from Palantir Foundry docs -->

# Examples

This section contains a wide range of examples of incrementally computable transforms:

* [Append](#append)
* [Merge and append](#merge-and-append)
* [Merge and replace](#merge-and-replace)
* [Leveraging incremental transforms to join large datasets](#leverage-incremental-transforms-to-join-large-datasets)
* [Handling schema or logic changes](#handle-schema-or-logic-changes)
* [Developing incremental code on a branch](#develop-incremental-code-on-a-branch)
* [Summary of examples](#summary-of-examples)

The examples make use of two inputs to demonstrate incremental computation: `students` and `students_updated`. The `students` input contains 3 students and is not incremental. This means it has no history:

```
>>> students.dataframe('previous').sort('id').show()
+---+----+---+---+
| id|hair|eye|sex|
+---+----+---+---+
+---+----+---+---+
>>>
>>> students.dataframe('current').sort('id').show()
+---+-----+-----+------+
| id| hair|  eye|   sex|
+---+-----+-----+------+
|  1|Brown|Green|Female|
|  2|  Red| Blue|  Male|
|  3|Blond|Hazel|Female|
+---+-----+-----+------+
>>>
>>> students.dataframe('added').sort('id').show()
+---+-----+-----+------+
| id| hair|  eye|   sex|
+---+-----+-----+------+
|  1|Brown|Green|Female|
|  2|  Red| Blue|  Male|
|  3|Blond|Hazel|Female|
+---+-----+-----+------+
>>>
>>> # Recall that the default read mode for inputs is 'added'
>>> students.dataframe('added') is students.dataframe()
True
```

The `students_updated` input is the same as `students` but with an additional update that contains three extra students. This update makes the input incremental. Therefore, it has a non-empty `previous` DataFrame.

```
>>> students_updated.dataframe('previous').sort('id').show()
+---+-----+-----+------+
| id| hair|  eye|   sex|
+---+-----+-----+------+
|  1|Brown|Green|Female|
|  2|  Red| Blue|  Male|
|  3|Blond|Hazel|Female|
+---+-----+-----+------+
>>>
>>> students_updated.dataframe('current').sort('id').show()
+---+-----+-----+------+
| id| hair|  eye|   sex|
+---+-----+-----+------+
|  1|Brown|Green|Female|
|  2|  Red| Blue|  Male|
|  3|Blond|Hazel|Female|
|  4|Brown|Green|Female|
|  5|Brown| Blue|  Male|
|  6|Blond|Hazel|Female|
+---+-----+-----+------+
>>>
>>> students_updated.dataframe('added').sort('id').show()
+---+-----+-----+------+
| id| hair|  eye|   sex|
+---+-----+-----+------+
|  4|Brown|Green|Female|
|  5|Brown| Blue|  Male|
|  6|Blond|Hazel|Female|
+---+-----+-----+------+
>>>
>>> # Recall that the default read mode for inputs is 'added'
>>> students_updated.dataframe('added') is students_updated.dataframe()
True
```

### Append

An append-only incremental computation is one where the added output rows are a function only of the added input rows. This means that to compute its output, the transform does the following:

* Looks at any newly added input data,
* Computes any new output rows–which are a function only of these added input rows, and
* Appends the new output to the existing output.

:::callout{theme="neutral"}
Changing column types, formatting dates as strings, and filtering are all examples of append-only computations. In these examples, each added input row is transformed or deleted to generate the output rows.
:::

Notice that the only difference to make an append-only transform incremental is the `incremental()` decoration.

When running incrementally, the default read mode of `added` means the transform reads only the new students, and the default write mode of `modify` means the transform appends only the filtered new students to the output.

When running non-incrementally, the default read mode of `added` means the transform reads the full input, and the default write mode of `replace` means the transform replaces the output with the full set of filtered students.

```python
from transforms.api import transform, incremental, Input, Output

@incremental()
@transform(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def incremental_filter(students, processed):
    new_students_df = students.dataframe()
    processed.write_dataframe(
        new_students_df.filter(new_students_df.hair == 'Brown')
    )
```

### Merge and append

Sometimes a transform needs to refer to its previous output in order to incrementally compute an update. An example of this is the [`distinct()` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.distinct.html) method.
To remove duplicate rows in a transform (assuming the current output is correct), the transform must de-duplicate any new rows in the input, and then check those rows do not already exist in the output.

```python
@incremental()
@transform(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def incremental_distinct(students, processed):
    new_students_df = students.dataframe()
    processed.write_dataframe(
        new_students_df.distinct().subtract(
            processed.dataframe('previous', schema=new_students_df.schema)
        )
    )
```

Here we make use of the `previous` read mode on the output dataset. This returns the [`DataFrame` ↗](https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.DataFrame.html) that was output during the last build. Since it is possible that there is no `previous` output, we have to provide a schema to the `dataframe('previous')` call so that an empty DataFrame can be correctly constructed.

### Merge and replace

There are some transformations that always replace their entire output. Yet often, these transforms can still benefit from incremental computation. One such example is aggregating statistics. For example, counting the number of times each distinct value occurs in a column.

```python
from pyspark.sql import functions as F

@incremental()
@transform(
    students=Input('/examples/students_hair_eye_color'),
    processed=Output('/examples/hair_eye_color_processed')
)
def incremental_group_by(students, processed):
    # Compute the hair color counts for only the new students.
    new_hair_counts_df = students.dataframe().groupBy('hair').count()

    # Union with the old counts
    out_schema = new_hair_counts_df.schema
    all_counts_df = new_hair_counts_df.union(
        processed.dataframe('previous', schema=out_schema)
    )

    # Group by hair color, summing the two sets of counts.
    totals_df = all_counts_df.groupBy('hair').agg(F.sum('count').alias('count'))

    # To fully replace the output, we always set the output mode to 'replace'.
    processed.set_mode('replace')
    processed.write_dataframe(totals_df.select(out_schema.fieldNames()))
```

Again, since it is possible that there is no `previous` output, we have to provide a schema to the `dataframe('previous')` call so that an empty DataFrame can be correctly constructed.

### Merge and append with varying schemas

Sometimes, an incremental transform needs to create a Spark DataFrame from the files added to a schemaless input dataset and then append the contents of that DataFrame to the output. For such transforms, there are two implementation patterns.

* Statically specify the expected schema and enforce that the DataFrame generated has that schema (by ignoring extra fields in the input data, filling in nulls for fields missing in the input data, and so on).

* Dynamically capture whatever fields are present in the input data.

For the dynamic capture implementation pattern, it is necessary to ensure that the DataFrame that is appended to the output has a schema that is *compatible* with the existing output. For a schema to be compatible with the existing output, the following conditions must be met:

* Columns in the new data that have the same name as columns in the existing output must also have the same type.

* All columns in the existing output must be present in the new data.

* There are no columns in the new data with names that only differ in capitalization (case) from columns in the existing data; for example, there cannot be a column `Value` in the new data if there is already a column `value` in the existing data.

To ensure that these conditions are met, it is necessary to dynamically inspect the schema of the existing data, which means calling `dataframe('previous')` without specifying a schema. This is supported as long as the transform is being run incrementally.

The below code puts all of these principles together.

```python
from functools import reduce

from pyspark.sql import functions as F
from transforms.api import transform, incremental, Input, Output
from transforms.verbs.dataframes import sanitize_schema_for_parquet


@incremental()
@transform(
    csvs=Input('/examples/dataset_of_csvs'),
    parsed=Output('/examples/parsed_csvs')
)
def incremental_read_csv(ctx, csvs, parsed):
    input_fs = csvs.filesystem()

    def process_file(f):
        df = (
            ctx.spark_session.read
            # Set inferSchema to False so that every column is a string
            # This prevents issues due to inconsistent inference results between files,
            # both within and across incremental builds.
            .option("inferSchema", False)
            .option("header", True)
            .csv(input_fs.hadoop_path + "/" + f)
        )
        sanitized = sanitize_schema_for_parquet(df)

        # Make all columns lowercase to prevent issues due to inconsistent casing
        # between files, both within and across incremental builds.
        # Note that this logic does not handle the situation
        # where a single file contains columns differing only in case.
        return sanitized.select(*(F.col(a).alias(a.lower()) for a in sanitized.columns))

    dfs = [process_file(f.path) for f in input_fs.ls()]

    if len(dfs) == 0:
        parsed.abort()
        return

    df = reduce(
        lambda a, b: a.unionByName(b, allowMissingColumns=True),
        dfs[1:],
        dfs[0],
    )

    if not ctx.is_incremental:
        parsed.write_dataframe(df)
    else:
        existing_columns = parsed.dataframe("previous").columns
        columns_in_new_data = set(df.columns)
        resolved_schema_df = df.select(
            *df.columns,
            *(
                F.lit(None).cast("string").alias(col)
                for col in existing_columns
                if col not in columns_in_new_data
            )
        )
        parsed.write_dataframe(resolved_schema_df)
```

### Leverage incremental transforms to join large datasets

Let's assume you have two tables - `Orders` submitted by the customer and `Deliveries` that have been completed - and we would like to compute a table `DeliveryDuration` with the time it takes for items to be delivered. Even though both `Orders` and `Deliveries` tables will only get new rows appended and no rows will ever be modified, a simple join between the two incremental datasets will not work. For example, the `Orders` table might contain `orderIds` that are not yet present in the `Deliveries` table.

```
Orders:                               Deliveries:
+---------+---------------+           +---------+--------------+           +---------+------------------+
| orderId | submittedDate |           | orderId | deliveryDate |           | orderId | deliveryDuration |
+---------+---------------+           +---------+--------------+   ---->   +---------+------------------+
| 1001    | 2019-08-21    |  join on  | 1001    | 2019-08-23   |           | 1001    | 2                |
+---------+---------------+  orderId  +---------+--------------+           +---------+------------------+
| 1002    | 2019-08-22    |
+---------+---------------+
| 1003    | 2019-08-23    |
+---------+---------------+
```

Assuming `orderId` is strictly increasing in both `Orders` and `Deliveries` tables, we can check what has been the last `orderId` that we computed `deliveryDuration` for (`maxComputedOrderId`) and only get the rows from `Orders` and `Deliveries` tables with `orderId` bigger than `maxComputedOrderId`:

```python
from transforms.api import transform, Input, Output, incremental
from pyspark.sql import types as T
from pyspark.sql import functions as F

@incremental(snapshot_inputs=['orders', 'deliveries'])
@transform(
    orders=Input('/example/Orders'),
    deliveries=Input('/example/Deliveries'),
    delivery_duration=Output('/example/New_Delivery_Date')
)
def compute_delivery_duration(orders, deliveries, delivery_duration):
    def to_fields(datatype, names, nullable=True):
        return [T.StructField(n, datatype, nullable) for n in names]

    # Generate a schema to pass for deliveryDuration
    fields = to_fields(T.IntegerType(), ['orderId', 'deliveryDuration'])

    # Explicitly define the schema as you can't refer to the previous version schema
    maxComputedOrderId = (
        delivery_duration
        .dataframe('previous', schema=T.StructType(fields))
        .groupby()
        .max('orderId')
        .collect()[0][0]
    )

    # At first iteration, maxComputedOrderId is empty because delivery_duration dataset doesn't exist yet
    if maxComputedOrderId == None:
        maxComputedOrderId = 0

    ordersNotProcessed = orders.dataframe().filter(F.col('orderId') > maxComputedOrderId)
    deliveriesNotProcessed = deliveries.dataframe().filter(F.col('orderId') > maxComputedOrderId)

    newDurations = (
        ordersNotProcessed
        .join(deliveriesNotProcessed, 'orderId', how='left')
        .withColumn('deliveryDuration', F.datediff(F.col('deliveryDate'), F.col('submittedDate')))
        .drop(*['submittedDate', 'deliveryDate'])
    )

    delivery_duration.write_dataframe(newDurations)
```

### Handle schema or logic changes

Let’s say we would like to add another column to our incremental dataset from now on. Adding another column to the output won’t invalidate the `is_incremental` flag, so the next run will compute the new rows and write the data with a new column and this column will be null in all the rows written previously.

However, we might want to populate the column for previous rows as well. Increasing the `semantic_version` of the transform will make it run non-incrementally once, and if you are using read mode of “added”, the input will contain all the data enabling you to recompute it and add the new column.

If your transform has been creating a [historical dataset from snapshot input](/docs/foundry/transforms-python/create-historical-dataset/), then it becomes slightly more complicated, as the previous data is in a stack of snapshot transactions on your input. In this case, contact your Palantir representative.

In this example, we discussed adding a new column, but the above reasoning applies to all sorts of logic changes.

### Develop incremental code on a branch

Creating a new branch and running a build on it, will run the build incrementally. Simply the last transaction committed on the original branch you created your branch based off will be seen as the previous transaction for the first build on the new branch.

### Summary of examples

We saw how to process data incrementally by:

* getting newly added rows, processing them and appending them to the output,
* getting newly added rows, filtering them based on rows already present in the output and appending them to the output
* getting newly added rows, computing an aggregation based on new rows and rows already present in the output and replacing the output with new aggregated statistics
* leveraging incremental transforms to join large datasets

We also explored how to:

* handle schema or logic changes of an incremental transform
* develop incremental code on a branch without rebuilding based on full content of inputs

## Incremental Python errors

To understand incremental errors, it is easier — and sometimes necessary — to have read the concepts of [transactions](/docs/foundry/data-integration/datasets/#transactions) and [dataset views](/docs/foundry/data-integration/datasets/#dataset-views).

### Catalog transaction errors

#### Useful context

When a job runs incrementally, its incremental input datasets only consist of the unprocessed transactions range, not the full dataset view.

Imagine the following transaction history for a dataset:

```
SNAPSHOT (1) --> UPDATE (2) --> UPDATE (3) --> UPDATE (4) --> UPDATE (5)
                                   |
                       Last processed transaction
```

The last time the dataset was built, the latest transaction was (3). Since then, transactions (4) and (5) have been committed, therefore the unprocessed transaction range is (4) — (5).

The dataset *view* is the transaction range (1) — (5). The transaction “on top” of the view (the most recent) is sometimes referred to as the branch’s *HEAD* (again by analogy with git). Like in git a branch is a pointer to a transaction, so we say that the branch *points* at transaction (5). Several branches can point at several transactions, and branches might share a transaction history:

```
SNAPSHOT (1) ─> UPDATE (2) ─> UPDATE (3) ─> UPDATE (4) ─> UPDATE (5)     [develop]
                                 |
                                 └─> UPDATE                              [feature-branch]
```

#### Error: `Catalog:TransactionsNotInView`

In order for the job to run incrementally, a series of checks is run at the beginning of the job.
One of these checks verifies that the unprocessed transactions range is strictly incremental (i.e., append-only file changes, see [requirements for incremental computation](/docs/foundry/transforms-python/incremental-usage/#requirements-for-incremental-computation)). It does so by comparing the files in the unprocessed transactions range, and the processed transactions range.

However if the branch’s HEAD has been moved, the incremental job is now in an inconsistent state: it no longer make sense to compare both ranges, so an error `Catalog:TransactionNotInView` is thrown.

See the below for a diagram of how this error can occur:

```
SNAPSHOT (1) ─> UPDATE (2) ─> UPDATE (3)      ─> UPDATE (4) ─> UPDATE (5)
                   |          (last processed                  (branch's previous
                   |            transaction)                     HEAD, now orphan)
                   |
                   └─> UPDATE (6) --> UPDATE (7, branch's current HEAD)
```

Here the processed transaction range is (1) — (5), the current branch's HEAD points at (7), and the current view consists of transactions (1), (2), (6), and (7).

This is an inconsistent state because not all processed transactions are upstream of the branch’s HEAD: indeed (3) is not. In other words, the previous HEAD (3) no longer is part of the current view, hence why `Catalog:TransactionNotInView` is thrown.

#### Error: `Catalog:InconsistentBranchesOrder`

The other Catalog error that can be thrown is `Catalog:InconsistentBranchesOrder`, when the last processed transaction (`prevTransaction`) is greater than the branch HEAD (`endTransaction`). This can happen if the HEAD of the dataset is moved to a transaction before the previous transaction.

See the below for a diagram of how this error can occur:

```
SNAPSHOT (1) --> UPDATE (2) --> UPDATE (3) --> UPDATE (4) --> UPDATE (5)
                                   |                             |
                               Current HEAD            Last processed transaction
```

#### Remediation of errors

A branch’s HEAD can change for two reasons:

* A user knowingly updated the branch’s HEAD using Catalog endpoints.
* Some transactions were not committed through a transform job. For example, when you merge branches in Code Workbook, the dataset is also “merged”.
* However, transactions on [Code Workbook](/docs/foundry/code-workbook/overview/) datasets are always `SNAPSHOT`, so they cannot lead to an inconsistent state.

In order to remediate this, you will need to either:

* Run the transform as a snapshot; for example, by bumping the semantic version. This starts a new dataset view, thereby resetting the incremental check mentioned above.
* Manually update the branch’s HEAD to point at a transaction which is downstream of the already-processed range. This must be done using the `updateBranch2` endpoint with the latest processed transaction as the parentRef. Note that we only recommend the use of this endpoint for experienced users.
