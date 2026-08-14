<!-- source: https://palantir.com/docs/foundry/optimizing-pipelines/projections-advanced/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Advanced details

This page covers advanced details about how dataset projections work in practice to enable more optimized queries on datasets. To learn about projections at a higher level, see [this page](/docs/foundry/optimizing-pipelines/projections-overview/).

Internally, a projection is a copy of a dataset, optimized for some access pattern. Foundry stores projections on a dataset as child datasets. These are called "projection" datasets. The parent datasets are called "canonical" or "projected" datasets.

* A projection includes some set of columns.
  * The projection can only satisfy reads on those columns (or a subset of them).

A **Build** keeps the projection up to date with the most recent data in the main dataset. If a projection is not up to date, it will still be used. However, it might not provide much benefit.

If the projected dataset receives a new `SNAPSHOT` transaction, any downstream projections are entirely out of date and have no benefit until the projects rebuild. If a projected dataset receives an `APPEND` transaction, downstream projections are only partially out of date relative to the new transaction. Foundry queries are rewritten to benefit from the projection if they can while still producing results that reflect the new data.

* Projection builds are configured per-branch. Projections will be regularly **compacted** to combine smaller partitions into larger ones.
* Adding a projection will never change the result of a read of a dataset.

At a low level, a projection is either:

* An approximately globally sorted dataset.
* A hash bucketed and locally sorted dataset (note that the bucketing and sort columns may differ).

## Projection datasets

A projection dataset is stored as a [Foundry dataset](/docs/foundry/data-integration/datasets/). This dataset is not visible as a [resource](/docs/foundry/getting-started/projects-and-resources/) but can be accessed via the link in the `Projections` tab.

* Each branch for which a projection build is active has a corresponding branch in the projection dataset.
* Deleting a dataset will delete all projections on the dataset.
* The *Noho* service is used to manage projections and is referenced in the dataset schema when [setting up a projection](/docs/foundry/optimizing-pipelines/projections-setup/).

## Projection builds

To keep them up to date, projections are built asynchronously through the normal Foundry [build](/docs/foundry/data-integration/builds/) system. This lets users read projected datasets consistently and immediately after a build, but the projection datasets must be built periodically to keep them from becoming out of date.

To allow flexibility in allocating compute resources and controlling costs, Foundry will not automatically create these builds. To configure them, use the scheduler widget in the `Projections` tab.

There is no universal rule for the appropriate build cadence. The primary determining factor is that queries need to be able to execute within their performance targets on the **unprojected** portion of the dataset. For example, if your pipeline writes 10 GB per hour, and you have determined that a filtered read should scan no more than 100 GB to meet your performance targets, you should make sure that the projections build at least every 10 hours.

### Spark profiles

Projections use an auto-scaling mechanism to find the right number of executors to build a projection. You do not need to manually adjust Spark profiles unless projection builds fail or take too long.

### Costs

Foundry will attribute any costs associated to the projection (for example its storage and compute) to the project of
the main dataset.

## Projection compaction

Compaction is the primary maintenance operation performed on projections. It refers to the process of taking large collections of small sorted files, and combining them into larger sorted files Compaction occurs automatically on projections as a part of the projection build process.

Compaction makes read performance independent of the number of input transactions on the main dataset. This allows projections to speed up reads of frequently incrementally written or streaming datasets. Projection builds might occasionally run for longer than average. This is usually due to a compaction.

## Projection query planning

If a projection is available to satisfy a query, it will **always** be chosen ahead of the main dataset, even if the main dataset is written in a way that would otherwise be more optimal to support a given query. This greatly simplifies the semantics around query planning.

### Choosing projections

For the following queries, here is the priority assigned to various projections during query planning:

* **A filter on columns:** The projection sorted on the most columns will be preferred, and globally sorted projections
  are preferred to locally sorted ones. For example, if the filter is `x = 1 AND y = 2`, projections will be selected in
  the following priority:
  * Globally sorted on columns `x` and `y`
  * Locally sorted on columns `x` and `y` (and bucketed on any set of columns)
  * Globally sorted on column `x`
  * Locally sorted on column `x` (and bucketed on any set of columns)
* **A join on columns:** A projection bucketed on the exact set of join columns will be preferred.
* **A join and a filter:** For example, if the query filters on column `F` and joins on column `J`, projections will be
  preferred according to the following priority:
  * A projection bucketed on J and locally sorted on column `F`
  * A projection globally sorted on column `F`
  * A projection locally sorted on column `F` (and bucketed on any column other than column `J`)
  * A projection bucketed on column `J` (and locally sorted on anything other than column `F`)

These priorities reflect the view that filters are typically selective enough so that it is better to optimize for the filter versus the join, though this may not always be the case.
