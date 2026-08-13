<!-- source: https://palantir.com/docs/foundry/transforms-python-spark/pyspark-overview/ · mirrored 2026-08-13 from Palantir Foundry docs -->

# PySpark transforms

**PySpark** is a wrapper language that allows you to interface with an Apache Spark backend to quickly process data. Spark can operate on very large datasets across a distributed network of servers, which provides major performance and reliability benefits when used correctly. However, it also comes with some limitations, especially if you're more used to relational database systems such as SQL. For example, it is impossible for Spark to know exactly where a row exists on which server, thus there is no way to directly select a specific row to update or drop. If you are used to thinking about your database this way, you will have to adjust your conceptual model to think about the dataset as a whole and process the data based on columns, not rows.

* **DataFrame:** is a collection of rows under **named columns**
  * Structurally similar to an SQL database, but non-relational
  * **Immutable:** a DataFrame cannot be *changed* after it is created, but it can be *transformed* into a new DataFrame (resulting in two DataFrames: the original, and the transformed). Datasets can be overwritten, but Foundry keeps track of version history so that you may explore and jump back to older builds at any time.
  * **Lazily evaluated:** a series of transformation tasks are evaluated as a single (combined) action, which is then performed when a build is triggered.
* **Resilient Distributed Datasets:** (RDD) is the underlying *data structure* of a DataFrame. By partitioning the DataFrame into multiple non-intersecting subsets, transformations can be evaluated in parallel on multiple computers (nodes) in a cluster (network) of computers. This all happens under the hood, but is important to keep in mind when writing in PySpark.
* **Shared Variables:** by default, Spark sends separately-managed *copies* of each variable used in transformation tasks to each parallel computer (node)—for efficiency's sake. If you must share a variable across tasks, Spark supports two types of shared variables:
  1. **Broadcast Variables:** caches (saves) a value in memory (RAM) that is broadcasted to all computers (nodes) in the cluster
  2. **Accumulators:** variables that can be added or aggregated, including (but not limited to) counters and summations. This concept is related to GroupedData, and is useful for statistical calculations.
* **Why use DataFrames?:** Spark DataFrames are designed and optimized to process large collections (petabytes+) of structured data.
* **Why should I write PySpark code?:** PySpark enables you to customize how you want to transform your datasets in Code Repositories and Code Workbook, in more complex and flexible ways than you could in Contour or Blacksmith alone.
* **What isn't PySpark for?:** PySpark is designed for you to transform datasets, but not to access individual values. You might be able to calculate sums and averages, but you can't and shouldn't reference the data directly.

Unlike SQL, where queries result in "views" (virtual table result-sets), processing datasets with PySpark results in entirely new datasets. This allows you to not only build new datasets based off derived datasets, other members of your organization can reuse the intermediary dataset for their own data processing tasks too. In Palantir Foundry, which is a data operating system, datasets are automatically linked via parent-child (or, source-result) directed tree relationships. This makes it easy for anyone to trace the data lineage of Spark transformations. In other words, you can explore how your dataset's dependencies are built, and where those datasets come from. You can also discover how other members of your organization have also used a dataset so that you can learn from examples or effectively reduce duplicative work.

## Understanding PySpark Code

### Starter Code Basics

In Code Workbook, your function may look something like this:

```python
def new_frame(old_frame):
  df = old_frame
  # df = transformations on df
  return df
```

* `old_frame`: references a *DataFrame* that represents a *Dataset* stored within Foundry. `old_frame` is *immutable* meaning that it cannot be modified within this `new_frame` function. In a sense, all intermediate step of transformation produces a new, immutable dataframe, which we may want to transform again or return as-is. This isn't entirely true, but as a cognitive model it will help you organize your code better.
* `new_frame`: within this function is where you may define a series of transformations you want to see applied to `old_frame`. Your `return` statement should return a *DataFrame* (which we've called `df` in this example). Under the hood, every transformation you've applied to that DataFrame is combined & *optimized*, before it is applied against the input dataset. Once you trigger a build with your code, the results are saved into a new Dataset file in Foundry, which you can explore once the build completes.

The data within a *DataFrame* cannot be directly referenced as it's not an `Array` nor `Dictionary`. Practically-speaking, it's impossible to determine where any of the data is located at any given moment anyway because of all the partitioning and shuffling happening under the hood. Unless you are filtering or aggregating the dataset, the code you write should be relatively *agnostic* to the contents of the dataset. Sorting is generally expensive and slow, so the rule of thumb is to assume every row is randomly ordered, constrain your toolset to columns, filters, aggregates, and your own creative problem-solving.

:::callout{theme="warning" title="Warning"}
It's very important that you keep track of the schema of the column coming in because PySpark is not type-safe and will try to evaluate all transform operations, and interrupts when any operation fails during runtime.

Do not perform math functions on strings or dates, or string operations on numbers, or date manipulations on integers, because the behavior of conflicting types is hard to predict.

Be sure to cast values to the correct types before operating on them.
:::

### Named Columns

Each column of the DataFrame is named (and re-nameable). Column names are unique and case-sensitive. Stick to these guidelines for Foundry Datasets:

* Always use lowercase lettering or numbers.
* Separate words with `_` (underscores) instead of spaces (because spaces are not allowed).
* Avoid `camelCasedColumnNames` by convention.
* Never use special characters, such as `(` , `)`, or `&`.
* Aggregation functions sometimes automatically name a column with special characters. You will need to provide an alias or rename the column before returning the dataframe in your transformation.

### Chaining Transforms

When you jump into existing code you'll notice there's no hard-line rule as to how you should name your variables referencing DataFrames. In this cheatsheet, DataFrames will be referenced to as `df`, but in other examples it could be `raw`, `out`, `input`, `table`, `something_specific`. Anything goes, as long as it gets the job done.

You'll also notice this pattern:

```python
df = df.select("firstName", "age")
df = df.withColumn("age", df.age.cast("integer"))
df = df.filter(df.age > 21)
df = df.withColumnRenamed("firstName", "first_name")
return df
```

Or (the same thing, written differently):

```python
return df.select("firstName", "age") \
       .withColumn("age", df.age.cast("integer")) \
       .filter(df.age > 21) \
       .withColumnRenamed("firstName", "first_name")
```

If you're not familiar with coding: `df` on the left side of the `=` is where the result of transformations *applied* to `df` on the right side is stored, before moving on to the next line of code. In this example, we stored the result into a variable of the same name, essentially overriding what `df` contains after each step. You could use a different name to hold the result of the DataFrame transformation, but in most cases it's okay to override the variable name and move on. At the end of each transformation function, we must return the new dataframe either as a variable (in the first example) or as the result of the last transformation (in the second example).

Both examples accomplish the same thing:

1. select only 2 columns of df that we want to include in our transformed dataset
2. cast the `age` column to ensure it's an integer and not a string.
3. filter the rows of our dataset to only include entries of `age > 21`
4. rename the column `firstName` to `first_name`

The resulting dataset will only have two columns `first_name`, `age` and people age 21 or under are excluded. That's what `df` contains at the end, and you can `return` it or apply more transformations to it. We'll explore these transforms in more detail in the following sections.

### Writing PySpark in Foundry

There are two tools for writing PySpark in Foundry: **Code Repositories** and **Code Workbook**.

In **Code Repositories**, you must declare the following import statement at the top of your `.py` document in order to use most functions:

```python
from pyspark.sql import functions as F
```

In **Code Workbook**, this is a global import that has already been included, so you can use most functions without additional configurations.

This reference is not exhaustive and will focus on providing some guidance on common patterns and best practices. For a full list of the pySpark SQL functions, you can reference the official [Apache Spark documentation ↗](https://spark.apache.org/docs/latest/api/python/reference/index.html).
