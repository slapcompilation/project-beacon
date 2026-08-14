<!-- source: https://palantir.com/docs/foundry/transforms-python/pyspark-logging/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Logging

It's possible to output various debugging information from PySpark in Foundry.

## Code Workbook

Python's built in `print` pipes to the Output section of the [Code Workbook](/docs/foundry/code-workbook/overview/) to the right of the code editor where errors normally appear.

```python
def new_dataset(some_input_dataset):
    print("example log output")
```

```
example log output
```

## Code Repositories

Code Repositories uses Python's built in [logging library ↗](https://docs.python.org/3/library/logging.html). This is widely documented online and allows you to control logging level (`ERROR`, `WARNING`, `INFO`) for easier filtering.

Logging output appears in both your output dataset's log files, and in your build's driver logs (`Dataset -> Details -> Files -> Log Files`, and `Builds -> Build -> Job status logs`; select `"Driver logs"`, respectively).

```python
import logging

logger = logging.getLogger(__name__)

@transform_df(
    ...
)
def some_transformation(some_input):
    logger.info("example log output")
```

```
INFO [2018-01-01T12:00:00] some_transformation: example log output
```

### Logging from inside a Python UDF

Spark captures logging output from the top-level driver process that creates your query, such as from the `some_transformation` function above. However, it does not capture logs written from inside of [User Defined Functions (UDFs)](/docs/foundry/transforms-python-spark/pyspark-udfs/). If you are using a UDF within your PySpark query and need to log data, create and call a second UDF that returns the data you wish to capture.

```python
@transform_df(
    ...
)
def some_transformation(some_input):
    logger.info("log output related to the overall query")
    
    @F.udf("integer")
    def custom_function(integer_input):
    	return integer_input + 5
    
    @F.udf("string")
    def custom_log(integer_input):
    	return "Original integer was %d before adding 5" % integer_input
    
    df = (
    	some_input
    	.withColumn("new_integer", custom_function(F.col("example_integer_col"))
    	.withColumn("debugging", custom_log(F.col("example_integer_col"))
    )
```

## Examples

We often want to log information about what's happening in our query. PySpark has a number of ways to introspect DataFrames and we can send this information to the logging mechanisms described above.

We will use Code Workbook's `print` syntax in these examples but `print` can be substituted for Transforms & Authoring's `logger`.

### DataFrame Columns

We can introspect the columns that exist on a DataFrame with `df.columns` This produces a list of strings.

```python
def employee_phone_numbers(employee_df, phone_number_df):
    print("employee columns are {}".format(employee_df.columns))
    print("phone columns are {}".format(phone_df.columns))
    df = employee_df.join(phone_number_df, 'employee_id', 'left')
    print("joined columns are {}".format(df.columns))
```

```
employee columns are ['name', 'employee_id']
phone columns are ['phone_number', 'employee_id']
joined columns are ['name', 'employee_id', 'phone_number']
```

### Verifying join behavior

Suppose we are performing a left join, expect a one-to-one relationship and want to verify that the number of rows in our left DataFrame has stayed the same.

```python
def employee_phone_numbers(employee_df, phone_number_df):
    original_employee_rows = employee_df.count()
    print("Incoming employee rows {}".format(original_employee_rows))

    df = employee_df.join(phone_number_df, 'employee_id', 'left')
    rows_after_join = df.count()
    print("Final employee rows {}".format(rows_after_join))

    if rows_after_join > original_employee_rows:
        print("Some employees have multiple phone numbers!")
    else:
        print("Data is correct")
```

```
Incoming employee rows 100
Final employee rows 105
Some employees have multiple phone numbers!
```

### Spark Query Plan

You can access the optimized physical plan that Spark will run to generate a given `DataFrame` by calling `.explain()`.

```python
def employee_phone_numbers(employee, phone):
    employee = employee.where(F.month(employee.birthday) == F.month(F.current_date()))
    df = employee.join(phone, 'employee_id', 'left')
    df.explain()
```

```
== Physical Plan ==
*(2) Project [employee_id#9734, name#9732, birthday#9733, phone_number#9728]
+- *(2) BroadcastHashJoin [employee_id#9734], [employee_id#9729], LeftOuter, BuildRight
   :- *(2) Filter (month(birthday#9733) = 10)
   :  +- *(2) FileScan parquet !ri.foundry.main.transaction.00000000-e98a-c557-a20f-5eea5f373e36:ri.foundry.main.transaction.00000000-e98a-c557-a20f-5eea5f373e36@00000000-1ebd-4a81-9f64-2d4c8a8472bc:master.ri.foundry.main.dataset.6ad20cd7-45b0-4312-b096-05f57487f650[name#9732,birthday#9733,employee_id#9734] Batched: true, Format: Parquet, Location: FoundryCatalogFileIndex[sparkfoundry://.../datasets/ri.f..., PartitionFilters: [], PushedFilters: [], ReadSchema: struct<name:string,birthday:date,employee_id:int>
   +- BroadcastExchange HashedRelationBroadcastMode(List(cast(input[1, int, true] as bigint)))
      +- *(1) Project [phone_number#9728, employee_id#9729]
         +- *(1) Filter isnotnull(employee_id#9729)
            +- *(1) FileScan csv !ri.foundry.main.transaction.00000000-e989-4f9a-90d5-996f088611db:ri.foundry.main.transaction.00000000-e989-4f9a-90d5-996f088611db@00000000-1ebc-f483-b75d-dbcc3292d9e4:master.ri.foundry.main.dataset.f5bf4c77-37c0-4e29-8a68-814c35442bbd[phone_number#9728,employee_id#9729] Batched: false, Format: CSV, Location: FoundryCatalogFileIndex[sparkfoundry://.../datasets/ri.f..., PartitionFilters: [], PushedFilters: [IsNotNull(employee_id)], ReadSchema: struct<phone_number:int,employee_id:int>
```

### Viewing Data

Suppose we would like to see which employees have the most phone numbers. We will derive the dataset we're interested in (employees with more than one number) and call `.take(3)` to retrieve the top 3 rows as a list. Alternatively `.collect()` retrieves all rows of a DataFrame as a list.

:::callout{theme="warning" title="Warning"}
Pulling too much data into your Python environment can easily cause it to run out of memory. Only `collect()` small amounts of data.
:::

```python
def multiple_numbers(phone_numbers):
    df = phone_numbers.groupBy('employee_id').agg(
        F.count('phone_number').alias('numbers')
    ).where('numbers' > 1).sort(F.col('numbers').desc())

    print(df.take(3))
```

```
[Row(employee_id=70, numbers=4), Row(employee_id=90, numbers=2), Row(employee_id=25, numbers=2)]
```
