<!-- source: https://palantir.com/docs/foundry/transforms-python-spark/pyspark-window/ · mirrored 2026-08-13 from Palantir Foundry docs -->

# Window

A window function allows a user to append aggregates and other values to rows in a dataframe without losing columns that aren't involved in the aggregates.

## Motivating Example

Suppose you have a `transactions` dataset with each transaction a `customer` has made, and you want to compute the `average_spend` for each customer and append it to each transaction. To do this using joins, you would need to perform a group by to get the averages and then join back to the original table:

```python
averages = transactions\
	.groupBy('customer')\
	.agg(
		F.avg('spend').alias('average_spend')
	)
transactions = transactions.join(averages, ['customer'], 'left_outer')
```

If you wanted to get the maximum spend, this logic becomes even more complex, as you now have to compute the maximum instead of the average and then join back onto the maximum:

```python
maximums = transactions\
	.groupBy('customer')\
	.max(
		F.avg('spend').alias('max_spend')
	)
transactions = transactions\
	.join(
		averages,
		(transactions.customer == maximums.customer) &\
		(transactions.spend == maximums.max_spend),
		'left_outer'
	).drop(maximums.customer)
```

Window functions, however, allow you to simplify this code by first defining a window and then computing aggregates "over" the window:

```python
from pyspark.sql.window import Window

window = Window()\
	.partitionBy('customer')\
	.orderBy('spend')

transactions = transactions\
	.withColumn('average_spend', F.avg('spend').over(window))
	.withColumn('max_spend', F.max('spend').over(window))

```

In addition, there are several functions that may only be used with windows. These are known as Window Functions and are described in the next section.

## Window Functions

#### `dense_rank()`

#### `lag(col, count=1, default=None)`

#### `lead(col, count=1, default=None)`

#### `ntile(n)`

#### `percent_rank()`

#### `rank()`

#### `row_number()`

#### `window(timeColumn, windowDuration, slideDuration=None, startTime=None)`
