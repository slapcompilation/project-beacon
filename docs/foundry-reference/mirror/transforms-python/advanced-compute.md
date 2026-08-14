<!-- source: https://palantir.com/docs/foundry/transforms-python/advanced-compute/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Advanced single-node compute options

The basic principle of the following integrations is that you can access [tabular Foundry datasets](/docs/foundry/data-integration/datasets/) in multiple formats, such as a pandas DataFrame, Arrow Table, Polars DataFrame, and even as raw Parquet or CSV files. This is also shown in the [transforms overview](/docs/foundry/transforms-python/transforms/#work-with-varied-data-formats). When saving tables from memory to Foundry, we can pass them in any of the formats in which they have been read.

## Working with Apache DataFusion

Sometimes, it is easier to cut out the data deserialization step and directly pass the raw underlying dataset files to our compute engine. We can get the path to the files on disk, which get downloaded on-demand by calling `my_input.path()`. When it comes to writing raw files back to Foundry, we have two limitations to keep in mind:

* Only Parquet files can be stored in Foundry datasets through this API.
* Files must be placed in the folder located at the value of `my_output.path_for_write_table`.

When both criteria are met, we can call `write_table` with the path to this folder, like so:

```python
my_output.write_table(my_output.path_for_write_table)
```

To see this in action, consider the following example demonstrating how to use [DataFusion ↗](https://arrow.apache.org/datafusion-python/user-guide/common-operations/basic-info.html) in the platform.

```python
import datafusion
from datafusion import lit
from datafusion.functions import col, starts_with
from transforms.api import transform, Output, Input


@transform.using(my_input=Input('my-input'), my_output=Output('my-output'))
def my_datafusion_transform(my_input, my_output):
    ctx = datafusion.SessionContext()
    table = ctx.read_parquet(my_input.path())
    my_output.write_table(
        table
        .filter(starts_with(col("name"), lit("John")))
        .to_arrow_table()
    )
```

## Using cuDF

You can also achieve integration through the use of `pandas.DataFrame`. The following snippet shows an instance using [cuDF ↗](https://github.com/rapidsai/cudf) in a lightweight transform. This will essentially run pandas code in a highly parallelized manner on the GPU where possible.

```python
@transform.using(
    my_input=Input('my-input'),
    my_output=Output('my-output')
).with_resources(
    cpu_cores=4,
    memory_gb=32,
    gpu_type='NVIDIA_T4'
)
def my_cudf_transform(my_input, my_output):
    import cudf  # Only import CUDF at runtime, not during CI
    df = cudf.from_pandas(my_input.pandas()[['name']])
    filtered_df = df[df['name'].str.startswith('John')]
    sorted_df = filtered_df.sort_values(by='name')
    my_output.write_table(sorted_df)
```

:::callout{theme="normal"}
The above snippet assumes that your Foundry enrollment is equipped with an NVIDIA T4 GPU and it is available to your project through a [resource queue](/docs/foundry/resource-management/resource-queues/#use-gpus).
:::

## GPU-accelerated Polars with cuDF

:::callout{theme="neutral"}
Your Foundry enrollment must be equipped with a supported NVIDIA GPU, and it must be available to your project through a [resource queue](/docs/foundry/resource-management/resource-queues/#use-gpus) to use this feature. See [GPU provisioning](/docs/foundry/transforms-python/configure-resources/#gpu-provisioning) for the list of available GPU types.
:::

You can accelerate [Polars lazy API](/docs/foundry/transforms-python/polars-lazy/) queries on GPUs using [`cudf-polars` ↗](https://docs.rapids.ai/api/cudf/stable/cudf_polars/), a GPU-backed execution engine for Polars. This allows you to run existing Polars lazy API queries on GPUs with minimal code changes by passing `pl.GPUEngine()` to the `collect()` call. For details on supported operations and performance characteristics, see the [Polars GPU support documentation ↗](https://docs.pola.rs/user-guide/gpu-support/).

:::callout{theme="warning"}
GPU-accelerated collection currently only supports `collect()`, which fully materializes results in memory. Streaming operations such as `sink_parquet()` are not yet supported. Ensure that your output data fits in available GPU and system memory.
:::

### Setup

To use GPU acceleration for the Polars lazy API, add the `cudf-polars` package to the `run` requirements in your `conda_recipe/meta.yaml` file. For details on adding packages, refer to the [Python libraries documentation](/docs/foundry/transforms-python/use-python-libraries/#discover-and-use-python-libraries).

```yaml
requirements:
  run:
    - python
    - transforms {{ PYTHON_TRANSFORMS_VERSION }}
    - cudf-polars
```

Next, request a GPU in your transform by chaining `.with_resources()` onto your decorator:

```python
from transforms.api import transform, Output, Input

@transform.using(
    output=Output("/Users/jsmith/output"),
    my_input=Input("/Users/jsmith/input"),
).with_resources(
    gpu_type="NVIDIA_T4",
    memory_gb=32,
)
def compute(output, my_input):
    ...
```

### Writing with the Polars GPU engine

Build your query using the standard Polars lazy API, then pass `engine="gpu"` to `write_table()` to collect and write the result using the GPU:

```python
import polars as pl
from transforms.api import transform, Output, Input

@transform.using(
    output=Output("/Users/jsmith/output"),
    my_input=Input("/Users/jsmith/input"),
).with_resources(
    gpu_type="NVIDIA_T4",
    memory_gb=32,
)
def compute(output, my_input):
    lf = my_input.polars(lazy=True)

    result = (
        lf.with_columns(
            (pl.col("a") * pl.col("b")).alias("product"),
            (pl.col("a").pow(2) + pl.col("b").pow(2)).sqrt().alias("norm"),
        )
        .group_by("category")
        .agg(
            pl.col("product").sum().alias("total_product"),
            pl.col("norm").mean().alias("mean_norm"),
            pl.len().alias("n"),
        )
        .sort("total_product", descending=True)
    )

    output.write_table(result, engine="gpu")
```

The GPU engine only supports a subset of Polars operations. For the full list, see the [Polars GPU support documentation ↗](https://docs.pola.rs/user-guide/gpu-support/). By default, unsupported queries silently fall back to the CPU engine. To raise an error instead, collect manually with `raise_on_fail=True` and pass the resulting DataFrame to `write_table()`:

```python
df = lf.collect(engine=pl.GPUEngine(raise_on_fail=True))
output.write_table(df)
```
