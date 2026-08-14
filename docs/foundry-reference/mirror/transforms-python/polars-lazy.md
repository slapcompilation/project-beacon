<!-- source: https://palantir.com/docs/foundry/transforms-python/polars-lazy/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Polars lazy API

The [Polars lazy API ↗](https://docs.pola.rs/user-guide/concepts/lazy-api/) only evaluates queries after they are collected. This allows the engine to apply optimizations that improve performance in most cases, and is the recommended mode of compute when using Polars. Lazy execution is recommended for pipelines that process large amounts of data. However, different queries will benefit to varying degrees, and the stability of individual pipelines should always be verified before deploying to production systems.

To access the Polars lazy API in Foundry, set the `lazy` flag to `True` in your transform as shown below:

```python
from transforms.api import transform, Input, Output


@transform.lightweight(
    output=Output("/Users/jsmith/output"),
    input=Input("/Users/jsmith/input"),
)
def compute(output, input):
    df = input.polars(lazy=True)
    # your data transformation logic
    output.write_table(df)
```

By default, lazy execution is **disabled**.

The Polars [streaming engine ↗](https://docs.pola.rs/user-guide/concepts/streaming/), is generally used during lazy computation. This allows for larger-than-memory data to be processed, as the query can be executed in batches instead of all at once. In addition, queries will execute faster when data streaming is enabled. Streaming is always enabled when Polars is used in lazy mode.

## Filter pushdown

Lazy execution is especially beneficial when filter pushdown, also known as predicate pushdown, can be used. Filter pushdown means that filtering operations such as `.filter()`, `.where()`, or boolean indexing, are not executed immediately. Instead, they are recorded as part of the query plan. When the query is executed, Polars attempts to push these filters in the execution plan as early as possible. In some cases, they can be pushed all the way down to the data scan itself, avoiding data input/output altogether. The smaller the fraction of data used in the pipeline, the greater the impact filter pushdown will have. The full set of optimizations used during lazy compute can be found in the Polars [lazy optimization ↗](https://docs.pola.rs/user-guide/lazy/optimizations/) documentation.

If your query resembles the example below, enabling lazy execution is strongly recommended, as it will significantly improve performance.

```python
import polars as pl
from transforms.api import transform, Input, Output


@transform.lightweight(
    output=Output("/Users/jsmith/2025_06_sale_data"),
    sales_data=Input("/Users/jsmith/sales_data"),
)
def june_2025_sales(output, sales_data):
    df = (
        sales_data.polars(lazy=True)
        .filter(
            (pl.col("date") >= pl.lit("2025-06-01")) &
            (pl.col("date") <= pl.lit("2025-06-30"))
        )
    )
    output.write_table(df)
```

## Debug lazy pipelines

In lazy execution mode, Polars will generate a query plan. Use `.explain()` or `.describe_plan()` on a lazy DataFrame to view the planned execution steps and applied optimizations.

```python
from transforms.api import transform, Input, Output


@transform.lightweight(
    output=Output("/Users/jsmith/output"),
    input=Input("/Users/jsmith/input"),
)
def compute(output, input):
    df = input.polars(lazy=True)
    # your data transformation logic
    print(df.explain())
    output.write_table(df)
```

If a query is failing and lazy execution makes it challenging to identify the issue, you can materialize intermediate results with `.collect()`.

```python
from transforms.api import transform, Input, Output


@transform.lightweight(
    output=Output("/Users/jsmith/output"),
    input=Input("/Users/jsmith/input"),
)
def compute(output, input):
    df = input.polars(lazy=True)
    # part of a query
    df.collect()
    # remainder of a query
    output.write_table(df)
```

## Use with incremental transforms on streaming datasets

When using `polars(lazy=True)` in an [incremental transform](/docs/foundry/transforms-python/incremental-overview/) on a streaming dataset, the incremental window may sometimes contain no new files. Calling `.polars(lazy=True)` on an empty input in this scenario can trigger a `BinderException`. To handle this, check whether the input is empty before using the lazy API:

```python
from transforms.api import transform, incremental, Input, Output


@incremental()
@transform.using(
    my_output=Output('/path/to/output'),
    my_input=Input('/path/to/input'),
)
def compute(ctx, my_output, my_input):
    if ctx.is_incremental and my_input.polars().is_empty():
        return
    df = my_input.polars(lazy=True)
    my_output.write_table(df)
```

For more details on this known limitation, see the [incremental transforms](/docs/foundry/transforms-python/incremental-overview/#example-non-incremental-and-incremental-transforms) documentation.

## When to use lazy APIs

:::callout{theme="neutral"}
To fully leverage Polars optimizations in lazy compute, your foundry dataset is exposed using an internal object store proxy, so queries will only load the necessary data. Since Polars in eager mode does not have the same optimizations, your entire dataset is prefetched to disk when `lazy=False`.
:::

Consider the following points to decide when to enable lazy execution.

* **Use lazy execution (`lazy=True`) in the following situations:**
  * You are working with large datasets or complex transformation pipelines.
  * You want to benefit from query optimizations such as filter pushdown, predicate pushdown, projection pushdown, or streaming.
  * You have multiple chained operations and want Polars to optimize execution order.
  * You need to process data that does not fit into memory.
* **Use eager execution (`lazy=False`) in the following situations:**
  * You are prototyping or exploring data transformations step by step.
  * You are debugging a complex pipeline and want more predictable behavior.
