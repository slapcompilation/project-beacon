<!-- source: https://palantir.com/docs/foundry/transforms-python/pyspark-aggregation/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Aggregation and pivot tables

## Aggregation Syntax

**There are a number of ways to produce aggregations in PySpark. We recommend this syntax as the most reliable.**

```python
aggregated_df = df.groupBy('state').agg(
	F.max('city_population').alias('largest_city_in_state')
)
```

| state | city         | city\_population |
| ----- | ------------ | --------------- |
| WA    | Bellevue     | 100000          |
| WA    | Seattle      | 700000          |
| PA    | Philadelphia | 1500000         |
| PA    | Pittsburgh   | 300000          |

| state | largest\_city\_in\_state |
| ----- | --------------------- |
| PA    | 1500000               |
| WA    | 700000                |

### Examples

The `.groupBy()` method on a `DataFrame` takes an arbitrary number of columns over which to perform the aggregations. Alternatively, to aggregate across the whole `DataFrame`, include no columns.

```python
aggregated_df = df.groupBy('state', 'county').agg(
	F.max('city_population').alias('largest_city_in_state_county')
)

aggregated_df = df.groupBy().agg(
	F.max('city_population').alias('largest_city_overall')
)
```

The `.agg()` method on a grouped `DataFrame` takes an arbitrary number of aggregation functions.

```python
aggregated_df = df.groupBy('state').agg(
	F.max('city_population').alias('largest_city_in_state'),
	F.avg('city_population').alias('average_population_in_state')
)
```

> By default aggregations produce columns of the form `aggregation_name(target_column)`. However, column names in Foundry cannot contain parentheses or other non-alphanumeric characters. Alias each aggregation to a specific name instead.

## Pivot Tables

Pivot tables in PySpark work very similarly to ordinary grouped aggregations.

```python
pivoted_df = df.groupBy('equipment').pivot('sensor').mean('value')
```

| equipment | sensor      | value |
| --------- | ----------- | ----- |
| A         | temperature | 60    |
| A         | temperature | 40    |
| B         | speed       | 6     |
| A         | speed       | 3     |

| equipment | temperature | speed |
| --------- | ----------- | ----- |
| A         | 50          | 3     |
| B         | null        | 7     |

## Aggregation Functions

[Learn more about PySpark aggregate functions. ↗](https://sparkbyexamples.com/pyspark/pyspark-aggregate-functions/)

#### `avg(column)` / `mean(column)`

#### `collect_list(column)`

* Combine all values into an array

#### `collect_set(column)`

* Combine all values into an array with duplicates removed

#### `count(column)`

#### `corr(x, y)`

* Pearson Correlation Coefficient for columns `x` and `y`.

#### `covar_pop(col1, col2)`

#### `covar_samp(col1, col2)`

#### `countDistinct(column, *cols)`

#### `first(column, ignorenulls=False)`

* First value of the column in the group. Useful for Pivot tables for which we expect only one value to exist but must choose an aggregation anyway.

#### `grouping(column)`

#### `grouping_id(*cols)`

#### `kurtosis(column)`

#### `last(column, ignorenulls=False)`

#### `max(column)`

#### `min(column)`

#### `skewness(column)`

#### `stddev(column)`

#### `stddev_pop(column)`

* Population standard deviation

#### `stddev_samp(column)`

* Unbiased sample standard deviation

#### `sum(column)`

#### `sumDistinct(column)`

#### `var_pop(column)`

* Population variance

#### `var_samp(column)`

* Unbiased sample variance

#### `variance(column)`
