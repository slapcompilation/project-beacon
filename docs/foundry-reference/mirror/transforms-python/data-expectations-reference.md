<!-- source: https://palantir.com/docs/foundry/transforms-python/data-expectations-reference/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Data expectations reference

Below is the categorized list of all available data expectations.

## Operators

```python
from transforms import expectations as E

E.true()           # Always passes
E.false()          # Always fails
E.all(e1,e2,...)   # Passes when all sub-expectations pass
E.any(e1,e2,...)   # Passes when any of the sub-expectations pass
E.negate(e1)       # Passes when the sub-expectation fails
```

For example:

```python
from transforms import expectations as E

E.all(
    E.col('a').gt(0),
    E.col('a').lt(100),
    E.any(
        E.col('b').gt(100),
        E.col('b').lt(0)
    )
)
```

## Column expectations

Column expectations begin with `E.col('column_name')`.

When using the `any` operator each row would be checked individually for any of the column expectations.
For example, to validate that the value of column `c1` should be greater than 10 or lower than 0:

```python
from transforms import expectations as E

E.any(
    E.col("c1").lt(0),
    E.col("c1").gt(10)
)
```

### Greater or less than

```python
from transforms import expectations as E

E.col('c').gt(number|string)
E.col('c').gte(number|string)
E.col('c').lt(number|string)
E.col('c').lte(number|string)
```

For example:

```python
from transforms import expectations as E

E.col(‘age').lt(120)
```

:::callout{theme="neutral"}
This expectation ignores null values (meaning that null values will automatically pass). To check for nulls, use `E.col('col').non_null()`.
:::

### Column comparison

```python
from transforms import expectations as E

E.col('c1').equals_col('c2')  # Column c1 value is equal to column c2 value
E.col('c1').not_equals_col('c2')  # Column c1 value is not equal to column c2 value
E.col('c1').gt_col('c2')  # Column c1 value is greater than column c2 value
E.col('c1').gte_col('c2') # c1 value is greater than or equal c2 value
E.col('c1').lt_col('c2')  # Column c1 value is lower than column c2 value
E.col('c1').lte_col('c2') # c1 value is lower than or equal c2 value
```

### Property comparison

```python
from transforms import expectations as E

E.col('c').null_percentage().lt(value)
E.col('c').null_count().gt(value)
E.col('c').distinct_count().equals(value)
E.col('c').approx_distinct_count().equals(value) # Faster version of distinct_count which guarantees a relative standard deviation of the error of max 5%
E.col('c').sum().gt(value) # Only works for numeric columns
E.col('c').standard_deviation_sample().gt(value) # Only works for numeric columns
E.col('c').standard_deviation_population().gt(value) # Only works for numeric columns
```

For example:

```python
from transforms import expectations as E

E.col("myCol").null_percentage().lt(0.1)    # myCol is less than 10% null values
E.col("myCol").null_count().gt(100)         # myCol has more than 100 null values
E.col("myCol").distinct_count().equals(5)   # myCol has 5 distinct values (since version 0.11.0)
E.col('myCol').approx_distinct_count().equals(5).   # myCol has approximately 5 distinct values
E.col('myCol').sum().equals(5)              # myCol values sum to 5
E.col('myCol').standard_deviation_sample().gt(5) # myCol has sample standard deviation greater than 5
E.col('myCol').standard_deviation_population().gt(5) # myCol has population standard deviation greater than 5
```

### Equals

```python
from transforms import expectations as E

E.col('c').equals(value)    # Column value equals input
```

For example:

```python
from transforms import expectations as E

E.col('test_column').equals("success")
```

:::callout{theme="neutral"}
This expectation ignores null values (meaning that null values will automatically pass). To check for nulls, use `E.col('col').non_null()`.
:::

### Not equals

```python
from transforms import expectations as E

E.col('c').not_equals(value)    # Column value does not equal input
```

For example:

```python
from transforms import expectations as E

E.col('test_column').not_equals("failure")
```

:::callout{theme="neutral"}
This expectation ignores null values (meaning that null values will automatically pass). To check for nulls, use `E.col('col').non_null()`.
:::

### Null

```python
from transforms import expectations as E

E.col('c').non_null()    # Column value is not null
E.col('c').is_null()     # Column value is null
```

### Is in

This expectation verifies that the column value is within a list of approved values.
For Array columns, see [is in (array)](#array-is-in).

```python
from transforms import expectations as E

E.col('c').is_in(a, b, ...)    # Column value is in given list
```

:::callout{theme="neutral"}
This expectation fails on null values unless you add `None` to the allowed values.
:::

### rlike (regex)

Regex partial match, similar to `pyspark.sql.functions.rlike`.

```python
from transforms import expectations as E

E.col('c').rlike(regex expression)    # Column value matches a regex expression (partial match)
```

For example:

```python
from transforms import expectations as E

E.col('flight_number').rlike(r"^\D{2}\d{2,4}$")
```

:::callout{theme="neutral"}
This expectation ignores null values (meaning that null values will automatically pass). To check for nulls, use `E.col('col').non_null()`.
:::

### Has type

```python
from transforms import expectations as E

E.col('c').has_type(Type)   # Column 'c' is of type Type
```

:::callout{theme="neutral"}
Type expectations leverage [Polars types ↗](https://docs.pola.rs/api/python/stable/reference/datatypes.html) for single-node compute, regardless of engine, and [Spark SQL types ↗](https://spark.apache.org/docs/latest/sql-ref-datatypes.html) for PySpark compute. You must import the relevant library and reference types appropriately, as in the below example.
:::

For example:

```python tab="Single-node (Lightweight)"
from transforms import expectations as E
import polars as pl

E.col('age').has_type(pl.Int32)
```

```python tab="PySpark"
from transforms import expectations as E
from pyspark.sql import types as T

E.col('age').has_type(T.LongType())
```

### Exists

```python
from transforms import expectations as E

E.col('c').exists()  # Column 'c' exists in the output dataframe
```

This expectation checks whether a column with the provided name exists in the output dataframe.
The column may be of any type.

## Timestamp expectations

Timestamp expectations will only work on columns of type `Timestamp`. `Date` columns are not currently supported.

### Static timestamp comparison

Compare the values in a timestamp column with a static timestamp. The static timestamp can be provided either as an ISO8601 formatted string, or as a Python datetime object.
All timestamps have to be timezone aware to avoid ambiguity.

:::callout{theme="warning" title="Warning"}
Never use the static timestamp expectation with a timestamp derived from \`datetime.now()\`. While this might initially appear to yield correct results, this behavior is unsupported and could result in incorrect results without warning. Additionally, Data Health and messages across Foundry will not reference the correct timestamp if you use a static timestamp expectation with a timestamp derived from `datetime.now()`. Instead, use [relative timestamp comparison expectations](#relative-timestamp-comparison).
:::

```python
from transforms import expectations as E

E.col("timestamp").is_after("2020-12-14T11:32:23+0000")
E.col("timestamp").is_before(datetime(2017, 11, 28, 23, 55, 59, 342380))
E.col("timestamp").is_on_or_after("2020-12-14T11:32:23+0000")
E.col("timestamp").is_on_or_before("2020-12-14T11:32:23+0000")
```

### Column timestamp comparison

Compare the values in a timestamp column against the values in another timestamp column. An optional offset (integer number of seconds) can be provided, and will be added to the values of the other column.

The comparison will be:

```
first_column ($OPERATOR) second_column + offset_in_seconds
```

```python
from transforms import expectations as E

E.col("timestamp").is_after_col("second_timestamp")
E.col("timestamp").is_on_or_after_col("second_timestamp")
# Operators accept an optional offset_in_second argument
# Check `second_timestamp` is less than an hour after `timestamp`
E.col("timestamp").is_before_col("second_timestamp", 3600)
# Check `second_timestamp` is more than 2 hours before `timestamp`
E.col("timestamp").is_on_or_before_col("second_timestamp", -7200)
```

### Relative timestamp comparison

Compare the values of a timestamp column against the time at which the check is run (such as when the build happens) plus a user-specified offset. The offset can be provided as an integer number of seconds, or as a `timedelta` Python object.

:::callout{theme="warning" title="Relative timestamp comparison precision"}
We expect the relative timestamp comparison to be precise up to a few minutes. This is due to the imprecision for the time at which the check is instantiated or run. The exact timestamps used will be available after the check runs and presented in the Expectations check result.
:::

Two main methods are provided: `timestamp_offset_from_current_time` and `timestamp_offset_to_current_time`. We provide two different methods to help with reasonning against relative time offsets in a natural way. Therefore, we only support positive time offsets as arguments. If you need to use a negative offset, consider using the other method instead.

#### `timestamp_offset_from_current_time`

This method is intended for use relative times in the future, where `timestamp - now()` is a positive value. This value will then be compared to the provided offset. All regular comparison operators are available for comparison.

```python
from datetime import timedelta
from transforms import expectations as E

# Timestamp values are less than 1 hour in the future
A = E.col("timestamp").timestamp_offset_from_current_time().lt(3600)

# Timestamp values are more than 2 hours in the future
B = E.col("timestamp").timestamp_offset_from_current_time().gt(timedelta(hours=2))
```

#### `timestamp_offset_to_current_time`

This method is intended for use with relative times in the past, where `now() - timestamp` is a positive value. This value will then be compared to the provided offset. All regular comparison operators are available for comparison.

```python
from datetime import timedelta
from transforms import expectations as E

# Timestamp values are less than 90 minutes in the past
C = E.col("timestamp").timestamp_offset_to_current_time().lt(5400)

# Timestamp values are more than 2 hours in the past
D = E.col("timestamp").timestamp_offset_to_current_time().gt(timedelta(hours=2))
```

#### Example: Expected results

Assuming the check is running at 4pm on January 1st, here are the results we expect for the checks above for different values of timestamp.

```
   < ------- PAST ---------------------  NOW  -------------------- FUTURE ------>
   |    1pm   |    2pm   |    3pm   |    4pm   |    5pm   |    6pm   |    7pm   |
---+----------+----------+----------+----------+----------+----------+----------+
 A |   PASS   |   PASS   |   PASS   |   PASS   |   FAIL   |   FAIL   |   FAIL   |
---+----------+----------+----------+----------+----------+----------+----------+
 B |   FAIL   |   FAIL   |   FAIL   |   FAIL   |   FAIL   |   FAIL*  |   PASS   |
---+----------+----------+----------+----------+----------+----------+----------+
 C |   FAIL   |   FAIL   |   PASS   |   PASS   |   PASS   |   PASS   |   PASS   |
---+----------+----------+----------+----------+----------+----------+----------+
 D |   PASS   |   FAIL*  |   FAIL   |   FAIL   |   FAIL   |   FAIL   |   FAIL   |
---+----------+----------+----------+----------+----------+----------+----------+
```

The comparisons in checks B and D are strict comparison. Use `ge` and `le` for non-strict comparison.

### Group and property timestamp comparison

Most timestamp comparisons are also available on derived properties of regular dataframes or grouped dataframes.

```python
from datetime import timedelta
from transforms import expectations as E

# Check that the highest timestamp is after a given static date
E.col("timestamp").max_value().is_after("2020-12-14T12:23:50+0000")

# Check that the oldest timestamp is less than 1 day in the past
E.col("timestamp").min_value().timestamp_offset_to_current_time().lt(timedelta(days=1))

# Check that the last date in each category is more than 2 month in the future
E.group_by("category")
    .col("timestamp")
    .max_value()
    .timestamp_offset_from_current_time()
    .gt(timedelta(months=2))
```

## Array expectations

Not all expectations work for array-type columns. Array-type columns can only use the specific expectations described below.

### Array is in

The `is_in` expectation also works on columns of array type.
For arrays, this expectation tests that arrays only contain the values specified in the `is_in` clause.

```python
from transforms import expectations as E

E.col('array_col').is_in('a', 'b', 'c') # Any array in the 'array_col' can only contain values 'a', 'b' or 'c'.
```

### Array contains

The `array_contains` expectation allows you to check that each row of the array column contains a specific value.

```python
from transforms import expectations as E

E.col('array_col').array_contains('a') # All rows must contain value 'a' in 'array_col'.
```

### Array size

The `size` expectation allows you to check that each row of the array has a specific size.

```python
from transforms import expectations as E

E.col('array_col').size().gt(1) # 'array_col' must have length greater than 1.
E.col('array_col').size().equals(2) # 'array_col' must have length equal to 2.
```

## Group-by expectations

Group-by expectations begin with `E.group_by('column_1', 'column_2', ...)`. Group-by expectations allow setting expectations on a combination of columns.

### Is unique

```python
from transforms import expectations as E

E.group_by('col1', 'col2').is_unique()   # When combined together, the values of the combined columns are unique within the dataset
```

### Row count

Row count expectation tests the row count for each group. If the group\_by is empty, this tests against the row count of the entire dataset.

```python
from transforms import expectations as E

E.group_by('col1', 'col2').count().gt(100)    # For each group by 'col1', 'col2', the row count must be greater than 100
E.group_by().count().lt(100)    # The row count of the dataset is less than 100.
E.count().equals(0)    # Shorthand for an empty group_by. Assert row count of the dataset is equal to 0.
```

### Group-by property expectations

All [property comparison expectations](#property-comparison) can also be used as grouped expectations.

```python
from transforms import expectations as E

E.group_by('col1').col('value_col').distinct_count().equals(3) # For each group by 'col1', the distinct count of 'value_col' must be equal to 3.
E.group_by('col1').col('value_col').null_percentage().lt(0.5) # For each group by 'col1', the null percentage of 'value_col' must be less than 50%.
```

## Primary key

Primary key expectations take one or more column names and verify:

1. Each column has no null values
2. The combination of columns is unique

```python
from transforms import expectations as E

E.primary_key('c1')             # Column `c1` is unique and not null.
E.primary_key('c1', 'c2',...)   # Columns {'c1', 'c2',...} are each not null and together are unique
```

|Expectation	|Description	|Example	|
|---	|---	|---	|
|E.primary\_key('c1')	|Column `c1` is unique and not null	|E.primary\_key('object\_id')	|
|E.primary\_key('c1', 'c2',...)	|Columns {'c1', 'c2',...} are each not null and together are unique	|E.primary\_key('time', 'event')	|

For example:

```python
from transforms import expectations as E

E.primary_key('time', 'event')
```

## Schema expectations

All schema expectations start with `E.schema()`.

Use the appropriate data type checks based on the [compute engine](/docs/foundry/transforms-python/compute-engines/) used for your transform. For the default single-node (lightweight) transforms, use checks with [Polars data types ↗](https://docs.pola.rs/api/python/stable/reference/datatypes.html). For distributed (Spark) transforms, use checks with [PySpark SQL types ↗](https://spark.apache.org/docs/latest/sql-ref-datatypes.html).

```python
from transforms import expectations as E

E.schema().contains({'col_name':type})  # Dataset columns must contain the listed columns.
E.schema().equals({'col_name':type})   # Dataset columns match exactly the listed columns (no additions)
E.schema().is_subset_of({'col_name':type})   # Dataset columns must be a subset of the listed columns.
                                             # All columns in the dataset must be defined in the check.
                                             # Columns can be defined in the check without being present in the dataset.
```

For example:

```python tab="Lightweight"
from transforms import expectations as E
import polars as pl

E.schema().contains(
    {
        'name': pl.String(),
        'int_list': pl.List(pl.Int32)
    }
)
```

```python tab="Distributed"
from transforms import expectations as E
from pyspark.sql import types as T

E.schema().contains(
    {
        'id': T.IntegerType(),
        'name': T.StringType()
    }
)
```

## Conditional

Conditional expectations take three expectations and verify:

1. Rows passing the when-expectation also pass the then-expectation
2. Rows failing the when-expectation pass the otherwise-expectations

```python
from transforms import expectations as E

E.when(
    when_exp,
    then_exp
).otherwise(
    otherwise_exp
)
```

For example, when "myCol" is greater than 0, then "myOtherCol" must be in \["a"], otherwise "myOtherCol" must be in \["b"].

```python
from transforms import expectations as E

E.when(
    E.col("myCol").gt(0),
    E.col("myOtherCol").is_in("a")
).otherwise(
    E.col("myOtherCol").is_in("b")
)
```

:::callout{title="Always true / always false expectations"}
Use `E.true()` and `E.false()` to set simple defaults for the `otherwise` branch of the conditional expectation.
:::

## Foreign value expectations \[Experimental]

:::callout{theme="warning" title="Experimental"}
Foreign value expectations are in the [experimental](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

Foreign value expectations verify relationships between data in different datasets. These expectations involve joins and can be **very expensive to evaluate**, so use cautiously.

### Referential integrity

This expectation verifies that all values in the selected column of an expected dataset are present in a specified column of a foreign dataset. **Null values are ignored**.

The foreign column to match against is qualified by a dataset reference created using the name of the other dataset: `E.dataset_ref('other_dataset_name').col('f_col')`.

The foreign datataset *must* be an input to your transform (you cannot simply pass in a RID or a path), and the reference in `E.dataset_ref` should be the name of the variable to which it is assigned.

Using the column reference is similar to the usage of *is\_in()*:

```python
E.col('pk').is_in_foreign_col(E.dataset_ref('other_dataset').col('fk'))
```

## Cross-dataset row count comparisons

Cross-dataset row count comparisons can be used to compare the number of rows in one dataset with the number of rows in another dataset.

For example, we can check that an output row count is the same as the row count of an input dataset:

```python
E.count().equals(E.dataset_ref('input_dataset_name').count())
```

The dataset to compare against is qualified with a dataset reference created using the name of the other dataset.

You can use the following operators for dataset row count comparisons:

```python
from transforms import expectations as E

E.count().equals(E.dataset_ref('input_dataset_name').count()) # Equal to
E.count().lt(E.dataset_ref('input_dataset_name').count()) # Less than
E.count().lte(E.dataset_ref('input_dataset_name').count()) # Less than or equal to
E.count().gte(E.dataset_ref('input_dataset_name').count()) # Greater than or equal to
E.count().gt(E.dataset_ref('input_dataset_name').count()) # Greater than
```
