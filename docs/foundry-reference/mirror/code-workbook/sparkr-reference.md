<!-- source: https://palantir.com/docs/foundry/code-workbook/sparkr-reference/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# SparkR reference

## Introduction to SparkR

Code Workbook allows users to use both Spark R and native R. Spark R provides a distributed data frame implementation that supports operations like selection, filtering, and aggregation on large datasets. While users may be more familiar with native R, it is recommended that users first use SparkR to filter large datasets before using native R.

## Common SparkR operations

Read the full [API documentation ↗](https://spark.apache.org/docs/latest/api/R/index.html) for SparkR to see all possible operations. Below, we outline syntax for common operations.

### Filtering

Filter expressions can be a SQL-like WHERE clause passed as a string.

```r
df_filtered <- SparkR::filter(df, "numeric_col > 10")
```

You can also use column expressions similar to standard R syntax.

```r
df_filtered <- SparkR::filter(df, df$numeric_col > 10)
```

You can also use `SparkR::where` with similar syntax.

```r
df_filtered <- SparkR::where(df, "numeric_col > 10")
```

### Column operations

Subset columns using `SparkR::select()`.

```r
df_subset <- SparkR::select(df, "column1", "column2", "column3")
```

Rename a column with `SparkR::withColumnRenamed()`.

```r
df <- SparkR::withColumnRenamed(df, "old_column_name", "new_column_name")
```

Add new columns using `SparkR::withColumn()`.

```r
# Add two columns
df <- SparkR::withColumn(df, 'col1_plus_col2', df$col1 + df$col2)
# Multiply a column by a constant
df <- SparkR::withColumn(df, 'col1_times_60', df$col1 * 60)
```

### Aggregations

Use `SparkR::groupBy` and `SparkR::agg` to compute aggregates. Calling `SparkR::groupBy` will create a group by object. Pass the group by object into `SparkR::agg` to get an aggregated dataframe.

```r
df_grouped <- SparkR::groupBy(df, "group_col1", "group_col2")
df_agg <- SparkR::agg(df_grouped, average_col1=avg(df$col1), max_col=max(df$col1))
```
