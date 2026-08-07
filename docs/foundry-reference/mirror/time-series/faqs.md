<!-- source: https://palantir.com/docs/foundry/time-series/faqs/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# FAQ

## How do I set up a unit and interpolation for a time series property (TSP)?

You can configure units and interpolations for each TSP through a formatter. Find the formatter by navigating to a time series object type in Ontology Manager and locating the **Time Series Properties** section of the **Capabilities** tab. Alternatively, you can edit units and interpolations in the **Properties** tab, similar to any other [value formatter](/docs/foundry/object-link-types/value-formatting/).

## What are Measures? When should they be used?

Prior to the development of [sensor object types](/docs/foundry/time-series/time-series-concepts-glossary/#sensor-object-type), the platform used Measures as a time series model. Measures are being deprecated and you can use sensor object types in similar workflows. For more information, see the following pages:

* Learn how to [migrate to sensor object types from Measures](/docs/foundry/time-series/create-sensor-ot/#migrate-from-measures).
* Learn how to [store time series in the Ontology](/docs/foundry/time-series/time-series-overview/#store-time-series-in-the-ontology).

## Can I set up time series using Code Repositories?

Review the [Advanced setup](/docs/foundry/time-series/advanced-setup/) documentation for more information.

## Is time series data indexed?

Creating a [time series sync](/docs/foundry/time-series/time-series-concepts-glossary/#time-series-sync) on your [time series dataset](/docs/foundry/time-series/advanced-setup/#1-create-and-optimize-the-time-series-input-data) will automatically create a [time series projection](#what-is-the-time-series-projection) on the time series dataset. A time series projection is a materialized copy of the dataset that provides optimizations similar to those of a SQL database index.

When the time series sync builds, it generates metadata about the time series dataset transaction(s) from which it derives, informing Foundry's time series database of the data available to index.

When [using time series](/docs/foundry/time-series/time-series-usage/), you read indexed data from the time series database. The time series database acts like a cache; data is only hydrated at read time, and the least recently hydrated series are evicted first once the database disk space is constrained.

## What is the time series projection?

A [projection](/docs/foundry/optimizing-pipelines/projections-overview/) is a materialized copy of a dataset that optimizes for certain queries. In the case of time series, the projection optimizes for the queries made when the time series dataset is read to hydrate data to the time series database. This process involves filtering the time series dataset to select the [series IDs](/docs/foundry/time-series/time-series-concepts-glossary/#series-id) and time ranges that are being hydrated. In this way, the projection maintains good partitioning and a sort over the time series data, effectively indexing the time series dataset by series ID and timestamp.

## Why is my time series failing to load?

If an error states that ‘no time series data exists’, your series IDs may not be mapping correctly between your time series dataset/sync and [time series object type backing dataset](/docs/foundry/time-series/time-series-concepts-glossary/#time-series-object-type-backing-dataset). The set of series IDs in each dataset should intersect and, ideally, be equal sets for the [time series properties](/docs/foundry/time-series/time-series-concepts-glossary/#time-series-property-tsp) to correctly reference time series data. Be sure to also check that the series ID property on your time series object type is [correctly configured](/docs/foundry/time-series/time-series-properties/).

Particularly when dealing with large scale time series, it is possible that hydrating data to the time series database can fail outright. This may occur due to a failure in (or lack of) optimizations:

* If the time series projection on the time series dataset is [outdated](/docs/foundry/optimizing-pipelines/projections-setup/#optional-build-the-projection), unprojected transactions are read from the [canonical dataset](/docs/foundry/optimizing-pipelines/projections-advanced/#projection-builds). This means the optimization of the projection is not applied; data partitions will be spread across many more files, and more rows would need to be scanned to hydrate the desired data. Built-in limits are configured to prevent this undesired access, as it is likely to result in your query timing out and have a negative effect on service health. Check that the time series projection’s schedule is running consistently and regularly. You can manually rebuild the projection from its dataset preview page.
* If the time series dataset is not correctly [partitioned and sorted](/docs/foundry/time-series/advanced-setup/#1-create-and-optimize-the-time-series-input-data), this can, in extreme cases, lead to similar issues where too many rows must be scanned to index the desired data, and you will face built-in service limits. To help prevent this issue, the time series dataset will be correctly formatted for you when transforming data in Pipeline Builder and mapping it to a time series sync output. You can also resolve this issue with an updated time series projection or by manually adding the correct formatting to your pipeline.

## Why is my time series taking a long time to load?

The most common reason for time series data loading slowly is that data was not already indexed in the time series database. Index hydration occurs the first time a certain time series (series ID) is queried or after any subsequent [snapshot transactions](/docs/foundry/data-integration/datasets/#snapshot) are synced by the time series sync. A synced snapshot transaction informs the time series database to hydrate a series from the full dataset view to its index. There is a chance that a snapshot hydration will be triggered due to the queried time series data being evicted from the index; time series are evicted based on disk space requirements, with the least recently hydrated series being evicted first.

:::callout{theme="success"}
To improve hydration speed, add a time filter to your query that will only hydrate data points within the prescribed time range as opposed to the full series. You can create time filters using a [filter time series card in Quiver](/docs/foundry/quiver/card-filter-time-series/) or a [`time_range` function in FoundryTS](/docs/foundry/foundryts/functions-time-range/).
:::

After a time series is initially hydrated, queries should be much faster. If your pipeline is [incrementally](/docs/foundry/building-pipelines/incremental-overview/) adding time series data, then the new data will be incrementally hydrated by the time series database and your time series should load quickly after the first snapshot hydration of the data.

:::callout{theme="warning"}
We recommend running [incremental pipelines](/docs/foundry/building-pipelines/pipeline-types/#incremental) to improve subsequent indexing performance.
:::

If there is a lot of data to hydrate incrementally, a query can still take a long time to load. For example, load times will increase if an incremental transaction is very large, or if there are many incremental transactions that have not been hydrated due to the time series not being regularly queried.

In some extreme cases, both snapshot and incremental hydrations will be slow if the [time series repartition or sort](/docs/foundry/time-series/advanced-setup/#1-create-and-optimize-the-time-series-input-data) is not applied to the time series dataset, or too many partitions are written for the volume of data as this can require reading many files. This will only apply for transactions that have not yet been projected by the time series projection. When transforming data in Pipeline Builder and mapping it to a time series sync output, the time series dataset is correctly formatted for you.

## Why is my time series missing data?

For all your time series data to be indexed in the time series database, its time series sync must be up-to-date. This means that the sync must have been built since the latest transactions on your time series dataset was built, otherwise the data from those transactions cannot be hydrated.

If your time series dataset is not stored in the [*Soho* format](/docs/foundry/time-series/advanced-setup/#1-create-and-optimize-the-time-series-input-data), no unprojected data will be hydrated to the time series database. When transforming data in Pipeline Builder and mapping it to a time series sync output, the materialized time series dataset backing the sync is converted to the *Soho* format for you. You can also complete one of the following tasks to have more updated data available:

* Convert your time series dataset to the *Soho* format. This will require a snapshot to convert all the data.
* Schedule the time series projection to build on every update of the time series dataset. This will introduce some latency to queries for the latest data.
