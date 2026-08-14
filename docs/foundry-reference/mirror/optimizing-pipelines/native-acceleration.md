<!-- source: https://palantir.com/docs/foundry/optimizing-pipelines/native-acceleration/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Native acceleration

You can improve Spark's performance by enabling native acceleration with [Velox ↗](https://github.com/facebookincubator/velox).

Native acceleration is a technique that leverages low-level hardware optimizations to improve the performance of batch jobs. These performance gains are achieved by shifting compute from Java Virtual Machine (JVM) languages to native languages, such as C++, which are compiled down to machine code and run directly on the hardware of the machine. By using platform-specific features, native acceleration aims to significantly reduce the time needed to process large-scale data workloads in order to speed up job execution and improve resource utilization.

Native acceleration is available for [Python transforms](/docs/foundry/transforms-python-spark/velox-overview/) and [Pipeline Builder](/docs/foundry/pipeline-builder/management-build-settings/).

## Build analysis

You can conduct basic analysis of a natively accelerated build in the [Spark Details](/docs/foundry/code-repositories/module-pinning/) page. Under the **Query Plan** tab, select **Physical Plan**; you will see something like the following:

```
== Physical Plan ==
AdaptiveSparkPlan
+- == Final Plan ==
   Execute InsertIntoHadoopFsRelationCommand
   +- WriteFiles
      +- CollectMetrics
         +- VeloxColumnarToRowExec
            +- ^ ProjectExecTransformer
               +- ^ InputIteratorTransformer
                  +- ^ InputAdapter
                     +- ^ RowToVeloxColumnar
                        +- ^ HashAggregate
                           +- ^ VeloxColumnarToRowExec
                              +- ^ AQEShuffleRead
                                 +- ^ ShuffleQueryStage
                                    +- ColumnarExchange
                                       +- ^ ProjectExecTransformer
                                          +- ^ RowToVeloxColumnar
                                             +- * ColumnarToRow
                                                +- BatchScan parquet
```

While broadly similar to a conventional Spark query plan, you will notice a few key differences. Instead of the `ProjectExec` node, there is a `ProjectExecTransformer`. This means that the operation will be executed natively in the Velox query engine. All offloaded nodes of the query plan will be marked with `^` symbol in the tree. Blocks of native execution are sandwiched by `RowToVeloxColumnar` and `VeloxColumnarToRowExec`. These nodes are responsible for converting Spark datasets to Arrow DataFrames and vice-versa. This serialization/deserialization has a significant cost.

There are generally two patterns which indicate poor native acceleration performance:

* A small percentage of nodes executed natively, as indicated by the `^` symbol.
* A large number of `RowToVeloxColumnar` and `VeloxColumnarToRowExec` nodes resulting in high serialization overheads.

This analysis can be helpful if performance is not as expected. Small changes to pipelines can have a large impact on the amount of compute that is offloaded. Features like [checkpoints](/docs/foundry/pipeline-builder/management-checkpoints/) can be used to manually group together chunks of a build that can all be executed natively.

## Implementation and architecture of native acceleration

Foundry’s implementation of native acceleration is built upon the [Apache Gluten ↗](https://github.com/apache/incubator-gluten) project. Foundry native acceleration leverages the [Velox ↗](https://github.com/facebookincubator/velox) query engine to accelerate Spark jobs at runtime. Velox is written in C++ and is [designed explicitly with database acceleration in mind ↗](https://research.facebook.com/publications/velox-metas-unified-execution-engine/), providing a developer API to run operator-level operations on [Arrow DataFrames ↗](https://arrow.apache.org/). Gluten provides the necessary "glue" to bind the Spark runtime with Velox.

In this setup, a pipeline first generates a Spark query plan as in a normal build (one without native acceleration). Additional optimization rules are then applied to the plan in order to identify whether parts of the query can be run with Velox. This decision is based on whether Velox has an equivalent implementation and whether a mapping for the implementation exists in Gluten. The query can be offloaded at the operator-level: this corresponds roughly to SQL statements like `SELECT`, `FILTER`, or `JOIN`. Any part of the query plan that can be offloaded is marked at this stage.

Once the planning step is complete, the query is executed through the normal Spark engine. This means all task scheduling, executor orchestration, and lifecycle management proceed as normal. The difference comes when an executor reaches part of the query plan that has been marked for native execution. If this occurs, instead of calling the default implementations in Spark, the Velox implementations are invoked.

This architecture is particularly advantageous because it supports queries where not all computations can be done with Velox. This is because the offload decision is made at the operator level rather than for the entire plan. The number of supported operators is constantly growing, but user-authored code like [UDFs](/docs/foundry/transforms-java/user-defined-functions/) can never be offloaded as a native implementation does not exist.

[View the full list of supported operators and expressions ↗](https://github.com/apache/incubator-gluten/blob/main/docs/velox-backend-support-progress.md)

## Why is native acceleration faster?

Spark is written in Scala, a JVM language, and contains many optimizations such as [code generation ↗](https://spark.apache.org/docs/latest/sql-performance-tuning.html#whole-stage-codegen) to improve its performance. Further, the JVM itself contains optimizations such as the [C2 Compiler ↗](https://openjdk.org/groups/hotspot/docs/RuntimeOverview.html) that aim to take advantage of as many platform-specific features as possible. However, native languages such as C++ continue to offer better performance for three basic reasons:

* **Compile-time optimizations:** While Java and Scala are compiled into bytecode, which is then executed by the JVM, native languages like C++ are compiled directly into machine code. This allows the C++ compiler to perform extensive optimizations at compile-time that significantly reduce runtime overhead. In contrast, JVM languages rely on Just-In-Time (JIT) compilation, which occurs during execution and may not achieve the same level of optimization because it has to balance the time spent on compilation with the need to start running quickly.
* **No garbage collection (GC):** In C++, memory management is handled manually, which eliminates the overhead associated with garbage collection (GC). In JVM languages, the GC process can introduce unpredictable pauses and overhead that can impact performance, especially in memory-intensive applications.
* **Direct hardware access and availability of vectorization APIs:** C++ provides direct access to hardware features and low-level system resources, enabling developers to leverage platform-specific optimizations and vectorization APIs such as SSE, AVX, and other SIMD (Single Instruction Multiple Data) instructions. This direct access allows for fine-tuned performance optimizations that are not as easily achievable in JVM languages, where the abstraction layer may prevent the same level of hardware interaction.

## Memory configuration considerations for native acceleration

Running Spark with native acceleration in Foundry requires a slightly different configuration from normal batch pipelines. Spark supports performing some operations with [off-heap memory ↗](https://spark.apache.org/docs/latest/configuration.html#:~\:text=1.6.0-,spark.memory.offHeap.enabled,-false). Off-heap memory is memory that is not managed by the JVM, cutting out GC overhead and leading to better performance. By default, we do not enable off-heap memory in Foundry, as doing so can introduce additional maintenance costs for pipelines. Enabling off-heap memory is necessary for native acceleration since DataFrames modified by Velox must be off-heap to be accessible by the native process. Foundry still requires sufficient on-heap memory for everything except Velox data transformations (for instance, orchestration, scheduling, and build management code still run in the JVM), but ideally most work will now be performed off-heap. Configuring a pipeline to use native acceleration introduces additional maintenance costs in balancing on-heap and off-heap memory.
