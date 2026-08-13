<!-- source: https://palantir.com/docs/foundry/transforms-python-spark/pyspark-joins/ · mirrored 2026-08-13 from Palantir Foundry docs -->

# Joins

A `DataFrame` in PySpark can be joined to another dataframe or to itself just as tables can be joined in SQL. Dataframes are joined to other dataframes with the `.join()` method. It takes a `DataFrame`, a join constraint such as the name of a column to join on, and a method (`left`, `right`, `inner`, etc.)

## Simple left join

```python
df_joined = df_left.join(df_right, 'key', 'left')
```

`df_joined` is now the result of a `left` join on `df_left.key == df_right.key`. PySpark automatically drops one of the copies of the `key` column so that `df_joined` only contains one column named `key`.

:::callout{theme="neutral"}
If the key(s) to be joined on in `df_left` and `df_right` do not have the same name, it is recommended to rename them first before performing the join.
:::

### Colliding names

Be sure to rename or drop any fields you are not explicitly joining on that have the same name as these will collide once the join is complete. All columns in a `DataFrame` can be renamed to have a certain prefix in a loop like so,

```python
for column in df.columns:
	df = df.withColumnRenamed(column, 'some_prefix_' + column)
```

## Joining on multiple fields

The `.join()` method can take a list of fields to join on instead of a single field.

```python
df_joined = df_left.join(df_right, ['column1', 'column2', 'column3'], 'left')
```

`df_joined` is now a join on `column1`, `column2` and `column3`. Again, this assumes the column names are consistent between `df_left` and `df_right`.

## Advanced arbitrary join constraints

PySpark supports using an arbitrary expression to join using logical operators. Suppose we want to join on a column `ID`, a date `start` in our left `DataFrame` being before a date `end` in our right `DataFrame`, and depending on the contents of a certain field `X`, possibly require or not require that `Y` in our right `DataFrame` contains yet another value.

```python
key_constraint = df_left.ID == df_right.ID
date_constraint = df_left.start < df_right.end
case_constraint = F.when(df_left.X == 'some_value', df_right.Y == 'some_other_value')\
	.otherwise(True)
combined_constraints = key_constraint & date_constraint & case_constraint
df_joined = df_left.join(df_right, combined_constraints, 'left')
```

## Cross join (Cartesian product)

Use a cross join to generate all combinations of rows between two dataframes, also known as the Cartesian product, without any matching by key or other constraint. Cross joins should be avoided if possible due to their risk of introducing memory and performance problems.

:::callout{theme="warning" title="Warning"}
Don't use a cross join if you intend to immediately filter down the results. Instead, embed your filter criteria into the join constraint for a more efficient solution (see [Advanced arbitrary join constraints](#advanced-arbitrary-join-constraints) above).
:::

You must explicitly [import the profile](/docs/foundry/code-repositories/spark-profiles/) `CROSS_JOIN_ENABLED` in your Code Repository to use cross joins.

```python
from transforms.api import configure

@configure(profile=["CROSS_JOIN_ENABLED"])
@transform_df(
	...
)
def my_compute_function(input_a, input_b):
	return input_a.crossJoin(input_b)

```
