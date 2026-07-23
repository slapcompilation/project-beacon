<!-- source: https://palantir.com/docs/foundry/building-pipelines/maintaining-incremental-performance/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Maintaining high performance

Incremental transforms can help minimize resource use by ensuring that only new rows are processed whenever a pipeline updates. In Foundry, incremental transforms can only add new rows to the dataset and cannot replace or remove rows. This may be the case for data ingests as well. Since each run typically processes a small amount of data, each of these additions are small, but all of them must be considered together when rendering the active view.

Typically this is fine, but when tens or hundreds of thousands of small updates have accumulated (which can happen after weeks or months of uninterrupted building, depending on frequency), read and write performance may begin to degrade. This may be caused by several related factors, as discussed below.

## Possible causes

### Large file counts

Having too many files in a dataset causes slowness in backend requests that access the current view’s data. This can cause preview unavailability issues, failures in Contour, and severe slowness in Transforms, especially Python Transforms, due to special overhead associated with loading files in that language environment.

Over time, any operation involving the active dataset view will be dominated by inefficient data reads, so much that transforms that initially run in the order of minutes will end up taking several hours or days. In extreme cases, backend requests may even time out, causing builds to fail.

Additionally, as part of writing a Spark DataFrame to an output in an APPEND or UPDATE transaction, an incremental transform needs to construct an in-memory list of all of the existing files in the output's current view. For outputs with many files, this operation can take a long time and may require the use of a high driver memory [Spark profile](/docs/foundry/optimizing-pipelines/spark-concepts/#tuning-spark-profiles) to avoid out-of-memory errors.

### Large transaction counts

Similarly to having too many files, too many [transactions](/docs/foundry/data-integration/datasets/#transactions) in the view can cause slowness. However, this slowness occurs not only when files are requested, but whenever the view range is resolved, which can affect dataset functionality such as computing stats, loading history, and so on. In transforms, this slowness will manifest in the pre-compute stage, when the environment is being set up and before any Spark details are available, making the issue difficult to debug.

Usually transactions accumulate in tandem with files, but in some cases empty transactions can cause issues even with a relatively low file count. Conversely, even a relatively low number of transactions may result in a large number of files if each transaction contains many files.

## Possible solutions

### Regular snapshotting

The simplest and, in some situations, most effective solution to keep incremental pipelines performant is to run regular snapshots. Snapshots will re-process the full data and replace the output with a fresh view, which can be partitioned efficiently. Snapshotting is a compute-intensive operation, which is why incremental processing is often preferred over regular processing, but occasional snapshotting can help prevent an excess of files or transactions from building up in the same view. To determine snapshotting frequency, administrators should balance performance for reading and writing data.

Snapshot transactions have cascading effects, in which each incremental transform that uses an input that has been snapshotted will snapshot itself. Rather than directly forcing an incremental transform to run a snapshot, we just need to snapshot one of the transform's inputs and let the Transforms application determine that the incremental transform needs snapshotting as well. Thus, a useful way to set up an incremental pipeline to regularly snapshot is to set up a dummy input that will build on the intended snapshot schedule, and make the dummy input always run in snapshot mode.

Regular snapshotting has several drawbacks, as described below:

* Snapshotting can complicate the lineage, since dummy inputs will appear in searches and in the folder structure, which may be confusing.
* Snapshotting can be very expensive, even if done infrequently.
* While a snapshot is running, no updates can propagate through the pipeline, which can interfere with SLAs (service-level agreements).
* Snapshotting does not work for raw datasets, such as those backed by a Data Connection sync.
* Not every transform is written in a way that supports snapshotting (though we recommend that they always should).

### Dataset projections

The most recommended way of dealing with incremental buildup is to add a [dataset projection](/docs/foundry/optimizing-pipelines/projections-overview/) to the datasets involved. Dataset projections offer an alternate mechanism for querying for data in a dataset, and are stored and updated independently from the canonical dataset. Because of these traits, dataset projections can break out of the append-only model of incremental computation, and reorganize their internal data representation automatically as the volume of data grows. This is called compaction—compaction ensures reads are always performant from the projection, no matter how many files or transactions are in the canonical dataset.

This is particularly useful for incremental pipelines because dataset projections do not need to be completely in sync with the canonical dataset for readers to benefit from improved performance. All Foundry products know how to combine data coming from the projection and from the canonical dataset to reconstruct the view the same as if the projection wasn’t there. For example, if a dataset has 100 incremental transactions, and has a projection that was built with the first 99, then 99 will be read from the projection and only one from the dataset. Because of this, it is usually sufficient to update dataset projections daily or weekly, making them very computationally cheap to maintain.

Note that because the dataset projection is a separate resource from the canonical dataset, it can be built at any time, even if the canonical dataset is itself building (and the other way around). Readers will just use whatever state is current according to the valid transactions. For example, if a dataset is building transaction 10 and the projection starts building at the same time, it will read from transaction 9. A reader that queries data in this scenario will read transactions 1-8 from the projection, and 9 from the dataset, effectively seeing the same data as if reading from the dataset directly.

Drawbacks of dataset projections include:

* Dataset projections use more storage than just the dataset alone would.
* Dataset projections do not work out of the box with Foundry Retention.
* Dataset projections do not modify the canonical dataset in any way (so if the projection is removed, reads will become inefficient again).

### Retention policies

Sometimes a pipeline’s use case does not require keeping historical data in-platform forever, and it’s fine to retain only the most recent transactions, which can be done automatically using Foundry Retention. In this case incremental pipelines can be built without special consideration, as long as the transforms logic doesn’t include any cross-transactional dependencies (such as aggregations or differential computation). A special `allow_retention` flag must be set in Python Transforms to the incremental decorator (otherwise `DELETE` transactions will trigger a snapshot run).

Drawbacks of retention policy changes include:

* Loss of historical data.
* If transactions aren’t self-contained units from a data perspective, retention policies may lead to inconsistent state (e.g. an end event without a matching start).

## Additional options to consider

### Aborting transactions

Under some circumstances, transactions will be committed with zero files, or only with empty files. These transactions have no impact on the view, but they are considered valid updates and will trigger schedules and all related side effects, which may result in wasted computation. Empty transactions can also greatly increase the file and transaction counts.

Empty transactions are best avoided at the source, which is generally a Data Connection [sync](/docs/foundry/data-connection/core-concepts/#syncs). Data Connection will always abort transactions with no files, but empty files can still be generated. Empty transactions can be a particular issue with custom plugins; at times it may not be possible to modify the plugin to avoid empty transactions (for instance, if a non-empty transaction is required to update the Data Connection incremental metadata). In other cases, no-file transactions can be committed by transforms or other means.

To minimize the impact of these empty or no-file transactions, we can explicitly abort transactions at the most upstream transform in the pipeline. When we detect that we receive an empty input, or end up with an empty output, we can call `.abort()` on the output object; this will cause the job to be aborted, along with its transaction. Aborted transactions are effectively cancelled and will not trigger schedules or cause any side effects. Aborting the transaction will break the chain and stop propagating empty transactions down the pipeline. Aborting the transaction will also not contribute failure statistics (whereas purposefully failing the build would contribute to failure statistics).

Note that aborted builds are considered successful, and will advance the input transaction pointers. Therefore, aborting with non-empty inputs will discard data, which may not be desired if you want to stop the build for another reason, like a failed precondition.

### Changelog datasets

Changelog logic enables you to implement edit semantics on append-only transactions, making it possible to perform joins and aggregations reliably in incremental pipelines. However, besides the previously-mentioned file and transaction count problems, implementing edit semantics on append-only transactions may allow the row count to grow without bounds, making transforms performance increasingly worse at the point where a state resolution stage is reached (or a standalone snapshot required).

Keeping the row count under control for such pipelines is a little trickier. Snapshotting is possible, and may help a lot in intermediate transforms when partial states are present (since those mostly go away in a full rebuild). But to fully benefit from snapshots, the logic must collapse rows to their latest state, which is not always desirable (in some cases we may want to figure out the state of rows at any given point in time, not just the latest). Dataset projections can only help so much. And retention policies may not have the desired effect if rows aren’t atomic units (for example, we may end up with an end event without a matching start event). So special care must be taken when designing such pipelines.
