<!-- source: https://palantir.com/docs/foundry/transforms-python/compute-engines/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Compute engine selection

Python transforms support multiple query engines to handle different data processing needs. Choosing the right engine ensures optimal performance, cost efficiency, and developer productivity for your use case.

The available query engines are [DuckDB ↗](https://duckdb.org/), [pandas ↗](https://pandas.pydata.org/docs/), [Polars ↗](https://docs.pola.rs/), and [Spark ↗](https://spark.apache.org/sql/). These all have Python libraries that enable data manipulation with simple and intuitive APIs.

DuckDB, Pandas and Polars are available through our standard, single-node compute offering also known as [`lightweight`](/docs/foundry/transforms-python/transforms/). Spark can be used for distributed compute approaches. For more information refer to the [PySpark](/docs/foundry/transforms-python-spark/overview/) documentation.

## Feature support comparison

The following table shows Foundry feature availability across compute paradigms for Python transforms. For a comparison between Pipeline Builder compute engines see [Pipeline Type Support Comparison](/docs/foundry/building-pipelines/create-faster-pipeline-pb/#pipeline-type-support-comparison)

| Feature                                                                                                 | Single node (Lightweight)                                                                                                                                                                                                  | Distributed (Spark)     |
|---------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------|
| [Incremental transforms](/docs/foundry/transforms-python/incremental-overview/)                                                     | ✓                                                                                                                                                                                                                          | ✓                       |
| [External transforms](/docs/foundry/data-connection/external-transforms/)                                        | ✓                                                                                                                                                                                                                          | ✓                       |
| [Palantir-provided LLMs API: snapshot](/docs/foundry/transforms-python-spark/palantir-provided-models/)                 | ✓                                                                                                                                                                                                                          | ✓                       |
| [Palantir-provided LLMs API: incremental](/docs/foundry/transforms-python-spark/palantir-provided-models/)              | ✓                                                                                                                                                                                                                          | ✗                       |
| [Trained model inputs](/docs/foundry/integrate-models/transform-model-input/)                 | ✓                                                                                                                                                                                                                          | ✓                       |
| [Trained model outputs](/docs/foundry/model-integration/tutorial-train-code-repositories/)                 | ✓                                                                                                                                                                                                                          | ✗                       |
| [Media set API: snapshot](/docs/foundry/transforms-python/media-sets/)                                                              | ✓                                                                                                                                                                                                                          | ✓                       |
| [Media set API: incremental](/docs/foundry/transforms-python/media-sets/)                                                           | ✓                                                                                                                                                                                                                          | ✓                       |
| [Abort transactions](/docs/foundry/transforms-python/abort-transactions/)                                                           | ✓                                                                                                                                                                                                                          | ✓                       |
| [Dataset unmarking](/docs/foundry/building-pipelines/remove-markings/) <sup>1</sup>                               | ✓ (Except [`sever_permissions`](/docs/foundry/api-reference/transforms-python-library/api-output/#transforms.api.Output))                                                                                                                                                                                                                           | ✓                       |
| [Source unmarking](/docs/foundry/building-pipelines/remove-markings/)                                            | ✗                                                                                                                                                                                                                          | ✓                       |
| Data expectations                                                                                       | [Limited](/docs/foundry/transforms-python/data-expectations-reference/)                                                                                                                                                                                | ✓                       |
| [Tables API](/docs/foundry/transforms-python/tables-api/)                                                                           | [Compute pushdown only](/docs/foundry/transforms-python/tables-compute-pushdown/)                                                                                                                                                                      | In-Foundry compute only |
| Read output enforcing schema <sup>2</sup>                                                                | ✗                                                                                                                                                                                                                          | ✓                       |
| [`Allowed run duration` parameter](/docs/foundry/api-reference/transforms-python-library/api-configure/#transforms.api.configure)       | ✗                                                                                                                                                                                                                          | ✓                       |
| [`Run as user` parameter `(deprecated)`](/docs/foundry/api-reference/transforms-python-library/api-configure/#transforms.api.configure) | ✗                                                                                                                                                                                                                          | ✓                       |
| [Resource metrics](/docs/foundry/transforms-python/metrics/)                                                                        | ✓                                                                                                                                                                                                                          | ✓                       |

<sup>1</sup>      Single node transforms only support [`stop_propagating` and `stop_requiring`](/docs/foundry/api-reference/transforms-python-library/api-input/#transforms.api.Input). [`sever_permissions`](/docs/foundry/api-reference/transforms-python-library/api-output/#transforms.api.Output) are not supported. <br><sup>2</sup>      PySpark transforms allow you read data written to an incremental output with a specific schema. This is necessary during the first dataset transaction as no schema will be committed. It is not supported in single node transforms.

## Available query engines

### Pandas

**Best for:** Quick iteration, exploratory analysis, and small datasets

[Pandas ↗](https://pandas.pydata.org/docs/) is a common data manipulation library in the Python ecosystem. It excels at rapid prototyping and provides an extensive ecosystem of compatible libraries. Use pandas when getting started with a new transform, or when your team needs to move quickly with familiar tools.

**Key characteristics:**

* Immediate feedback during development
* Extensive documentation and community support
* Rich functionality for time series and statistical operations
* Single-threaded execution model

### Polars (Recommended)

**Best for:** Production data pipelines and medium-scale data processing

[Polars ↗](https://docs.pola.rs/) should be your default choice for production transforms. Built on Apache Arrow with a Rust core, it delivers excellent performance through columnar storage and lazy evaluation. Polars combines the ease of DataFrame operations with the performance needed for production workloads.

**Key characteristics:**

* Automatic query optimization through lazy evaluation
* Multi-threaded execution on single nodes
* Memory-efficient columnar storage
* Predictable performance characteristics

### DuckDB

**Best for:** Medium-scale data with tight latency bounds

[DuckDB ↗](https://duckdb.org/) is a highly performant single-node SQL query engine optimized for analytical workloads. DuckDB is particularly well-suited for medium-to-large scale data processing tasks that require low latency and efficient resource usage. However, DuckDB lacks a Python DataFrame API, instead requiring users to write raw SQL queries for data manipulation.

**Key characteristics:**

* Automatic query optimization through lazy evaluation
* Automatic memory management with spill-to-disk
* Processes raw SQL strings rather than a DataFrame API

### Spark

**Best for:** Large-scale data processing and organizational data foundations

[Spark ↗](https://spark.apache.org/sql/) is designed for distributed computing at scale. While it has higher overhead for small operations, it is the only option when your data exceeds single-node capacity or when building critical organizational datasets that require maximum scalability.

**Key characteristics:**

* Distributed processing across multiple nodes
* Automatic memory management with spill-to-disk
* Battle-tested at petabyte scale
* Catalyst optimizer for complex query planning

## Choosing the right engine

:::callout{theme="success"}
The size recommendations below are intended as a general rule of thumb and do not apply to all queries. For the right shapes of transforms, Lightweight engines can process even terabyte-scale inputs on a single node. Refer to the [Polars lazy API](/docs/foundry/transforms-python/polars-lazy/) documentation on larger-than-memory data transformations for more information on how to use Polars streaming. Queries that do not require all data to be loaded into memory at once will scale to arbitrary size on a single node.
:::

We recommend starting with Polars as your default choice for production transforms. You can switch to pandas when you need quick iteration, or specific ecosystem libraries. DuckDB is an excellent choice for SQL APIs or maximization of single-node performance. Move to Spark *only* when data scale demands it, typically at more than 50 GB and when you cannot use optimizations such as [filter pushdown](/docs/foundry/transforms-python/polars-lazy/#filter-pushdown).

| Characteristic                     | Pandas       | Polars             | DuckDB           | PySpark       |
|------------------------------------|--------------|--------------------|------------------|---------------|
| Optimal (uncompressed) data size   | < 1GB        | 1-50GB             | 1-50GB           | > 50GB        |
| Optimal number of rows<sup>\*</sup> | < 1 million  | 1-200 million      | 1-200 million    | > 200 million |
| Startup overhead                   | Minimal      | Minimal            | Minimal          | Significant   |
| Memory efficiency                  | Poor         | Excellent          | Excellent        | Good          |
| Syntax                             | Python Dataframes | Python Dataframes  | SQL<sup>\*\*</sup> | Python Dataframes |
| Processing speed (small data)      | Good         | Excellent          | Excellent        | Slow          |
| Processing speed (medium data)     | Poor         | Excellent          | Excellent        | Fast          |
| Processing speed (large data)      | Not suitable | Variable           | Variable         | Excellent     |
| Parallel execution                 | No           | Single-node        | Single-node      | Distributed   |
| Memory spilling                    | No           | Limited            | Automatic        | Automatic     |

<sup>\*</sup> The number of rows tolerable to each query engine will vary greatly depending on the schema. These numbers are given as a rough guide for common cases.

<sup>\*\*</sup> Open-source adapter libraries exist (Ibis, SQLFrame).

## Migrate from Spark to single node compute

A large portion of existing transforms use Spark, since it has been supported in Python transforms for longer than single node engines. Many of these pipelines could run faster or consume fewer resources if migrated to a single node compute engine. However, it can be difficult to tell how much of an impact this migration will have, and translation can be an expensive process. To get an initial indication of single node performance, we recommend [migrating pipelines to DuckDB with SQLFrame](/docs/foundry/transforms-python/duckdb/#migrate-a-spark-transform-to-duckdb-with-sqlframe) before committing to full translations.
