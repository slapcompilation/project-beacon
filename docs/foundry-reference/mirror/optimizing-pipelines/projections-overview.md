<!-- source: https://palantir.com/docs/foundry/optimizing-pipelines/projections-overview/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Dataset projections

**Dataset projections** can improve performance for a large class of queries. If you have a dataset you want to optimize for multiple query patterns (for example, filtering on two separate columns), you should consider adding projections to the dataset. Specific examples of [use cases](#use-cases) for projections are listed below.

Each projection typically supports a single query pattern, focused on either improving filters on a set of columns or joins on a set of columns. Multiple projections can be added to a dataset, and all column types are supported in projections. Additionally, projections can be added both to snapshot or incrementally built datasets. The *Noho* service is used to manage projections and is referenced in the dataset schema when [setting up a projection](/docs/foundry/optimizing-pipelines/projections-setup/).

Projections have some limitations:

* Projections can only be added to datasets that are append-only. In an append-only dataset, rows can only be added (that is, appended) to the dataset; files or transactions cannot be manually deleted from an append-only dataset. Specifically, the only [transactions](/docs/foundry/data-integration/datasets/#transaction-types) that can be performed on an append-only dataset are `APPEND`, `SNAPSHOT`, and `UPDATE` transactions that add rows to the dataset. The projection system will automatically identify datasets that violate this requirement and disable projections on them, but as a user, you should still avoid this scenario.
* Projections do not support schema evolution, even for incrementally consistent operations like adding columns.

Review the example use cases below to learn about whether projections are a good fit for your use case. Get started by learning how to [set up a projection](/docs/foundry/optimizing-pipelines/projections-setup/).

## Use cases

Many types of queries will benefit from a projection. The examples below will demonstrate the following:

* [Filtering large datasets on multiple pre-specified dimensions](#filter-on-a-list-of-columns)
* [Joining large datasets on a pre-specified set of columns](#join-on-a-set-of-columns)
* [Aggregating large datasets on a pre-specified set of columns](#aggregate-on-a-pre-specified-set-of-columns)
* [Reading from frequently-written incremental datasets or streaming datasets](#read-from-incremental-pipelines)
* [Querying directly uploaded data](#query-uploaded-data)

### Filter on a list of columns

Given an ordered list of columns, optimize filters on any **prefix** of the list. Projections will only speed up filters that compare a column to a constant value. And any filters on a string column must be **case-sensitive**.

For example, say that there is a projection optimized for filters on the ordered list of columns `["x", "y", "z"]`.
It will speed up the following types of queries:

* `SELECT * FROM dataset WHERE x = 5 AND y = 10 AND z = '15'`
* `SELECT * FROM dataset WHERE x = 5 AND y = 10`
* `SELECT * FROM dataset WHERE x = 5 AND q = 3`
  * If there are additional filters on other columns that are not in the configured list, as in this case with `q = 3`, Spark will automatically attempt to unpack the filter conditions it can "push" into the data source (in this case, `x = 5`) and apply the other conditions afterwards.

But the following types of queries will not be optimized:

* `SELECT * FROM dataset WHERE abs(x) == 10`
  * `abs(x) == 10` does not compare a column with a constant value.
* `SELECT * FROM dataset WHERE x % 100 == 10`
  * `x % 100 == 10` does not compare a column with a constant value.
* `SELECT * FROM dataset WHERE y = 10`
  * `["y"]` is not a prefix of `["x", "y", "z"]`.
* `SELECT * FROM dataset WHERE z = '15'`
  * `["z"]` is not a prefix of `["x", "y", "z"]`.
* `SELECT * FROM dataset WHERE x = 5 OR q = 3`
  * Spark won't be able to "push" the `x = 5` filter into the datasource because that would miss rows where `x = 5` is false but `q = 3` is true.

#### Range queries

Projections can optionally speed up range queries on the filter columns, for example:

* `SELECT * FROM dataset WHERE x > 5 AND x < 10`
* `SELECT * FROM dataset WHERE s LIKE 'SOME_PREFIX%'`

#### Limitations

* It is not possible to create a projection that includes a non-primitive (eg. array) column and that also supports
  range queries on the filter columns.

### Join on a set of columns

Given an unordered set of columns and a bucket count, optimize joins (only) on that exact set and bucket count.

For example, a projection optimized for joins on `{"x", "y"}` will optimize the following types of queries:

* `SELECT * FROM dataset1 INNER JOIN dataset2 ON dataset1.x = dataset2.x AND dataset1.y = dataset2.y`

But the following queries will not be optimized:

* `SELECT * FROM dataset1 INNER JOIN dataset2 ON dataset1.x = dataset2.x`

### Join projected and non-projected datasets

In Foundry, joins of large datasets typically perform a sort-merge join. This involves partitioning each of the datasets
according to the join key, sorting each partition on that key, and then merging the (sorted) partitions with the same
key.

* In the general case, this involves shuffling and sorting both of the datasets.
* If one of the datasets has a projection that is optimized for joining on the join columns, it will not be shuffled or sorted, though the other dataset will be.
* If both of the datasets have projections that are optimized for joining on the join columns, **and use the same number of buckets**, then neither dataset will be shuffled or sorted. This can lead to dramatic performance improvements. The same goes for joining a dataset that has a join-optimized projection with an explicitly bucketed dataset (with no projections), though again the number of buckets and join columns must match **exactly**.

:::callout{theme="neutral"}
Most projection consumers in Foundry do not by default take advantage of the fact that the projection is already sorted when doing sort-merge joins, so you may still see a sort in your Spark query plan. In transforms, you can use the [Spark profile](/docs/foundry/optimizing-pipelines/spark-profiles-reference/#profile-table) `BUCKET_SORTED_SCAN_ENABLED` to modify Spark's behavior based on the fact that the projection is sorted, but this does not always improve performance and can actually make performance worse.
:::

### Aggregate on a pre-specified set of columns

In Foundry, aggregations usually involve performing a shuffle exchange on the dataset (i.e., partitioning the dataset) according to the aggregation key. When reading from a projection that is hash-bucketed (which is the case for all join-optimized projections, but may not be the case for a filter-optimized projection), consumers can avoid this shuffle, which can lead to dramatic performance improvements during aggregations. A [primary key expectation check](/docs/foundry/transforms-python/data-expectations-reference/#primary-key) on a dataset that is updated incrementally in an append-only fashion is a case where a projection (on the primary key columns) is especially beneficial, both because of the compaction performed by the projection and because of the fact that the hash-bucketing of the projection can be leveraged in the aggregation used to compute the expectation.

### Read from incremental pipelines

Incremental pipelines can result in very high file counts, and correspondingly degraded read performance. For example, a pipeline that writes ten partitions every five minutes will write over a million files per year. These are difficult to read for many reasons, including such things as simply producing the list of input partitions.

Projections provide a way to compact incremental pipelines such as these transparently. Just set up a projection, optimized for either filters or joins, and reads will use the projection. [Learn more about using projections for incremental pipelines.](/docs/foundry/building-pipelines/maintaining-incremental-performance/#dataset-projections)

Note that consumers can still take advantage of the filter or join optimizations of the projection, even if the projection is not fully up-to-date with the canonical dataset, as long as there were no SNAPSHOT or DELETE transactions (or UPDATE transactions that modified existing files) on the canonical dataset between the latest transaction at the time that the projection was last built and the current latest transaction on the canonical dataset.

### Query uploaded data

CSV is an inefficient file format for querying data, but it is common for data that is uploaded to Foundry (via Data Connection from a file system source, manual uploads, etc.) to initially be in CSV format. Creating a transform job is one way to convert these CSVs to a more efficient format such as Parquet. Alternatively, you can add a projection; read operations will use the optimized projection for better performance, while the dataset still contains the original CSV files.
