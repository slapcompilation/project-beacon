<!-- source: https://palantir.com/docs/foundry/transforms-python-spark/velox-overview/ · mirrored 2026-08-13 from Palantir Foundry docs -->

# Accelerate Spark with Velox

Spark acceleration is a technique that leverages low-level hardware optimizations to improve the performance of Spark jobs. By using platform-specific features, native acceleration aims to significantly reduce the time it takes to process large-scale data workloads, which can result in faster job execution and improved resource utilization.

[Velox ↗](https://facebookincubator.github.io/velox/) is a reusable, high-performance, low-level data processing library that provides a set of primitives for building high-performance data processing systems. It is designed to be used as a foundation for building higher-level data processing systems, and it is used in Foundry to accelerate Spark jobs.

[Read more about native acceleration in Foundry](/docs/foundry/optimizing-pipelines/native-acceleration/).

## Quick start

Spark acceleration can be used on any existing Spark pipeline. You do not need to make any changes to your logic.

To use native acceleration in your Python transform pipeline, you must complete the following:

1. [Upgrade your Python repository](/docs/foundry/code-repositories/repository-upgrades/) to the latest version.
2. Configure an [off-heap memory profile](/docs/foundry/optimizing-pipelines/spark-profiles-reference/).
3. Enable the `VELOX` backend, as shown in the following code snippet:

```python
from transforms.api import configure, ComputeBackend, Input, Output, transform_df


@configure(
    ["EXECUTOR_MEMORY_MEDIUM", "EXECUTOR_MEMORY_OFFHEAP_FRACTION_HIGH"],
    backend=ComputeBackend.VELOX)
@transform_df(
    Output('/Project/folder/output'),
    source_df=Input('/Project/folder/input'),
)
def compute(source_df):
    ...
```

## Configure memory for accelerated Spark

To optimize your natively accelerated Spark project, start by using the `EXECUTOR_MEMORY_OFFHEAP_FRACTION_HIGH` setting for off-heap memory. This memory is used by Velox, which handles some tasks outside the JVM. Observe the performance, and adjust the off-heap memory up or down as needed.

:::callout{neutral}
To use a fractional off-heap profile, you must also set an EXECUTOR\_MEMORY\_X profile. Your job likely already has this.
:::
