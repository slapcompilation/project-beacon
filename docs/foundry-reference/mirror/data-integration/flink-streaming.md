<!-- source: https://palantir.com/docs/foundry/data-integration/flink-streaming/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Flink fundamentals

Apache Flink is a distributed computation engine capable of handling unbounded datasets with low latency, allowing it to handle common streaming workflows. Foundry streaming uses Flink as the underlying engine to execute user code and other in-platform streaming applications such as hydrating the Ontology in real time and streaming time series ingestion.

In order to understand whether you need additional job configuration for your streaming use case, it is helpful to have some understanding of how Flink works.

More detailed documentation about Flink can be found at the [Flink homepage ↗](https://flink.apache.org/).

## Flink jobs

All streaming jobs are described as a series of operations acting on a set of data sources, and which write results to a data sink. These operations include things like aggregations, joins, and other row-level actions like string parsing or arithmetic. Each operation is represented by Flink as the **Operator** abstraction. In Flink, sources and sinks are also described by operators.

Flink jobs are represented internally in terms of “job graphs” or "logical graphs.” Job graphs are directed graphs with nodes made up of operators and where the edges define the relationships between operators. When a job is submitted to Flink, it creates the job graph. A preview of your Flink job’s job graph is rendered in the **Details** section of jobs in the Foundry Job Tracker.

When actually executing jobs, Flink translates the logical graph into a **physical graph**, a representation of how operators will be executed on the compute runtime. Physical graphs are made of up **tasks**, which are the basic units of work in a Flink job, and which can represent either one instance of an operator or many operators chained together.

## Job Managers and Task Managers

Like Spark, Flink’s runtime architecture includes different types of workers. Where Spark uses the driver to coordinate and manage jobs and executors to perform job tasks, Flink uses **Job Managers** and **Task Managers**, which fulfill roles roughly analogous to Spark drivers and executors.

The Flink Job Manager is responsible for scheduling tasks and allocating resources for tasks, handling finished or failed tasks, coordinating [job checkpoints](/docs/foundry/data-integration/streams/#Checkpointing) and failure recovery, as well as providing programmatic access to job information. Typically there is only one active Job Manager - the leader - at any given time, with backup(s) kept warm in the case of an unrecoverable error.

The Flink Task Manager is responsible for the execution of tasks as well as buffering and exchanging data between streams. There is always at least one Task Manager, but there may be more in order to parallelise stream processing. When Task Managers need to handle very large records they may require additional resources. If your stream has extremely high throughput, you may need to increase your job’s parallelism, which results in increasing the number of Task Managers.

## Job state

While some Flink operations only need to look at single events in isolation, others need to remember information across multiple events. These are [stateful operations](/docs/foundry/pipeline-builder/breaking-changes/). Some examples of stateful operations are:

* **Aggregations:** For example, counting the total number of events over a rolling five minute window, or calculating the running average of all known events.
* **Joins:** The execution engine needs to know about previously-seen events in order to join them with events that are currently been ingested.

The information required for stateful operations is known as *job state*, and is stored by Flink using a state backend. State is managed and stored by Task Managers and coordinated by the Job Manager in the form of [checkpoints](/docs/foundry/data-integration/streams/#checkpointing). When you have a larger state (such as when an aggregation or join has a very large window), your Job Managers and Task Managers may require additional resources.
