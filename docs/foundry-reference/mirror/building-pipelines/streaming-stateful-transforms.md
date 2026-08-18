<!-- source: https://palantir.com/docs/foundry/building-pipelines/streaming-stateful-transforms/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Streaming stateful transformations

Foundry pipelines provide stateful data streaming transformations that enable complex data transform behavior at fast streaming speeds.

## What is state?

In data streaming, a data transformation is **stateful** when each output row may depend on information contained in previously processed rows. The information that persists between rows is called **state**. The state may be accessed and mutated by each row.

An example of a stateful transform is a *sum aggregate transform*. Consider the following sample table, where a *sum aggregate transform* can be used to calculate the number of sensor readings with the value `hot` on each day. More recently streamed rows are higher in the table.

| Day     | SensorReading | Timestamp |
|---------|---------------|-----------|
| Monday  | hot           | 3         |
| Monday  | cold          | 2         |
| Monday  | hot           | 1         |

A stateful sum aggregate transform that computes the live running number of `hot` readings for each day may have output that looks like the following:

| Day     | SensorReading | Timestamp | State   |
|---------|---------------|-----------|---------|
| Monday  | hot           | 3         | 2       |
| Monday  | cold          | 2         | 1       |
| Monday  | hot           | 1         | 1       |

Stateful transforms may store state of any serializable type including entire rows, which can enable them to achieve complex behavior. State transforms in Pipeline Builder are pre-built and automatically handle the state type and how the state type evolves.

The content of the state is not always accessible to the user. State can be used to enable backend processing behavior. For example, reading a stream input source in a data pipeline Flink job will store the state of the last offset for each partition; this enables the job to recover from the last successful point after a failure or restart.

## Why is state powerful in data streaming?

Foundry data streaming uses the Flink architecture to provide low-latency data pipelining; each row is computed and passed downstream to the next operation immediately after processing. Unlike batch transformations, streaming transformations determine the next output one row at a time, without a full view of the data.

For non-stateful (also known as *stateless*) streaming transformations, this architecture means that transform logic can only depend on one row at a time. For example, a stateless transform could always add 5 to an integer column.

By contrast, stateful streaming transforms have access to persistent data about previous rows while continuing to be able to process rows one at a time and immediately as they arrive.

Foundry stateful streaming provides the option for [exactly-once guarantees](/docs/foundry/data-integration/streams/#streaming-consistency-guarantees), which is the default pipeline configuration. When selected, rows that cause the state to mutate are guaranteed to mutate the state exactly once, and in-order by key. This enables precise and complex data streaming behaviors.

For instance, if you intend to sum, your sum will always be accurate even if your stream restarts or has a failure. If using a sort, the sort will always produce exactly one output per input, even if you restart the job mid-sort after the job has produced a partial sorted output that is not live.

## Keyed state

All Pipeline Builder stateful streaming transformations use **keyed state** and require the user to specify [partition key columns](/docs/foundry/building-pipelines/streaming-keys/#partition-keys). Stateful transforms are processed separately for rows with different values for key columns. This allows the backend to parallelize processing and scale to large data volumes.

For example, consider the stateful sum aggregate example, computing the live running count of `hot` readings each day. Note that in this example, the `Day` column is used as the partition key.

| Day     | SensorReading | Timestamp | State |
|---------|---------------|-----------|-------|
| Tuesday | hot           | 5         | 1     |
| Monday  | hot           | 4         | 2     |
| Tuesday | cold          | 3         | 0     |
| Monday  | cold          | 2         | 1     |
| Monday  | hot           | 1         | 1     |

Notice how state is computed independently for rows with `Day` value `Monday` and those with value `Tuesday`. The occurrence of rows with key value `Tuesday` do not affect what is stored for `Monday`, and the state for these keys would be unaffected if more rows arrived with a different value for the `Day` column, like `Wednesday`.

Keys should be chosen carefully as keys that result in inefficiently distributed records can artificially increase load and limit throughput. See [streaming keys best practices](/docs/foundry/building-pipelines/streaming-keys/#streaming-key-best-practices).

## Event time and watermarks

Stateful streaming transforms often rely on timing information. Because streams are ongoing and may at any moment receive a new real-time row, it often makes sense to group together temporally near rows. For instance, the [Outer Caching Join Transform](/docs/foundry/pipeline-builder/transforms-streaming-joins/#join-streams-with-other-streams) joins rows from two input streams together only when they share values for join columns and when the row timestamps are within an expiry limit. Pipeline Builder streaming uses Flink event time to achieve stateful transformations in a close-to-deterministic way that will have the same or very similar output upon replay.

Stateful transforms in Pipeline Builder that perform a time-based operation require the Assign Timestamps And Watermarks transform upstream and will produce a validation error if it is missing in your pipeline graph. Assign timestamps and watermarks assigns each row an "event time," usually a timestamp column contained in the row. The watermark is each transform operation's mostly deterministic sense of "what is the current time," and is a monotonically increasing value that closely follows behind the maximum event time value seen in any input row to that operator. For example, when an Outer Caching Join determines if entry in cache has expired, it checks if the watermark is greater than or equal to the expiry time, which will be true only when the join has received an input row with at least that event time.

For a transform operator with a single stream input, the watermark is the minimum of the maximum event times row seen by each parallel instance. For a transform with more than one stream input, the watermark is the minimum of the watermarks of the inputs.

Replay will result in similar, but sometimes slightly different, outputs. This is because upon replay, different partition keys may be assigned different Flink parallel instances, and operators with multiple inputs might have be processed upstream at different rates. Flink processing time is unsupported and not recommended since it can produce significantly different and potentially unintuitive results upon replay.

If a parallel instance is not receiving records, it will *not* produce a watermark. This will keep the overall watermark of the transform operator from advancing and is often a symptom of [poorly distributed keys](/docs/foundry/building-pipelines/streaming-keys/#streaming-key-best-practices), which has important implications for [state expiry](#state-expiry) and [windows](#windows). To resolve this, [configure stream idleness in Pipeline Builder.](#event-time-and-watermarks)

If a parallel instance does not receive records for the configured amount of processing time, then its watermark will no longer be considered for the computation of the overall transform operator watermark. While this configuration can resolve the issue of stalled watermarks, setting this timeout too short can cause slower instances to be marked as idle erroneously. Faster instances will then progress the overall transform operator watermark, which can lead to more dropped records.

## State expiry

Storing large state can be lead to performance bottlenecks that can impact negatively throughput and latency, so Pipeline Builder requires the user to limit state size.

Typically, state is limited through user-provided cache time expiry. For stateful transforms that require a cache time parameter, state is usually stored in state `cache` for each key until the watermark is beyond the last event time seen for that key, plus the expiry.

In the case of a stalled watermark, stateful transforms will not evict state promptly. This can lead to unexpected outputs and unbounded state growth.

## Windows and triggers

The Aggregate Over Window transform allows user to set *[windows](#windows)*, which are strategies for grouping rows and their state together, as well as *[triggers](#triggers)*, which are strategies for when the aggregate should produce output.

### Windows

The currently supported windows are:

* **Tumbling event time:** Divides time into fixed-length, non-overlapping, continuous intervals. Rows with the same key and an event time that falls within the same interval are grouped together. For example, you can group together all rows on the same date with event time in the same hour of the day.
* **Count:** Given a user-specified count *n*, for each key, groups together the most recent *n* rows with that key.
* **Session:** Groups together rows that are part of the same *session*. Rows are in the same session if they share a key and there is no break of rows with that key in event time for more than the user-specified session gap. For example, in a dataset containing data about streaming platform user actions, you can group together all rows for one user workflow until the user takes a break.

Windows that depend on time (such as the tumbling event time window and session window) will eventually close once the watermark advances far enough.

* If the allowed lateness is not set or is zero, the windows stay open until the watermark passes the end time of the window, at which point the window closes, may produce output, and deletes its state.
* If allowed lateness is specified, the window will stay open until the watermark passes the end of the window plus allowed lateness. This allows late arriving or out of order records to still be part of a window even if the watermark is past the end of the window.
* Rows that arrive when the watermark is past the end of the window plus the allowed lateness will always be dropped because the window has already been closed and its state deleted.

Windows that depend on time also allow specification of a custom trigger.

In the case of a stalled watermark, windows will stay open for much longer. This can lead to rows not being emitted, unbounded state growth, or missing trigger fires.

### Triggers

The currently supported triggers are:

* **After watermark trigger:** Causes the window to output when the watermark passes the end of the window. Allows specification of other custom triggers for when the watermark is before the end of the window, and when the watermark is after the end of the window (when the window is still alive due to its allowed lateness). For example, a user may want no outputs until the window closes, but want to see every output for late arrive records in the allowed lateness period.
* **Count trigger:** Given a user specified count *n*, causes the window to output for each key after it receives a multiple of *n* rows.
* **Window close trigger:** Fires an output only as the window closes and deletes state. Will fire only exactly once per window and only at the end of the window.

## Stateful streaming best practices

Large state can have negative performance implications, so when designing stateful pipelines it is recommended to use as "tight" of a state expiry policy as possible. This usually means not setting cache time expiry to be larger than necessary, nor setting a count larger than necessary for count windows.

For pipelines that require large state, performance (including throughput, checkpoint duration, and latency) scales with the parallelism of the Flink job. Parallelism can be edited in streaming pipeline settings, where larger parallelism allows for increased data processing capacity and increased state read and write speed.

Appropriate keys should be chosen for stateful transforms, because too many values for key columns or imbalances in row distribution can lead to bottlenecks or trouble scaling.
