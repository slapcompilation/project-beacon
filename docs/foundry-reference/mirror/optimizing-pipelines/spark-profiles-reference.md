<!-- source: https://palantir.com/docs/foundry/optimizing-pipelines/spark-profiles-reference/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Spark profiles reference

This page is a reference of the Spark profiles available in Foundry. Learn more about Spark and profiles here:

* [Spark concepts](/docs/foundry/optimizing-pipelines/spark-concepts/)
* [Apply Spark profiles](/docs/foundry/optimizing-pipelines/apply-spark-profiles/)

## Driver cores

The profiles in this family configure the value of `spark.driver.cores`.

This controls how many CPU cores are assigned to the spark driver. In practice, except in special cases where many spark jobs are running concurrently in the same spark module, this should not need to be overridden.

## Driver memory

The profiles in this family configure the value of `spark.driver.memory`.

This controls how much memory is assigned to the spark driver JVM. This may need to be raised in some situations, for example when collecting large amounts of data back to the driver, or when performing large broadcast joins.

:::callout{theme="neutral"}
This only controls the JVM memory, not the memory available to Python processes. If you are pulling lots of data locally to perform transformation using [Pandas](/docs/foundry/api-reference/transforms-python-library/api-transform-pandas/#transforms.api.transform_pandas), you will need a different profile.
:::

## Executor cores

The profiles in this family configure the value of `spark.executor.cores`.

This controls how many CPU cores are assigned to each spark executor, which in turn controls how many tasks are run concurrently in each executor. In practice this should rarely need to be overridden in normal transforms jobs.

## Executor memory

The profiles in this family configure the value of `spark.executor.memory` and associated settings.

This controls how much memory is assigned to each spark executor JVM. This may need to be raised if the amount of data being processed in each spark task is very large.

:::callout{theme="neutral"}
This memory is shared between all tasks running on the executor (controlled by the Executor Cores profiles).
:::

## Executor memory overhead

The profiles in this family configure the value of `spark.executor.memoryOverhead`.

This controls how much memory is assigned to each container in addition to the spark executor JVM memory. This may need to be raised if your job requires a significant amount of memory outside the JVM.

## Number of executors

The profiles in this family configure the value of `spark.executor.instances` and associated settings.

This controls how many executors are requested to run the job. Increasing this value increases the number of tasks which can run in parallel, therefore increasing performance (provided the job is parallel enough) at the cost of using more resources.

In practice this should only need to be overridden for large jobs with a particular organizational need to run very quickly.

## Dynamic allocation

The profiles in this family configure the value of `spark.dynamicAllocation.enabled`, `spark.dynamicAllocation.minExecutors` and `spark.dynamicAllocation.maxExecutors`.

This controls how many executors are requested to run the job by specifying a range of executors rather than a fixed count. Spark will scale up the number of executors requested up to maxExecutors and will relinquish the executors when they are not needed, which might be helpful when the exact number of needed executors is not consistently the same, or in some cases for speeding up launch times. The module is not guaranteed to receive the number of requested maxExecutors, and given the variable number of executors, performance might differ from a run to another.

In practice this should only need to be overridden for large jobs with a particular understanding of the advantages and disadvantages of dynamic allocation.

## Adaptive query execution

The profiles in this family enable and disable adaptive query execution (AQE).

With AQE enabled, Spark will automatically set the number of partitions at runtime, potentially speeding up your builds. It avoids too few partitions with insufficient parallelism, and too many small partitions with excessive overhead.

AQE aims for a balanced output size of 64 MB per partition. E.g. a total output size of 512 MB will produce around 8 partitions.

You can increase the target size using the file size profiles in this family. Partition sizes of 128MB and larger are recommended if the data written is frequently read, e.g. in Contour analyses.

:::callout{theme="neutral"}
You might want to disable AQE if the total output is small but very time-intensive to compute, for example because of expensive UDFs. In that case AQE can reduce parallelism and slow down your computation.
:::

## Number of cores per task

The profiles in this family configure the value of `spark.task.cpus`.

This controls how many cores are allocated for each task. In practice this should only rarely be overridden. If you want to control the parallelism of your job you should look into [Executor Cores](#executor-cores) instead.

## Arrow

Use these profiles to enable or disable Arrow for conversion between Pandas and PySpark dataframes. To use Arrow, ensure that your Transform depends on the `pyarrow` package.

When calling `spark.createDataFrame()` with a Pandas dataframe or `toPandas()`, Spark has to serialize all rows to
convert them from one format to the other. For large dataframes this is a slow process and can be the bottleneck for
your Transform. When using a Pandas Transform, this serialization happens both when reading and when writing your data.

Arrow is a more efficient serialization format that significantly speeds up this conversion (as reported on the [Arrow website ↗](https://arrow.apache.org/blog/2017/07/26/spark-arrow/)).

## Kubernetes

The profiles in this family control low-level details of how your Spark job is executed.

When using libraries that are not agnostic to CPU architecture of underlying machines, you can use profiles to force the Spark job to run on a specific architecture. Note that some environments only have access to machines with AMD architecture; jobs that use ARM architecture override will not succeed in those environments.

The `KUBERNETES_OPEN_PORTS_ALL` profile enables network communication between Spark executors, which is required for [distributed model training](/docs/foundry/integrate-models/spark-distributed-model-training/).

## Column statistics

This profile enables the computation of per-column statistics including `min`, `max`, and `mean` values. This profile is set to `false` by default, meaning that only per-column `null` counts and dataset-level metrics such as row count will be computed.

## Profile table

| Profile Family | Profile Name | Spark Settings |
| -------------- | ------------ | -------------- |
| Driver Cores | `DRIVER_CORES_SMALL` | `spark.driver.cores: 1` |
| Driver Cores | `DRIVER_CORES_MEDIUM` | `spark.driver.cores: 2` |
| Driver Cores | `DRIVER_CORES_LARGE` | `spark.driver.cores: 4` |
| Driver Cores | `DRIVER_CORES_EXTRA_LARGE` | `spark.driver.cores: 8` |
| Driver Cores | `DRIVER_CORES_EXTRA_EXTRA_LARGE` | `spark.driver.cores: 16` |
| Driver Memory | `DRIVER_MEMORY_SMALL` | `spark.driver.memory: 3g` |
| Driver Memory | `DRIVER_MEMORY_MEDIUM` | `spark.driver.memory: 6g; spark.driver.maxResultSize: 4g` |
| Driver Memory | `DRIVER_MEMORY_LARGE` | `spark.driver.memory: 13g; spark.driver.maxResultSize: 8g` |
| Driver Memory | `DRIVER_MEMORY_EXTRA_LARGE` | `spark.driver.memory: 27g; spark.driver.maxResultSize: 16g` |
| Driver Memory | `DRIVER_MEMORY_EXTRA_EXTRA_LARGE` | `spark.driver.memory: 54g; spark.driver.maxResultSize: 32g` |
| Driver Memory Overhead | `DRIVER_MEMORY_OVERHEAD_SMALL` | `spark.driver.memoryOverhead: 1g` |
| Driver Memory Overhead | `DRIVER_MEMORY_OVERHEAD_MEDIUM` | `spark.driver.memoryOverhead: 2g` |
| Driver Memory Overhead | `DRIVER_MEMORY_OVERHEAD_LARGE` | `spark.driver.memoryOverhead: 4g` |
| Driver Memory Overhead | `DRIVER_MEMORY_OVERHEAD_EXTRA_LARGE` | `spark.driver.memoryOverhead: 8g` |
| Driver Memory Overhead | `DRIVER_MEMORY_OVERHEAD_EXTRA_EXTRA_LARGE` | `spark.driver.memoryOverhead: 16g` |
| Executor Cores | `EXECUTOR_CORES_EXTRA_SMALL` | `spark.executor.cores: 1` |
| Executor Cores | `EXECUTOR_CORES_SMALL` | `spark.executor.cores: 2` |
| Executor Cores | `EXECUTOR_CORES_MEDIUM` | `spark.executor.cores: 4` |
| Executor Cores | `EXECUTOR_CORES_LARGE` | `spark.executor.cores: 6` |
| Executor Cores | `EXECUTOR_CORES_EXTRA_LARGE` | `spark.executor.cores: 8` |
| Executor Memory | `EXECUTOR_MEMORY_EXTRA_SMALL` | `spark.executor.memory: 3g; spark.executor.memoryOverhead: 768m` |
| Executor Memory | `EXECUTOR_MEMORY_SMALL` | `spark.executor.memory: 6g; spark.executor.memoryOverhead: 1536m` |
| Executor Memory | `EXECUTOR_MEMORY_MEDIUM` | `spark.executor.memory: 13g; spark.executor.memoryOverhead: 2g` |
| Executor Memory | `EXECUTOR_MEMORY_LARGE` | `spark.executor.memory: 27g; spark.executor.memoryOverhead: 3g` |
| Executor Memory Off-heap | `EXECUTOR_MEMORY_OFFHEAP_FRACTION_MINIMUM` | `Share of memory to use for off-heap (an “Executor Memory“ profile must be set): 30%` |
| Executor Memory Off-heap | `EXECUTOR_MEMORY_OFFHEAP_FRACTION_LOW` | `Share of memory to use for off-heap (an “Executor Memory“ profile must be set): 50%` |
| Executor Memory Off-heap | `EXECUTOR_MEMORY_OFFHEAP_FRACTION_MODERATE` | `Share of memory to use for off-heap (an “Executor Memory“ profile must be set): 70%` |
| Executor Memory Off-heap | `EXECUTOR_MEMORY_OFFHEAP_FRACTION_HIGH` | `Share of memory to use for off-heap (an “Executor Memory“ profile must be set): 80%` |
| Executor Memory Off-heap | `EXECUTOR_MEMORY_OFFHEAP_FRACTION_MAXIMUM` | `Share of memory to use for off-heap (an “Executor Memory“ profile must be set): 90%` |
| Executor Memory Overhead | `EXECUTOR_MEMORY_OVERHEAD_SMALL` | `spark.executor.memoryOverhead: 1g` |
| Executor Memory Overhead | `EXECUTOR_MEMORY_OVERHEAD_MEDIUM` | `spark.executor.memoryOverhead: 2g` |
| Executor Memory Overhead | `EXECUTOR_MEMORY_OVERHEAD_LARGE` | `spark.executor.memoryOverhead: 4g` |
| Executor Memory Overhead | `EXECUTOR_MEMORY_OVERHEAD_EXTRA_LARGE` | `spark.executor.memoryOverhead: 8g` |
| Executor Count | `KUBERNETES_NO_EXECUTORS` | `spark.kubernetes.local.submission: true; spark.sql.shuffle.partitions: 1` |
| Executor Count | `NUM_EXECUTORS_1` | `spark.executor.instances: 1; spark.dynamicAllocation.maxExecutors: 1` |
| Executor Count | `NUM_EXECUTORS_2` | `spark.executor.instances: 2; spark.dynamicAllocation.maxExecutors: 2` |
| Executor Count | `NUM_EXECUTORS_4` | `spark.executor.instances: 4; spark.dynamicAllocation.maxExecutors: 4` |
| Executor Count | `NUM_EXECUTORS_8` | `spark.executor.instances: 8; spark.dynamicAllocation.maxExecutors: 8` |
| Executor Count | `NUM_EXECUTORS_16` | `spark.executor.instances: 16; spark.dynamicAllocation.maxExecutors: 16` |
| Executor Count | `NUM_EXECUTORS_32` | `spark.executor.instances: 32; spark.dynamicAllocation.maxExecutors: 32` |
| Executor Count | `NUM_EXECUTORS_64` | `spark.executor.instances: 64; spark.dynamicAllocation.maxExecutors: 64` |
| Executor Count | `NUM_EXECUTORS_128` | `spark.executor.instances: 128; spark.dynamicAllocation.maxExecutors: 128` |
| Executor Count | `NUM_EXECUTORS_256` | `spark.executor.instances: 256; spark.dynamicAllocation.maxExecutors: 256` |
| Executor Count | `NUM_EXECUTORS_512` | `spark.executor.instances: 512; spark.dynamicAllocation.maxExecutors: 512` |
| Task CPU Count | `TASK_CPUS_2` | `spark.task.cpus: 2` |
| Task CPU Count | `TASK_CPUS_4` | `spark.task.cpus: 4` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_DISABLED` | `spark.dynamicAllocation.enabled: false` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_ENABLED` | `spark.dynamicAllocation.enabled: true` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_MIN_2` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 2` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_MIN_4` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 4` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_MIN_8` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 8` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_MIN_16` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 16` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_MAX_8` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.maxExecutors: 8` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_MAX_16` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.maxExecutors: 16` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_MAX_32` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.maxExecutors: 32` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_MAX_64` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.maxExecutors: 64` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_MAX_128` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.maxExecutors: 128` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_ENABLED_1_2` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 1; spark.dynamicAllocation.maxExecutors: 2` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_ENABLED_2_4` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 2; spark.dynamicAllocation.maxExecutors: 4` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_ENABLED_4_8` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 4; spark.dynamicAllocation.maxExecutors: 8` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_ENABLED_8_16` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 8; spark.dynamicAllocation.maxExecutors: 16` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_ENABLED_16_32` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 16; spark.dynamicAllocation.maxExecutors: 32` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_ENABLED_32_64` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 32; spark.dynamicAllocation.maxExecutors: 64` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_ENABLED_64_128` | `spark.dynamicAllocation.enabled: true; spark.dynamicAllocation.minExecutors: 64; spark.dynamicAllocation.maxExecutors: 128` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_FAST_SCALE_DOWN` | `spark.dynamicAllocation.executorIdleTimeout: 10s` |
| Dynamic Allocation | `DYNAMIC_ALLOCATION_SLOW_SCALE_UP_2M` | `spark.dynamicAllocation.schedulerBacklogTimeout: 2m` |
| Shuffle Partitions | `SHUFFLE_PARTITIONS_SMALL` | `spark.sql.shuffle.partitions: 20` |
| Shuffle Partitions | `SHUFFLE_PARTITIONS_MEDIUM` | `spark.sql.shuffle.partitions: 200` |
| Shuffle Partitions | `SHUFFLE_PARTITIONS_LARGE` | `spark.sql.shuffle.partitions: 2000` |
| Shuffle Partitions | `SHUFFLE_PARTITIONS_EXTRA_LARGE` | `spark.sql.shuffle.partitions: 20000` |
| Adaptive Query Execution | `ADAPTIVE_ENABLED` | `spark.sql.adaptive.enabled: true` |
| Adaptive Query Execution | `ADAPTIVE_DISABLED` | `spark.sql.adaptive.enabled: false` |
| Adaptive Query Execution | `ADVISORY_PARTITION_SIZE_MEDIUM` | `spark.sql.adaptive.enabled: true; spark.sql.adaptive.shuffle.targetPostShuffleInputSize: 128MB` |
| Adaptive Query Execution | `ADVISORY_PARTITION_SIZE_LARGE` | `spark.sql.adaptive.enabled: true; spark.sql.adaptive.shuffle.targetPostShuffleInputSize: 256MB` |
| RPC Message Size | `RPC_MESSAGE_MAX_SIZE_512M` | `spark.rpc.message.maxSize: 512` |
| RPC Message Size | `RPC_MESSAGE_MAX_SIZE_1G` | `spark.rpc.message.maxSize: 1024` |
| RPC Message Size | `RPC_MESSAGE_MAX_SIZE_MAX` | `spark.rpc.message.maxSize: 2047` |
| Legacy | `LEGACY_ALLOW_UNTYPED_SCALA_UDF` | `spark.sql.legacy.allowUntypedScalaUDF: true` |
| Legacy | `LEGACY_ALLOW_NEGATIVE_DECIMAL_SCALE` | `spark.sql.legacy.allowNegativeScaleOfDecimal: true` |
| Legacy | `LEGACY_ALLOW_HASH_ON_MAPTYPE` | `spark.sql.legacy.allowHashOnMapType: true` |
| Legacy | `LEGACY_NAME_NON_STRUCT_GROUPING_KEY_AS_VALUE` | `spark.sql.legacy.dataset.nameNonStructGroupingKeyAsValue: true` |
| Legacy | `LEGACY_ARRAY_EXISTS_NULL_HANDLING` | `spark.sql.legacy.followThreeValuedLogicInArrayExists: false` |
| Legacy | `LEGACY_ALLOW_AMBIGUOUS_SELF_JOIN` | `spark.sql.analyzer.failAmbiguousSelfJoin: false` |
| Legacy | `LEGACY_TIME_PARSER_POLICY` | `spark.sql.legacy.timeParserPolicy: LEGACY` |
| Legacy | `LEGACY_DATETIME_REBASE_MODE` | `spark.sql.legacy.avro.datetimeRebaseModeInRead: LEGACY; spark.sql.legacy.parquet.datetimeRebaseModeInRead: LEGACY; spark.sql.legacy.avro.datetimeRebaseModeInWrite: LEGACY; spark.sql.legacy.parquet.datetimeRebaseModeInWrite: LEGACY` |
| Legacy | `LEGACY_FROM_DAYTIME_STRING` | `spark.sql.legacy.fromDayTimeString.enabled: true` |
| Legacy | `LEGACY_DATETIME_STRING_COMPARISON` | `spark.sql.legacy.typeCoercion.datetimeToString.enabled: true` |
| Dates & Times | `TIME_PARSER_POLICY_CORRECTED` | `spark.sql.legacy.timeParserPolicy: CORRECTED` |
| Dates & Times | `SPARK_ALLOW_INT96_AS_TIMESTAMP` | `spark.sql.parquet.int96AsTimestamp: true` |
| Miscellaneous | `BUCKET_SORTED_SCAN_ENABLED` | `spark.sql.sources.bucketing.sortedScan.enabled: true` |
| Miscellaneous | `LAST_MAP_KEY_WINS` | `spark.sql.mapKeyDedupPolicy: LAST_WIN` |
| Miscellaneous | `CROSS_JOIN_ENABLED` | `spark.sql.crossJoin.enabled: true` |
| Miscellaneous | `SPECULATIVE_EXECUTION` | `spark.speculation: true` |
| Miscellaneous | `AUTO_BROADCAST_JOIN_DISABLED` | `spark.sql.autoBroadcastJoinThreshold: -1` |
| Miscellaneous | `ALLOW_ADD_MONTHS` | `spark.foundry.sql.allowAddMonths: true` |
| Miscellaneous | `PYSPARK_ROW_FIELD_SORTING_ENABLED` | `spark.executorEnv.PYSPARK_ROW_FIELD_SORTING_ENABLED: true; spark.yarn.appMasterEnv.PYSPARK_ROW_FIELD_SORTING_ENABLED: true; spark.kubernetes.driverEnv.PYSPARK_ROW_FIELD_SORTING_ENABLED: true` |
| Miscellaneous | `PYSPARK_ROW_FIELD_SORTING_DISABLED` | `spark.executorEnv.PYSPARK_ROW_FIELD_SORTING_ENABLED: false; spark.yarn.appMasterEnv.PYSPARK_ROW_FIELD_SORTING_ENABLED: false; spark.kubernetes.driverEnv.PYSPARK_ROW_FIELD_SORTING_ENABLED: false` |
| Miscellaneous | `PYSPARK_ROW_SCHEMA_CORRUPTION_CHECK_DISABLED` | `spark.kubernetes.driverEnv.PYSPARK_CHECK_ROW_SCHEMA_CORRUPTION: false; spark.yarn.appMasterEnv.PYSPARK_CHECK_ROW_SCHEMA_CORRUPTION: false; spark.executorEnv.PYSPARK_CHECK_ROW_SCHEMA_CORRUPTION: false` |
| Miscellaneous | `SPARK_KYRO_REFERENCE_TRACKING_DISABLED` | `spark.kryo.referenceTracking: false` |
| Miscellaneous | `GEOSPARK` | `spark.foundry.build.stats.enabled: false` |
| Miscellaneous | `SPARK_REFERENCE_TRACKING_DISABLED` | `spark.cleaner.referenceTracking: false` |
| Miscellaneous | `ENABLE_COLUMN_STATS` | `spark.foundry.build.stats.enableColumnStats: false` |
| Miscellaneous | `MANAGED_PROFILE` | Enables [automatic profile optimization](/docs/foundry/optimizing-pipelines/managed-profiles/) based on historical job metrics |
| Arrow | `ARROW_ENABLED` | `spark.sql.execution.arrow.enabled: true; spark.sql.execution.arrow.pyspark.enabled: true; spark.sql.execution.arrow.sparkr.enabled: true; spark.sql.execution.arrow.fallback.enabled: true; spark.sql.execution.arrow.pyspark.fallback.enabled: true` |
| Arrow | `ARROW_DISABLED` | `spark.sql.execution.arrow.enabled: false; spark.sql.execution.arrow.pyspark.enabled: false; spark.sql.execution.arrow.sparkr.enabled: false` |
| Kubernetes | `KUBERNETES_CPU_ARCHITECTURE_OVERRIDE_AMD64` | `N/A` |
| Kubernetes | `KUBERNETES_CPU_ARCHITECTURE_OVERRIDE_ARM64` | `N/A` |
| Kubernetes | `KUBERNETES_OPEN_PORTS_ALL` | Enables network communication between Spark executors for [distributed model training](/docs/foundry/integrate-models/spark-distributed-model-training/) |
