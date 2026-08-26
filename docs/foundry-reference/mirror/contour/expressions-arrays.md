<!-- source: https://palantir.com/docs/foundry/contour/expressions-arrays/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Array functions

This topic highlights array functions that you may want to use in [expressions](/docs/foundry/contour/expressions-overview/) in Contour.

***

## About arrays in Contour

You should note that arrays are only supported in the Expressions board in Contour. After working with arrays in column expressions, you should use `array_join` to convert the resulting array to a string so you can use it in other Contour boards.

***

## Array length

You can use the `array_length` function to get the length of an array. This can be helpful when filtering.
For example, if you have an array column `items_array`, you can use the Filter expression board with the `array_length` function to get the length of the array, as indicated below.

```
array_length(items_array) > 0
```

## Joining values

You can use the `array_agg` function to combine the values in a column.
Say you have a table of purchases made. You want to create a new column with an array of all items purchased by a particular customer.
If your table looks like the following:

|customer\_id	|item	|
|---	|---	|
|123	|bread	|
|123	|eggs	|
|444	|milk	|
|444	|bananas	|
|444	|bread	|

You can create a new column with the joined values with the following function:

```
array_join( array_agg("item") OVER (PARTITION BY "customer_id"), ', ' )
```

To break this into its parts:

* `array_agg` returns an array of all the values in a given column. We have given it a [window function](/docs/foundry/contour/expressions-window-functions/) as the column argument. So instead of

```
array_agg("item")
```

which would aggregate *all* values in the column, we have

```
array_agg("item") OVER (PARTITION BY "customer_id")
```

which will aggregate the values *by customer\_id*.

* `array_agg_distinct` returns an array of all distinct values in a given column. Unlike `array_agg`, this function ensures that each value appears only once in the resulting array.

* `array_join` is a transform function and joins the items in an array into a string, separated by a delimiter. Generically, this looks like:

```
array_join(<array>, <delimiter>)
```

So `[milk, bananas, bread]` becomes `"milk, bananas, bread"`.

The resulting column, `items_array`, will look like this:

|customer\_id	|items\_array	|
|---	|---	|
|123	|eggs, bread	|
|444	|milk, bananas, bread	|

***

## Exploding arrays

If you already have a column mapping a primary key to an array of values, you can break these out using the `explode` function, which will create a new row for each value in the array, so given:

|customer\_id	|items\_array	|
|---	|---	|
|123	|eggs, bread	|
|444	|milk, bananas, bread	|

Open the Expression Editor and choose 'Replace column'. The code `explode(items_array)` will result in the following table:

|customer\_id	|items\_array	|
|---	|---	|
|123	|eggs	|
|123	|bread	|
|444	|milk	|
|444	|bananas	|
|444	|bread	|

Note that the `explode` function will drop nulls. To keep nulls, use the `explode_outer` function.
