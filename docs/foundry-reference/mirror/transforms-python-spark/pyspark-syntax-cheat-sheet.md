<!-- source: https://palantir.com/docs/foundry/transforms-python-spark/pyspark-syntax-cheat-sheet/ · mirrored 2026-08-13 from Palantir Foundry docs -->

# Syntax cheat sheet

A quick reference guide to the most commonly used patterns and functions in PySpark SQL:

* [Common Patterns](#common-patterns)
  * [Logging Output](#logging-output)
  * [Importing Functions & Types](#importing-functions--types)
  * [Filtering](#filtering)
  * [Joins](#joins)
  * [Column Operations](#column-operations)
  * [Casting & Coalescing Null Values & Duplicates](#casting--coalescing-null-values--duplicates)
* [String Operations](#string-operations)
  * [String Filters](#string-filters)
  * [String Functions](#string-functions)
* [Number Operations](#number-operations)
* [Date & Timestamp Operations](#date--timestamp-operations)
* [Array Operations](#array-and-struct-operations)
* [Aggregation Operations](#aggregation-operations)
* [Advanced Operations](#advanced-operations)
  * [Repartitioning](#repartitioning)
  * [UDFs (User Defined Functions)](#udfs-user-defined-functions)

If you can't find what you're looking for, it's likely covered in the [PySpark Official Documentation ↗](https://spark.apache.org/docs/latest/api/python/).

## Common Patterns

#### [Logging Output](/docs/foundry/transforms-python-spark/pyspark-logging/)

```python
# Within Code Workbook
print("example log output")

# Within Code Repositories
import logging
logger = logging.getLogger(__name__)
logger.info("example log output")
```

#### Importing Functions & Types

```python
# Easily reference these as F.my_function() and T.my_type() below
from pyspark.sql import functions as F, types as T
```

#### [Filtering](/docs/foundry/transforms-python-spark/pyspark-filtering/)

```python
# Filter on equals condition
df = df.filter(df.is_adult == 'Y')

# Filter on >, <, >=, <= condition
df = df.filter(df.age > 25)

# Multiple conditions require parentheses around each condition
df = df.filter((df.age > 25) & (df.is_adult == 'Y'))

# Compare against a list of allowed values
df = df.filter(col('first_name').isin([3, 4, 7]))

# Sort results
df = df.orderBy(df.age.asc())
df = df.orderBy(df.age.desc())
```

#### [Joins](/docs/foundry/transforms-python-spark/pyspark-joins/)

```python
# Left join in another dataset
df = df.join(person_lookup_table, 'person_id', 'left')

# Left anti-join in another dataset (return unmatched rows in left dataframe)
df = df.join(person_lookup_table, 'person_id', 'leftanti');

# Match on different columns in left & right datasets
df = df.join(other_table, df.id == other_table.person_id, 'left')

# Match on multiple columns
df = df.join(other_table, ['first_name', 'last_name'], 'left')

# Useful for one-liner lookup code joins
def lookup_and_replace(df1, df2, df1_key, df2_key, df2_value):
    return (
        df1
        .join(df2[[df2_key, df2_value]], df1[df1_key] == df2[df2_key], 'left')
        .withColumn(df1_key, F.coalesce(F.col(df2_value), F.col(df1_key)))
        .drop(df2_key)
        .drop(df2_value)
    )

df = lookup_and_replace(people, pay_codes, id, pay_code_id, pay_code_desc)
```

#### [Column Operations](/docs/foundry/transforms-python-spark/pyspark-columns/)

```python
# Add a new static column
df = df.withColumn('status', F.lit('PASS'))

# Construct a new dynamic column
df = df.withColumn('full_name', F.when(
    (df.fname.isNotNull() & df.lname.isNotNull()), F.concat(df.fname, df.lname)
).otherwise(F.lit('N/A')))

# Pick which columns to keep, optionally rename some
df = df.select(
    'name',
    'age',
    F.col('dob').alias('date_of_birth'),
)

# Remove columns
df = df.drop('mod_dt', 'mod_username')

# Rename a column
df = df.withColumnRenamed('dob', 'date_of_birth')

# Keep all the columns which also occur in another dataset
df = df.select(*(F.col(c) for c in df2.columns))

# Batch Rename/Clean Columns
for col in df.columns:
    df = df.withColumnRenamed(col, col.lower().replace(' ', '_').replace('-', '_'))
```

#### [Casting & Coalescing Null Values & Duplicates](/docs/foundry/transforms-python-spark/pyspark-other/#dealing-with-null-values)

```python
# Cast a column to a different type
df = df.withColumn('price', df.price.cast(T.DoubleType()))

# Replace all nulls with a specific value
df = df.fillna({
    'first_name': 'Tom',
    'age': 0,
})

# Take the first value that is not null
df = df.withColumn('last_name', F.coalesce(df.last_name, df.surname, F.lit('N/A')))

# Drop duplicate rows in a dataset (same as distinct())
df = df.dropDuplicates()

# Drop duplicate rows, but consider only specific columns
df = df.dropDuplicates(['name', 'height'])
```

## String Operations

#### [String Filters](/docs/foundry/transforms-python-spark/pyspark-filtering/)

```python
# Contains - col.contains(string)
df = df.filter(df.name.contains('o'))

# Starts With - col.startswith(string)
df = df.filter(df.name.startswith('Al'))

# Ends With - col.endswith(string)
df = df.filter(df.name.endswith('ice'))

# Is Null - col.isNull()
df = df.filter(df.is_adult.isNull())

# Is Not Null - col.isNotNull()
df = df.filter(df.first_name.isNotNull())

# Like - col.like(string_with_sql_wildcards)
df = df.filter(df.name.like('Al%'))

# Regex Like - col.rlike(regex)
df = df.filter(df.name.rlike('[A-Z]*ice$'))

# Is In List - col.isin(*values)
df = df.filter(df.name.isin('Bob', 'Mike'))
```

#### [String Functions](/docs/foundry/transforms-python-spark/pyspark-strings/)

```python
# Substring - col.substr(startPos, length) (1-based indexing)
df = df.withColumn('short_id', df.id.substr(1, 10))

# Trim - F.trim(col)
df = df.withColumn('name', F.trim(df.name))

# Left Pad - F.lpad(col, len, pad)
# Right Pad - F.rpad(col, len, pad)
df = df.withColumn('id', F.lpad('id', 4, '0'))

# Left Trim - F.ltrim(col)
# Right Trim - F.rtrim(col)
df = df.withColumn('id', F.ltrim('id'))

# Concatenate - F.concat(*cols) (null if any column null)
df = df.withColumn('full_name', F.concat('fname', F.lit(' '), 'lname'))

# Concatenate with Separator/Delimiter - F.concat_ws(delimiter, *cols) (ignores nulls)
df = df.withColumn('full_name', F.concat_ws('-', 'fname', 'lname'))

# Regex Replace - F.regexp_replace(str, pattern, replacement)
df = df.withColumn('id', F.regexp_replace(id, '0F1(.*)', '1F1-$1'))

# Regex Extract - F.regexp_extract(str, pattern, idx)
df = df.withColumn('id', F.regexp_extract(id, '[0-9]*', 0))
```

## [Number Operations](/docs/foundry/transforms-python-spark/pyspark-math/)

```python
# Round - F.round(col, scale=0)
df = df.withColumn('price', F.round('price', 0))

# Floor - F.floor(col)
df = df.withColumn('price', F.floor('price'))

# Ceiling - F.ceil(col)
df = df.withColumn('price', F.ceil('price'))

# Absolute Value - F.abs(col)
df = df.withColumn('price', F.abs('price'))

# X raised to power Y – F.pow(x, y)
df = df.withColumn('exponential_growth', F.pow('x', 'y'))

# Select smallest value out of multiple columns – F.least(*cols)
df = df.withColumn('least', F.least('subtotal', 'total'))

# Select largest value out of multiple columns – F.greatest(*cols)
df = df.withColumn('greatest', F.greatest('subtotal', 'total'))
```

## [Date & Timestamp Operations](/docs/foundry/transforms-python-spark/pyspark-dates/)

```python
# Convert a string of known format to a date (excludes time information)
df = df.withColumn('date_of_birth', F.to_date('date_of_birth', 'yyyy-MM-dd'))

# Convert a string of known format to a timestamp (includes time information)
df = df.withColumn('time_of_birth', F.to_timestamp('time_of_birth', 'yyyy-MM-dd HH:mm:ss'))

# Get year from date:       F.year(col)
# Get month from date:      F.month(col)
# Get day from date:        F.dayofmonth(col)
# Get hour from date:       F.hour(col)
# Get minute from date:     F.minute(col)
# Get second from date:     F.second(col)
df = df.filter(F.year('date_of_birth') == F.lit('2017'))

# Add & subtract days
df = df.withColumn('three_days_after', F.date_add('date_of_birth', 3))
df = df.withColumn('three_days_before', F.date_sub('date_of_birth', 3))

# Add & subtract months
df = df.withColumn('next_month', F.add_months('date_of_birth', 1))
df = df.withColumn('previous_month', F.add_months('date_of_birth', -1))

# Get number of days between two dates
df = df.withColumn('days_between', F.datediff('end', 'start'))

# Get number of months between two dates
df = df.withColumn('months_between', F.months_between('end', 'start'))

# Keep only rows where date_of_birth is between 2017-05-10 and 2018-07-21
df = df.filter(
    (F.col('date_of_birth') >= F.lit('2017-05-10')) &
    (F.col('date_of_birth') <= F.lit('2018-07-21'))
)
```

## [Array and Struct Operations](/docs/foundry/transforms-python-spark/pyspark-other/#collections)

```python
# Column Array - F.array(*cols)
df = df.withColumn('full_name', F.array('fname', 'lname'))

# Empty Array - F.array(*cols)
df = df.withColumn('empty_array_column', F.array(F.lit("")))

# Array or Struct column from existing columns
df = df.withColumn('guardians', F.array('guardian_1', 'guardian_2'))
df = df.withColumn('properties', F.struct('hair_color', 'eye_color'))

# Extract from Array column by index, or Map column by key (null if invalid)
df = df.withColumn('first_guardian', F.element_at(F.col('guardians'), 1))

# Extract from Struct column by field name
df = df.withColumn('hair_color', F.col('properties.hair_color'))

# Explode Array or Struct column into multiple rows
df = df.select(F.col('child_name'), F.explode(F.col('guardians')))
df = df.select(F.col('child_name'), F.explode(F.col('properties')))

# Explode Struct column into multiple columns
df = df.select(F.col('child_name'), F.col('properties.*'))

```

## [Aggregation Operations](/docs/foundry/transforms-python-spark/pyspark-aggregation/)

```python
# Row Count:                F.count(*cols), F.countDistinct(*cols)
# Sum of Rows in Group:     F.sum(*cols)
# Mean of Rows in Group:    F.mean(*cols)
# Max of Rows in Group:     F.max(*cols)
# Min of Rows in Group:     F.min(*cols)
# First Row in Group:       F.first(*cols, ignorenulls=False)
df = df.groupBy(col('address')).agg(
  count('uuid').alias('num_residents'),
  max('age').alias('oldest_age'),
  first('city', True).alias('city')
)

# Collect a Set of all Rows in Group:       F.collect_set(col)
# Collect a List of all Rows in Group:      F.collect_list(col)
df = df.groupBy('address').agg(F.collect_set('name').alias('resident_names'))
```

## Advanced Operations

#### Repartitioning

```python
# Repartition – df.repartition(num_output_partitions)
df = df.repartition(1)
```

#### [UDFs (User Defined Functions)](/docs/foundry/transforms-python-spark/pyspark-udfs/)

```python
# Multiply each row's age column by two
times_two_udf = F.udf(lambda x: x * 2)
df = df.withColumn('age', times_two_udf(df.age))

# Randomly choose a value to use as a row's name
import random

random_name_udf = F.udf(lambda: random.choice(['Bob', 'Tom', 'Amy', 'Jenna']))
df = df.withColumn('name', random_name_udf())
```
