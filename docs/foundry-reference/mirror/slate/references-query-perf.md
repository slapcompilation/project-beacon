<!-- source: https://palantir.com/docs/foundry/slate/references-query-perf/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Optimize queries in Postgres

:::callout{theme="neutral"}
This page focuses on tuning queries for optimal performance in Postgres. We generally recommend building Slate applications on top of Ontology capabilities, using features like [object sets](/docs/foundry/slate/concepts-object-sets/) and [Actions](/docs/foundry/slate/applications-writeback/) for reading and writing data.
:::

Designing a responsive application requires careful planning and consideration. The data model, query structure, and dependency graph each play an important role in application performance and usability. This guide is focused on performance tuning aspects of PostgreSQL queries that can be written in Slate and includes performance heuristics, methods for identifying tuning opportunities and suggestions for improving performance.

Query performance tuning is an *iterative* process. There are many different ways to write the same request in order to produce the "correct" answer.

## Performance Heuristics

The target execution time for PostgreSQL queries is <= 500ms. This should be possible for the majority of use cases where the dataset in question is less than 10m records, though it requires careful planning and consideration when designing the data model.

When evaluating query performance, particularly with a new dataset, ensure that queries are run multiple times before collecting and analyzing statistics. This will help ensure the dataset is properly cached and the performance is better aligned with the expected usage. If you are interested in learning more about the PostgreSQL cache, see the following links:

* [Introduction to PostgreSQL physical storage ↗](https://rachbelaid.com/introduction-to-postgres-physical-storage/)
* [Deeper dive into physical storage ↗](https://www.interdb.jp/pg/pgsql01.html)
* [Official Postgres documentation ↗](https://www.postgresql.org/docs/current/static/storage.html)

## EXPLAIN... explained

EXPLAIN is particularly useful command that Postgres provides to return the query execution plan. A query plan is created for every request that Postgres receives, which uses the query structure and properties of the data to determine the fastest way to service the request. This section starts with a review of the EXPLAIN command, which is referenced throughout the guide.

### EXPLAIN

#### NODES

You can think of a node as a logical unit of work, or a step in the query evaluation. The nodes are returned as an inverted graph, which means the first line of the response is the last unit of work that is performed. Each node is preceded by `->`.

`-> Index Scan using event_type_idx on event (...)`

*Why this matters*: The nodes will be used to identify the inefficient operations in a query execution plan and help prioritize performance tuning efforts.

#### COST

The first number is the start-up cost (time to retrieve the first record). The second number is the cost to process the entire node from start up to completion.

`(**cost=86.83..4577.07** rows=2368 width=10)`

Cost is an **estimate** that the Postgres query planner generates based on object (generally table) **statistics**. While this number does not represent the actual runtime, it should be directly correlated to the actual execution.

Cost is a combination of several work components: sequential fetch, non-sequential (random) fetch, processing of row, processing operator (function), and processing index entry. The cost represents I/O and CPU activity; the larger the number, the more work Postgres thinks it will need to do in order to complete the task. It is important to note that the Postgres query optimizer determines which execution plan to use based on the cost.

#### ROWS

Estimated number of rows that will be output by this plan node.

`(cost=86.83..4577.07 **rows=2368** width=10)`

*Why this matters*: ROWS can be used to identify nodes that are returning large volumes of data and/or not behaving as expected.

#### WIDTH

Estimated average size (in bytes) of rows output by the node.

`(cost=86.83..4577.07 rows=2368 **width=10**)`

*Why this matters*: WIDTH can be used to identify nodes that output rows with very large properties, or a large number of columns.

### EXPLAIN ANALYZE

#### NODES

[See above.](#nodes)

#### ACTUAL TIME

Similar to *Cost*, the first number is the actual time in milliseconds (ms) needed for start-up. The second number is the actual time to process the entire node from start up to completion.

`(**actual time=10.313..12.530** rows=4857 loops=1)`

As the name implies, actual time is captured by executing the statement. The keyword `ANALYZE` tells Postgres to execute the query along with displaying the execution plan. If you are having trouble with a query timing out, removing `ANALYZE` will return just the query plan, which should be significantly faster than executing the query.

*Why this matters*: This is the clearest indicator of which node(s) or operations are causing the performance issues.

#### ROWS

Estimated number of rows that output by the node.

`(actual time=10.313..12.530 **rows=4857** loops=1)`

*Why this matters*: ROWS can help provide context as to *why* a particular operation might be taking longer than expected.

#### LOOPS

Reports the total number of executions of the node. The actual time and row values shown are averages per execution. Multiply the LOOPS value by the actual time to get the total time spent in the node.

`(actual time=10.313..12.530 rows=150 **loops=10**)`

## Understanding operations (plan nodes)

### Scans

* `sequential scans` (seq scan): The Seq Scan operation scans the entire relation (table) as stored on disk (like TABLE ACCESS FULL). It is always possible to perform a seq scans on a relation; regardless of the relation schema, size, constraints, and existence of index(es).
  * The following are characteristics of a seq scan:
    * Fast to start up (sequential I/O is much faster than random access).
    * Each block is read only once.
    * Produces unordered output.
* `index scans`: The Index Scan performs a B-tree traversal, walks through the leaf nodes to find all matching entries, and fetches the corresponding table data. It is like an INDEX RANGE SCAN followed by a TABLE ACCESS BY INDEX ROWID operation
  * The following are characteristics of an Index Scan:
    * Random access is much slower than sequential I/O.
    * Requires additional I/O to access index.
    * Potentially reads the same block multiple times.
    * Produces ordered output.
* `bitmap index/heap scans`: A plain Index Scan fetches one tuple-pointer at a time from the index, and immediately visits that tuple in the table. A bitmap scan fetches all the tuple-pointers from the index in one go, sorts them using an in-memory "bitmap" data structure, and then visits the table tuples in physical tuple-location order.
  * The following are characteristics of a bitmap index/heap scan:
    * Sequential I/O with index selectivity.
    * Slow to start up, as all index tuples are read and sorted.
    * Often selected for IN and =ANY(array) operators, as well as low selectivity index scans.
    * Can combine multiple indexes.
    * Produces unordered output.
* `index only`: The Index Only Scan performs a B-tree traversal and walks through the leaf nodes to find all matching entries. There is no table access needed because the index has all columns to satisfy the query (with the exception of MVCC visibility information).

### Joins

Join operations typically process only two tables at a time. When a query involves joining more than two tables, the joins are executed sequentially: first with two tables, then the intermediate result with the next table, and so on. In the context of joins, the term “table” could therefore also mean “intermediate result”.

* `nested loop`: Joins two tables by fetching the result from one table and querying the other table for each row from the first.
  * Generally the least performant form of join.
  * Fast to produce first record.
  * Negative performance possible if the second child is slow.
  * Only join capable of executing CROSS JOIN.
  * Only join capable of inequality join conditions.
* `merge join`: The (sort) merge join combines two sorted lists like a zipper. Both sides of the join must be presorted.
  * Can only be used for equality join conditions.
  * Generally the most performant for large data sets.
  * Requires ordered inputs - which can require slow sorts or index scans.
  * Slow to start up, as all index tuples are read and sorted.
* `hash joins`: The hash join loads the candidate records from one side of the join into a hash table (marked with Hash in the plan) which is then probed for each record from the other side of the join.
  * Can only be used for equality join conditions.
  * Generally the most performant for joining a large table against a small table.
  * Only for hashable data types.
  * Slow start due to hashing the smaller table.
  * Performance is negatively impacted if table stats out of date and incorrect.

### Aggregates

* `GroupAggregate`: Aggregates a presorted set according to the group by clause. This operation does not buffer large amounts of data.
* `HashAggregate`: Uses a temporary hash table to group records. The HashAggregate operation does not require a presorted data set; instead, it uses large amounts of memory to materialize the intermediate result (not pipelined). The output is not ordered in any meaningful way.
* `Unique`
* `WindowAgg`: Indicates the use of window functions.

### Miscellaneous

* `Sort`
  * Occurs with ORDER BY, DISTINCT, GROUP BY, UNION, and merge joins.
  * Considerable startup time.
  * If sort fits in `work_mem`, then quicksort can be used.
  * If sort does not fit into memory, it will spill to disk and use temporary files, which can be very expensive.
* `Limit`
  * Handles both LIMIT and OFFSET.
  * Can be used for min() and max() if there is no WHERE clause.
  * Records skipped for OFFSET are still generated/materialized but are discarded before results are returned.
  * The cost of child scan is still the full cost.
  * Sort combined with limit can use an optimized form of sort.

## Query tuning best practices

### SELECT

* Include only the attributes that are needed for display, which will help limit the pages fetched to support the request.

### DISTINCT

* `DISTINCT` comes from an older part of the PostgreSQL code base and uses a less efficient method for identifying distinct records.
* If possible, avoid the use of `DISTINCT` by using GROUP BY or a subquery.

### JOIN

* When joining tables, try to use a simple equality statement in the ON clause (such as `a.id = b.person_id`). Doing so allows more efficient join techniques to be used (such as Hash Join rather than Nested Loop Join).
* Convert subqueries to JOIN statements when possible as this usually allows the optimizer to understand the intent and possibly chose a better plan.
* Use JOINs properly: Are you using GROUP BY or DISTINCT just because you are getting duplicate results? This usually indicates improper JOIN usage and may result in a higher costs.
* If the execution plan is using a Hash Join it can be very slow if table size estimates are wrong. Therefore, make sure your table statistics are accurate by reviewing your vacuuming strategy.
* Avoid correlated subqueries where possible; they can significantly increase query cost.
* Use EXISTS when checking for existence of rows based on criterion because it “short-circuits” (stops processing when it finds at least one match).

### WHERE clause

* Avoid LIKE if possible.
* Avoid passing large lists into an IN() statements - instead, consider using a JOIN condition or adjusting logic to be exclusion-based.
* Avoid function calls in the WHERE clause.

### GROUP BY & GROUPING SET

See [PostgreSQL GROUPING SETS documentation ↗](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-GROUPING-SETS).

### UNION vs UNION ALL

UNION will eliminate duplicate records; this requires sorting the tables in question.

We strongly suggest avoiding the use of UNION given the cost associated with the request. There should be very few instances where this is required and, if so, it should be done in the Transforms layer before querying from Slate.

UNION ALL will not eliminate duplicates and will efficiently append the rows of one table to another.

See [Common Mistakes: UNION VS. UNION ALL ↗](https://www.cybertec-postgresql.com/en/common-mistakes-union-vs-union-all/).

## Indexes

Considering adding indexes under the following conditions:

* Eliminate sequential scans (seq scan), unless it is a small table and/or the query is fetching more than 5% of the rows.
* If using a multi-column index, pay attention to the order in which you define the included columns.
* Use indexes that are highly selective on frequently-used columns.

### Identify missing indexes

```sql
SELECT
  relname,
  seq_scan - idx_scan AS too_much_seq,
  CASE
    WHEN seq_scan - coalesce(idx_scan, 0) > 0 THEN 'missing index?'
    ELSE 'OK'
  END,
  pg_relation_size(relname::regclass) AS rel_size, seq_scan, idx_scan
FROM pg_stat_all_tablesWHERE schemaname = 'public'AND pg_relation_size(relname::regclass) > 80000
ORDER BY too_much_seq DESC;
```

### Identify unused indexes

```sql
SELECT
  indexrelid::regclass as index,
  relid::regclass as table,
  'DROP INDEX ' || indexrelid::regclass || ';' as drop_statement
FROM pg_stat_user_indexes
JOIN pg_index USING (indexrelid)
WHERE idx_scan = 0AND indisunique is false;
```

### Index-only scans (covering index)

Read more about the proper use and benefits of [index-only scans ↗](https://www.postgresql.org/docs/10/indexes-index-only-scans.html).
