<!-- source: https://palantir.com/docs/foundry/code-repositories/compute-usage/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Compute usage with Code Repositories

Running builds in Code Repositories requires the use of Foundry compute, a resource measured in compute-seconds. This documentation details how builds use compute and provides information about investigating and managing compute usage in the product.

When running a [transforms build](/docs/foundry/data-integration/builds/) of one or more [datasets](/docs/foundry/data-integration/datasets/), Foundry pulls the transform logic into its serverless compute cluster and executes the code. The length and size of the build depends on the complexity of the code, the size of the input and output datasets, and the [Spark computation profile](/docs/foundry/code-repositories/spark-profiles/) set on the code.

The execution of code on input datasets requires Foundry compute (measured in [Foundry compute-seconds](/docs/foundry/resource-management/usage-types/)) when running the parallelized compute and Foundry storage when the outputs of the transformation are written to Foundry Storage. The act of writing code does not incur compute usage; only the building of datasets incurs compute usage.

## Measuring Foundry Compute

The transforms engine powering Code Repositories uses parallel compute on the backend, most commonly in the Spark scalable computing framework. Transformations in Code Repositories are measured in the total number of Foundry *compute-seconds* that are used by the job during its runtime. These compute-seconds are measured during the entire duration of the job, which includes the time taken to read from the input datasets, execute the code (including operations such as I/O waits), and writing the output datasets back to Foundry.

You can configure transformations to make use of parallel computation. Compute-seconds are a measure of compute runtime, not wall clock time, and therefore parallel transforms will incur multiple compute-seconds per wall clock second. For a detailed breakdown on how parallelized compute is measured for Foundry compute-seconds for jobs in Code Repositories, review the [examples below](#calculating-foundry-compute-usage).

When paying for Foundry usage, the default usage rates are the following:

| vCPU / GPU | Usage Rate |
| --- | --- |
| vCPU | 1 |
| T4 GPU | 1.2 |
| V100 GPU | 3 |
| A100 GPU | 1.3 |
| A10G GPU | 1.5 |
| L4 GPU | 2.1 |
| H100 GPU | 4.7 |

If you have an enterprise contract with Palantir, contact your Palantir representative before proceeding with compute usage calculations.

## Investigating Foundry Compute usage from Code Repositories

Usage information can be found in the [Resource Management Application](/docs/foundry/resource-management/overview/), which allows drill-downs on usage metrics.

While builds are the drivers of Foundry Compute usage, that usage is recorded against the long-lived resource to which it is associated. In the case of dataset transformations, the resource is the dataset (or set of datasets) materialized by the job. You can view the timeline of usage on a dataset in the dataset details tab under **Resource usage metrics**.

Note that for transformations that produce multiple output datasets, the compute usage is equally distributed across all the datasets. For example, if a transformation job creates two datasets, one of which has five rows and the other one five million rows, the number of Foundry compute-seconds will be equally distributed between the two.

## Understanding drivers of Foundry Compute usage

Unless canceled early, transformations in Code Repositories will run until all logic is run on all data and the outputs are written back to Foundry. The two main factors that affect this runtime are (1) the size of the input data and (2) the complexity of computational operations performed by the transformation logic.

* Jobs with larger input data sizes will require more compute than jobs with smaller input data sizes if they have the same logic. For example, a job that performs column processing on 100GB of data will use more Foundry compute-seconds than a job performing the same processing on 10GB of data.
* Jobs with that perform more complex operations on data will require more compute than jobs that perform comparatively fewer operations. This is sometimes known as "job complexity.”
  * As a basic example, consider the number of operations between two mathematical operations, `5 * 5` and `5!`. `5 * 5` is a single multiplication operation. `5!` is equivalent to `5 * 4 * 3 * 2 *1` (four multiplication operations), which is double the complexity of the `5 * 5` example. As jobs get more complex with tasks such as aggregations, joins, or machine learning algorithms, the number of operations a job must complete on the data can grow.

## Managing Foundry Compute usage with Code Repositories

For each job, you can review the underlying compute metrics that drove the performance and compute usage of the job. For more details, review [Understanding Spark Details](/docs/foundry/optimizing-pipelines/understand-spark-details/#getting-to-spark-details).

In a job, [Foundry compute-seconds](/docs/foundry/resource-management/usage-types/) are driven by the size and number of parallelized executors. Both of these settings are fully configurable per job. Review the [Spark computation profile](/docs/foundry/code-repositories/spark-profiles/) documentation for details on how this is set per job. The size of executors is governed by their memory and vCPU counts. Increased vCPU and increased memory per executor will increase the compute-seconds incurred by that executor.

The number of simultaneous tasks is driven by the configured executor counts and their corresponding number of vCPUs. If no configuration overrides are specified, the transformation will use a default Spark profile. Foundry storage for resulting datasets is driven by the size of the dataset being created.

In the end, jobs with different logic can accomplish the same outcome with very different numbers of operations.

### Optimizing code to manage usage

There are a number of ways to optimize your code and manage the compute-seconds your jobs use. This section provides links to more information about commonly-used optimization techniques.

* Spark, the distributed cluster-computing framework adopted by Foundry for most types of code repository batch compute, allows for a variety of optimization techniques. [Learn more about optimizing Spark.](/docs/foundry/optimizing-pipelines/spark-concepts/)
* In Spark, you can optimize partitioning to expedite builds. The optimal number of partitions depends on the number of rows, the number of columns, the columns’ type, and the content. We recommend an approximate ratio of one partition for every 128 MB of dataset size.
* Incremental computation is an efficient method of performing transforms to generate an output dataset. By leveraging the build history of a transform, incremental computation avoids the need to recompute the entire output dataset every time a transform is run.
  * [Learn more about incremental transforms in Python.](/docs/foundry/transforms-python/incremental-overview/)
  * [Learn more about incremental transforms in Java.](/docs/foundry/transforms-java/incremental-transforms/)
* Especially for small-to-medium-sized datasets, there are several compute engines other than Spark that consistently surpass Spark in performance in benchmarks for single-node applications. Consequently, using these alternatives for running your pipelines can lead to increased processing speed and reduced compute consumption. To fully capitalize on these options, we advise becoming acquainted with [Lightweight transforms](/docs/foundry/transforms-python/compute-engines/).
* If your builds are orchestrated using [Schedules](/docs/foundry/data-integration/schedules/), we recommend reading our [scheduling best practices](/docs/foundry/building-pipelines/scheduling-best-practices/) to optimize costs.

## Calculating Foundry Compute usage

### Usage example 1: Standard memory

This example demonstrates how Foundry Compute is measured for a statically-allocated job with a standard memory request.

```
Driver profile:
    vCPUs: 1
    GiB_RAM: 6
Executor profile:
    vCPUs: 1
    GiB_RAM: 6
    Count: 4
Total Job Wall-Clock Runtime: 
    120 seconds



Calculation
driver_compute_seconds = max(num_vcpu, GiB_RAM/7.5) * num_seconds
                       = max(1vcpu, 6gib/7.5gib) * 120sec
                       = 120 compute-seconds

executor_compute_seconds = num_executors * max(num_vcpu, GiB_RAM/7.5) * num_seconds 

                         = 4 * max(1, 6/7.5) * 120sec 
                         = 480 compute-seconds

total_compute_seconds = 120 + 480 = 600 compute-seconds 
```

### Usage example 2: Large memory

This example demonstrates how Foundry Compute is measured for a statically-allocated job with a larger memory request.

```
Driver Profile:
    vCPUs: 2
    GiB_RAM: 6
Executor profile:
    vCPUs: 1
    GiB_RAM: 15
    Count: 4
Total Job Wall-Clock Runtime: 
    120 seconds



Calculation:
driver_compute_seconds = max(num_vcpu, GiB_RAM/7.5) * num_seconds
                       = max(2vcpu, 6gib/7.5gib) * 120sec
                       = 240 compute-seconds

executor_compute_seconds = num_executors * max(num_vcpu, GiB_RAM/7.5) * num_seconds 
                         = 4 * max(1, 15/7.5) * 120sec 
                         = 960 compute-seconds

total_compute_seconds = driver_compute_seconds + executor_compute_seconds
                      = 240 + 960 = 1200 compute-seconds
```

### Usage example 3: Dynamic executor counts

This example demonstrates how Foundry Compute is measured for a dynamically-allocated job, where some job execution time is performed with two executors, and the rest of the job time is performed with four executors.

```
Driver Profile:
    vCPUs: 2
    GiB_RAM: 6
Executor profile:
    vCPUs: 1
    GiB_RAM: 6
    Count: 
        min: 2
        max: 4
Total Job Wall-Clock Runtime: 
    120 seconds:
        2 executors: 60 seconds
        4 executors: 60 seconds



Calculation:
driver_compute_seconds = max(num_vcpu, GiB_RAM/7.5) * num_seconds
                       = max(2vcpu, 6gib/7.5gib) * 120sec
                       = 240 compute-seconds

# Calculate compute seconds for job time with 2 executors
2_executor_compute_seconds = num_executors * max(num_vcpu, GiB_RAM/7.5) * num_seconds 
                           = 2 * max(1, 6/7.5) * 60sec 
                           = 120 compute-seconds 

# Calculate compute seconds for job time with 4 executors
4_executor_compute_seconds = num_executors * max(num_vcpu, GiB_RAM/7.5) * num_seconds 
                           = 4 * max(1, 6/7.5) * 60sec 
                           = 240 compute-seconds
                         

total_compute_seconds = driver_compute_seconds + 2_executor_compute_seconds + 4_executor_compute_seconds
                      = 240 + 120 + 240 = 600 compute-seconds
```

### Usage example 4: GPU compute

This example demonstrates how Foundry GPU Compute is measured for a statically-allocated job.

```
Driver profile:
    T4 GPU: 1
Executor profile:
    T4 GPU: 1
    Count: 4
Total Job Wall-Clock Runtime: 
    120 seconds


Calculation:
driver_compute_seconds = num_gpu * gpu_usage_rate * num_seconds
                       = 1gpu * 1.2 * 120sec
                       = 144 compute-seconds

executor_compute_seconds = num_executors * num_gpu * gpu_usage_rate * num_seconds 
                         = 4 * 1 * 1.2 * 120sec 
                         = 576 compute-seconds

total_compute_seconds = 144 + 576 = 720 compute-seconds 
```
