<!-- source: https://palantir.com/docs/foundry/transforms-python/pyspark-columns/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Concept: Columns

To follow the examples in this document add: `from pyspark.sql import functions as F`.

Columns are managed by the PySpark class: `pyspark.sql.Column`. Column instances are created whenever you directly reference or derive an expression from an existing column. You can reference a column in any of the following ways:

* `F.col("column_name") `
* `F.column("column_name")`

:::callout{theme="neutral"}
Referencing columns is not equivalent to performing a `select`, since "selecting" columns refers to subsetting (and reordering) the columns that you want to appear in the resulting dataset.
:::

## Table of Contents

* [Getting the Schema](#getting-the-schema)
* [Select](#select): pick columns to keep
* [Create, update](#create-update)
* [Rename, alias](#rename-alias)
* [Drop](#drop): remove columns
* [Cast](#cast)
* [When, otherwise](#when-otherwise)

## Getting the schema

### `DataFrame.columns`

Returns all column names as a python list

```python
columns = df.columns # ['age', 'name']
```

## `DataFrame.dtypes`

Returns all column names and their data types as a list of tuples

```python
dtypes = df.dtypes # [('age', 'int'), ('name', 'string')]
```

## Select

### `DataFrame.select(*cols)`

Returns a new `DataFrame` with a subset of columns from the originating `DataFrame`.

For example, we have a DataFrame with 6 named columns: `id`, `first_name`, `last_name`, `phone_number`, `address`, `is_active_member`

| id   | first\_name | last\_name | phone\_number   | zip\_code | is\_active\_member |
| ---- | ---------- | --------- | -------------- | -------- | ---------------- |
| 1    | John       | Doe       | (123) 456-7890 | 10014    | `true`           |
| 2    | Jane       | Eyre      | (213) 555-1234 | 90007    | `true`           |
| ...  | ...        | ...       | ...            | ...      | ...              |

You may want to transform the DataFrame to only contain the named columns that you care about (a subset of what is available). Let's say you only want a table of just a single column `phone_number`:

```python
df = df.select("phone_number")
```

| phone\_number   |
| -------------- |
| (123) 456-7890 |
| (213) 555-1234 |
| ...            |

Or perhaps you want just the `id`, `first_name`, and `last_name` (there are at least 3 different ways to accomplish the same task):

1. Passing in column names directly:
   ```python
   df = df.select("id", "first_name", "last_name")
   ```
   or passing in column instances:
   ```python
   df = df.select(F.col("id"), F.col("first_name"), F.col("last_name"))
   ```
2. Passing in an array of column names:
   ```python
   select_columns = ["id", "first_name", "last_name"]
   df = df.select(select_columns)
   ```
3. Passing in an "unpacked" array:

   ```python
   select_columns = ["id", "first_name", "last_name"]
   df = df.select(*select_columns)
   # same as: df = df.select("id", "first_name", "last_name")
   ```

   | id   | first\_name | last\_name |
   | ---- | ---------- | --------- |
   | 1    | John       | Doe       |
   | 2    | Jane       | Eyre      |
   | ...  | ...        | ...       |

   The `*` before `select_columns` *unpacks* the array so that it functionally behaves the same way as `#1` (see comment). This enables you to do the following:

   ```python
   select_columns = ["id", "first_name", "last_name"]
   return df.select(*select_columns, "phone_number")
   # same as: df = df.select("id", "first_name", "last_name", "phone_number")
   ```

   | id   | first\_name | last\_name | phone\_number   |
   | ---- | ---------- | --------- | -------------- |
   | 1    | John       | Doe       | (123) 456-7890 |
   | 2    | Jane       | Eyre      | (213) 555-1234 |
   | ...  | ...        | ...       | ...            |

Keep in mind that your output dataset will **only contain the columns that you selected**, and **in the order they were selected**, instead of preserving the original column order. The names are unique and case sensitive, and must already exist as a column in the dataset you are selecting from.

An exception to that rule is that you can derive a new column and immediately select for it. You need to give the newly derived column an `alias`, or name:

| string1 | string2 | string3 | string4 |
| ------- | ------- | ------- | ------- |
| first   | second  | third   | Fourth  |
| one     | two     | three   | four    |

```python
derived_column = F.concat_ws(":", F.col("string1"), F.col("string2"))
return df.select("string3", derived_column.alias("derived"))
```

| string3 | derived      |
| ------- | ------------ |
| third   | first:second |
| three   | one:two      |

## Create, update

### `DataFrame.withColumn(name, column)`

```python
new_df = old_df.withColumn("column_name", derived_column)
```

* `new_df`: the resulting dataframe that contains all columns from `old_df`, but with `new_column_name` added.
* `old_df`: the dataframe that we want to apply a new column to
* `column_name`: the name of the column you want to either create (if it doesn't exist in old\_df) or update (if it already exists in old\_df).
* `derived_column`: the expression that derives a column, which is applied to every row under `column_name` (or whatever name you give the column).

Given an existing DataFrame, you can either create new columns or update existing columns with new or modified values using the `withColumn` method. This is particularly useful for the following goals:

1. deriving a new value based on an existing value

   ```python
   df = df.withColumn("times_two", F.col("number") * 2) # times_two = number * 2
   ```

   ```python
   df = df.withColumn("concat", F.concat(F.col("string1"), F.col("string2")))
   ```

2. casting values from one type to another

   ```python
   # cast `start_timestamp` to DateType and store the new value in `start_date`
   df = df.withColumn("start_date", F.col("start_timestamp").cast("date"))
   ```

3. updating the column

   ```python
   # update column `string` with an all-lowercased version of itself
   df = df.withColumn("string", F.lower(F.col("string")))
   ```

## Rename, alias

### `DataFrame.withColumnRenamed(name, rename)`

Use `.withColumnRenamed()` to rename a column:

```python
df = df.withColumnRenamed("old_name", "new_name")
```

Another way of viewing the task of renaming columns, which should give you an insight of how PySpark optimizes transformation statements, is:

```python
df = df.withColumn("new_name", F.col("old_name")).drop("old_name")
```

But there are also several cases where you derive a new column without `withColumn` and must still name it. This is where `alias` (or its method alias, `name`) comes handy. Here are a few usage examples:

```python
df = df.select(derived_column.alias("new_name"))
df = df.select(derived_column.name("new_name")) # same as .alias("new_name")
df = df.groupBy("group") \
	.agg(F.sum("number").alias("sum_of_numbers"), F.count("*").alias("count"))
```

We can also leverage rename multiple columns at once:

```python
renames = {
    "column": "column_renamed",
    "data": "data_renamed",
}

for colname, rename in renames.items():
    df = df.withColumnRenamed(colname, rename)
```

## Drop

### `DataFrame.drop(*cols)`

Returns a new `DataFrame` with a subset of columns from the originating `DataFrame`, dropping the specified columns. (This fails if schema doesn't contain the given column names.)

There are two ways to drop columns: the direct way, and the indirect way. The indirect way is to use `select`, which you'd select for a subset of columns that you want to *keep*. The direct way is to use `drop`, which you'd provide a subset of columns you want to *discard*. Both have similar usage syntax, except here order doesn't matter. A few examples:

| id   | first\_name | last\_name | phone\_number   | zip\_code | is\_active\_member |
| ---- | ---------- | --------- | -------------- | -------- | ---------------- |
| 1    | John       | Doe       | (123) 456-7890 | 10014    | `true`           |
| 2    | Jane       | Eyre      | (213) 555-1234 | 90007    | `true`           |
| ...  | ...        | ...       | ...            | ...      | ...              |

Let's say you want to drop only one column, `phone_number`:

```python
df = df.drop("phone_number")
```

| id   | first\_name | last\_name | zip\_code | is\_active\_member |
| ---- | ---------- | --------- | -------- | ---------------- |
| 1    | John       | Doe       | 10014    | `true`           |
| 2    | Jane       | Eyre      | 90007    | `true`           |
| ...  | ...        | ...       | ...      | ...              |

Or perhaps you want to drop `id`, `first_name`, and `last_name` (there are at least 3 different ways to accomplish the same task):

1. Passing in column names directly:
   ```python
   df = df.drop("id", "first_name", "last_name")
   ```
   or
   ```python
   df = df.drop(F.col("id"), F.col("first_name"), F.col("last_name"))
   ```
2. Passing in an array:
   ```python
   drop_columns = ["id", "first_name", "last_name"]
   df = df.drop(drop_columns)
   ```
3. Passing in an "unpacked" array:

   ```python
   drop_columns = ["id", "first_name", "last_name"]
   df = df.drop(*drop_columns)
   # same as: df = df.drop("id", "first_name", "last_name")
   ```

   | phone\_number   | zip\_code | is\_active\_member |
   | -------------- | -------- | ---------------- |
   | (123) 456-7890 | 10014    | `true`           |
   | (213) 555-1234 | 90007    | `true`           |
   | ...            | ...      | ...              |

   The `*` before `drop_columns` *unpacks* the array so that it functionally behaves the same way as `#1` (see comment). This enables you to do the following:

   ```python
   drop_columns = ["id", "first_name", "last_name"]
   df = df.drop(*drop_columns, "phone_number")
   # same as: df = df.drop("id", "first_name", "last_name", "phone_number")
   ```

   | zip\_code | is\_active\_member |
   | -------- | ---------------- |
   | 10014    | `true`           |
   | 90007    | `true`           |
   | ...      | ...              |

## Cast

### `Column.cast(type)`

Here are all the DataTypes that exist: `NullType`, `StringType`, `BinaryType`, `BooleanType`, `DateType`, `TimestampType`, `DecimalType`, `DoubleType`, `FloatType`, `ByteType`, `IntegerType`, `LongType`, `ShortType`, `ArrayType`, `MapType`, `StructType`, `StructField`

In general, you can convert most datatypes from one to another using the `cast` method on columns:

```python
from pyspark.sql.types import StringType
df.select(df.age.cast(StringType()).alias("age"))
# assume df.age is of IntegerType()
```

or

```python
df.select(df.age.cast("string").alias("age"))
# effectively the same as using StringType().
```

| age  |
| ---- |
| "2"  |
| "5"  |

Casting essentially creates a newly derived column, on which you can directly perform `select`, `withColumn`, `filter`, etc. The concept of "downcasting" and "upcasting" also applies in PySpark, so you may lose more granular information stored in a previous datatype, or gain garbage information.

## When, otherwise

`F.when(condition, value).otherwise(value2)`

Parameters:

* **condition** - a boolean Column expression
* **value** - a literal value or Column expression

Evaluates into a column expression that is identical to the `value` or `value2` parameter. If `Column.otherwise()` is not invoked, a column expression for `None` (null) is returned for unmatched conditions.

The `when`, `otherwise` operators provides an analogy to an `if-else` statement that computes a new column value. The basic usage is:

```python
# CASE WHEN (age >= 21) THEN true ELSE false END
at_least_21 = F.when(F.col("age") >= 21, True).otherwise(False)
# CASE WHEN (last_name != "") THEN last_name ELSE null
last_name = F.when(F.col("last_name") != "", F.col("last_name")).otherwise(None)
df = df.select(at_least_21.alias("at_least_21"), last_name.alias("last_name"))
```

You can chain the `when` statements too, as many times as you'd need:

```python
switch = F.when(F.col("age") >= 35, "A").when(F.col("age") >= 21, "B").otherwise("C")
```

These evaluations can be assigned to columns, or used in a filter:

```python
df = df.withColumn("switch", switch) # switch=A, B, or C
df = df.where(~F.isnull(last_name)) # filter for rows where the last_name (after empty strings were evaluated as null values) is not null
```
