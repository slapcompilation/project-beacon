<!-- source: https://palantir.com/docs/foundry/time-series/compute-usage/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Time series query compute usage

Foundry caches time series data on disk in a highly optimized format for time series queries. Querying this data requires using compute-seconds.

Time series queries use compute in the following ways:

1. Queries have a fixed rate of compute-seconds per query.
2. Each query has an additional measurement of compute-seconds based on the number of time series points that the query reads.

Queries on larger time series indexes will read more points. The following sections offer a description of how this is calculated.

## How compute is measured

:::callout{theme="neutral"}
Note that when you are paying for Foundry usage, a fixed, minimum number of compute-seconds are consumed per query. The default amount is `4` compute-seconds. This is the base compute usage required in order to serve a query. If you have an enterprise contract with Palantir, contact your Palantir representative before proceeding with compute usage calculations.
:::

Storing time series data is measured under Foundry storage. Storing time series data does not use any compute; only indexing time series and actively querying the data will use compute.

Time series query compute is used exclusively when querying time series data stored in Foundry. Time series queries use compute in two ways:

1. With a minimum number of compute-seconds used per query. When on a usage-based Foundry instance, each query uses 4 compute-seconds.
2. Queries scale beyond the fixed minimum cost based on the number of points that they consider in the query itself. The number of points that are scanned during a query is driven by the size of the series being queried and the complexity of the logic being executed, which can drive many comparisons/operations on points.

The following formula derives compute-seconds from a query:

```
compute-seconds = 4 + points_scanned / 25000
```

## Investigate time series query usage

The [Resource Management](/docs/foundry/resource-management/overview/) application allows you to drill down to dataset usage information and should be a starting point for investigating usage in the Foundry platform.

Users have access to multiple tools for querying time series data in Foundry. Time series query usage is always attached to the resource that each tool produces or modifies.

* In Quiver, the time series queries will be attributed to the individual Quiver analysis or dashboard that was used to initiate the queries.
* In Workshop, the queries will be attached to the Workshop app that initiated the queries. When a Workshop app embeds a Quiver component that queries time series, the usage is still attributed to the overarching Workshop application.
* For transformations that use the FoundryTS library to query time series, the compute for those queries is attributed to the repository where that transformation was written.

## Understand drivers of usage

When paying for Foundry on a usage contract, there are three main drivers of compute with time series queries:

1. Number of queries
   * Each query has a minimum usage of 4 compute-seconds. This means that more queries executed by users, more Quiver dashboards running queries, and more scheduled builds running FoundryTS queries will use more compute-seconds.
2. Size of the series being queried
   * Reducing the number of points read typically reduces compute and latency. For example, running a query that comprises an aggregation across a series of 10,000,000 points will use more compute than running the same query against a 100,000 point series. However, the actual usage will depend on the query. The most common technique to reduce number of points read is adding a time range filter on each series.
3. Complexity of the query

   * Queries that perform more complex interactions with underlying series will run more operations on top of that series. In running these operations, query usage will increase as more points are scanned.

   See the section below for more information and examples of [query complexity](#examples-of-query-complexity).

## Manage usage with time series

Managing the total number of queries is important for managing total compute usage from time series querying. Consider the following practices when using time series in Foundry:

* When building a time series-based analysis or dashboard, consider the total number of queries that must run on each update. Also consider splitting out update paths so not all queries update when parameters are changed.
* When running FoundryTS builds, ensure that the schedules are set appropriately so that builds do not run more often than necessary.
* When a time range is applied to a time series, Foundry's time series backend will only read the points that fall within that time range. Therefore, time series queries in Foundry can be optimized based on the ranges that they are querying. Limiting the time range of a query *does not* require compute; choosing time ranges can significantly reduce overall points scanned, reducing the compute used in the query.
* Choose the correct granularity for the job; not all workflows require maximally granular data. In some cases, this means pre-aggregating for specific workflows. In other use cases, this means storing different granularities in different series. While maintaining multiple up-to-date series can increase indexing compute, the act of storing multiple series does not require compute. Therefore, holding multiple series of different granularities may be cheaper than always querying the most granular series.

## Calculate usage

To predict the cost of a time series query, be sure to always understand the size of the series being queried.

Consider the following example, where there are three queries against a series of 100,000 points with each query scanning all points in the series:

```
series_size: 100,000 points
minimum_query_usage: 4-compute seconds
points_per_compute_second: 25,000 points
total_queries: 3

 
compute-seconds = num_queries * minimum_query_usage + total_points / points_per_compute_second
compute-seconds = 3 queries * 4 compute-seconds + 100,000 points * 3 queries / 25,000 points-per-second
compute-seconds = 3 * 4 + 300,000 / 25,000
compute-seconds = 24 compute-seconds
```

## Examples of query complexity

The complexity of a time series query increases as more nested operations are applied to the queried time series.

As an example, consider the following FoundryTS code which adds two time series together and returns all the points of the new series for a 1-year time range as a Pandas dataframe:

```
series_1 = N.TimeseriesNode('series_1')
series_2 = N.TimeseriesNode('series_2')
result = F.dsl(program='a+b', return_type=float)([series_1, series_2]).time_range(start='2022-01-01', end='2023-01-01')
result.to_pandas()
```

This code will make a query to Codex with the shape:

```
{
  id: dsl-fomula
  children: [
    { id: timeseries },
    { id: timeseries }
  ]
}
```

Evaluating the `to_pandas` call will incur cost for scanning the points in the `result` time series in the requested 1-year time range, as well as the points in the two component series required to compute the result (in this case, a 1-year range from each).

Now, consider the following FoundryTS code which applies more nested operations. First, we define a series that
is the sum of two other series. Then, we compare that series against its 7-day rolling average, and load one year of
points from the result as a Pandas dataframe:

```
series_1 = N.TimeseriesNode('series_1')
series_2 = N.TimeseriesNode('series_1')
intermediate_1 = F.dsl(program='a+b', return_type=float)([series_1, series_2])
intermediate_2 = intermediate_1.rolling_aggregate('mean', '7d')
result = F.dsl(program='a-b', return_type=float)([intermediate_1, intermediate_2]).time_range(start='2022-01-01', end='2023-01-01')
result.to_pandas()
```

This code will make a query to Codex with the shape:

```
{
  id: dsl-fomula
  children: [
    {
      id: dsl-fomula
      children: [
        { id: timeseries },
        { id: timeseries }
      ]
    },
    {
      id: rolling-aggregate
      children: [
        {
          id: dsl-fomula
          children: [
            { id: timeseries },
            { id: timeseries }
          ]
        }
      ]
    }
  ]
}
```

Each node in this query tree will incur cost for scanning the 1-year range of points to produce the final result.
