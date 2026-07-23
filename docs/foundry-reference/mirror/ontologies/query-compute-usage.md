<!-- source: https://palantir.com/docs/foundry/ontologies/query-compute-usage/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Compute usage with Ontology queries

The Foundry Ontology is a data backend that maps file-based data to organization-centric objects and serves high-speed queries for data exploration, data analysis, operational data editing, scenario analysis, and more. The Ontology stores data in multi-modal storage backends that each have their own purposes and can be flexibly queried in a single request. Querying the Foundry Ontology requires knowledge of some foundational concepts discussed below.

:::callout{theme="neutral"}
If you have an enterprise contract with Palantir, contact your Palantir representative before proceeding with compute usage calculations.
:::

## Core concepts: Object types and object sets

The first important concept is the difference between an **object type** and its corresponding **object set**. An **object type** is the semantic representation of the entity itself (such as the name and properties of the object).

An object type has a corresponding **object set**, which contains the objects themselves. The size of the **object set** corresponds to the number of rows of the incoming dataset and the number of objects created and deleted by Ontology actions.

## Core concept: Query types

The second important concept is the idea of **query types**, which include filters, aggregations, Search Arounds, and writeback operations. Each query type requires compute to execute. See [Ontology Query Compute (2026)](#ontology-query-compute-2026) for the current compute-second overhead per query type.

When using the Foundry Ontology, **query types** are executed against **object sets** by the following [Foundry Applications](/docs/foundry/ontology/applications/):

* Object Explorer
* Workshop
* Quiver
* Slate
* Vertex
* Foundry Rules
* Foundry Machinery
* Object APIs (OPIs)

Querying the ontology from any of these sources will use compute-seconds to run the query.

## Investigating Foundry compute usage from Ontology queries

In Foundry, compute-seconds are attributed to resources in the platform rather than to the users that are interacting with those resources.

When it comes to Ontology queries, there are multiple ways in which compute is attributed. As a general rule, the compute is attached to the resource where the query originated. However, when there is no saved resource that is used to generate the compute (such as via API), the compute will be attached to the object types that are being queried. If multiple objects are queried in a single request, then the compute is attributed via an even split between the objects.

The following resource types have Ontology query compute attributed to them, rather than the underlying objects:

* Workshop applications
* Carbon pages
* Quiver analyses and dashboards
* Vertex applications
* Slate applications
* Foundry Machinery applications
* Foundry Rules resources
* Foundry Automate
* AIP Logic
* SQL Console worksheets
* OSDK applications

The following interaction patterns have their Ontology query compute attached directly to the object types that they query, given there is no set resource to which the compute can be attached.

* Object Explorer
* Object APIs (including the OSDK)

## Ontology Query Compute (2026)

:::callout{theme="neutral" title="Effective January 1, 2026"}
The following compute model takes effect on January 1, 2026, and replaces the legacy model described in the [Legacy](#measuring-foundry-compute-with-ontology-object-queries-legacy) section below.
:::

Ontology Query Compute is driven by Ontology use by users and agents. Consider the primary factors that determine compute usage:

### Factor 1: Number of users and agents

Compute-seconds are measured cumulatively. The more queries and transformations run against the ontology, the higher the overall compute usage. Query volume grows linearly with user interactions — such as application refreshes and interactive queries — as well as agentic transformations.

### Factor 2: Query type

Users can access their Ontology through the following query types, each associated with a minimum compute-second overhead per query. Actual compute usage may be higher depending on query complexity and the size of the object set, or number of objects queried.

* **Base query:** Returns the object set as-is or with basic filtering on certain properties.
* **Search Around query:** Takes an incoming object set and runs a secondary filter on another object set based on a certain property of the incoming set.
* **Aggregation query:** Takes an input object set and runs an aggregating function (such as `sum` or `avg`) on one of the properties for all objects in the set.
* **[Ontology SQL query](https://www.palantir.com/docs/foundry/sql-warehousing/ontology-sql):** Runs SQL queries directly against object types, links, and interfaces using standard Spark SQL syntax against object storage.
* **Advanced query:** Anything not covered by other query types. For example, applying a semantic search over embeddings across a full object set.
* **Derived Property query:** Derived Properties are properties calculated at runtime based on the values of other properties or links on objects, including aggregating on or selecting properties of linked objects. Derived properties are then available for further operations such as filtering, sorting, or aggregating within the same request.
* **Actions:** Writeback operations that replace the values of properties of objects in a designated object set. Actions have a minimum overhead of `18` compute-seconds and scale with the number of objects edited, incurring an additional `1` compute-second per object edited beyond the first.
* **Ontology Compute (Phonograph) \[Legacy]:** Queries against objects still using the Object Storage v1 (OSv1) backend. These appear as "Ontology Compute (phonograph)" in the Resource Management Application. The [existing OSv1 compute model](#measuring-compute-with-object-storage-v1-legacy) has been retained for these queries.

**The following table summarizes the minimum compute-second overhead per query type.**

| Query Type                  | Minimum compute-seconds overhead |
|-----------------------------|----------------------------------|
| Base query                  | 2                                |
| Search Around query         | 5                                |
| Aggregation query           | 5                                |
| Ontology SQL query          | 5                                |
| Advanced query              | 10                               |
| Derived Property query      | 10                               |
| Actions                     | 18                               |
| Ontology Compute (Phonograph) \[Legacy] | 16                               |

:::callout{theme="neutral"}
The existing compute model for Object Storage v1 (OSv1) queries has been retained. Any queries against objects still using the OSv1 backend carry a minimum compute-second overhead of `16` compute-seconds per query.
:::

***

## Measuring Foundry compute with Ontology object queries \[Legacy]

:::callout{theme="neutral" title="Legacy"}
The following sections describe the legacy compute model that was in effect before January 1, 2026. It is preserved for reference. For the current compute model, see [Ontology Query Compute (2026)](#ontology-query-compute-2026) above.
:::

Under the legacy model, querying the ontology uses compute-seconds as follows:

* A fixed, minimum number of compute-seconds for query overhead.
* An additional scaling number of compute-seconds, which are measured by the amount of compute used to service the query.

### Measuring compute with Object Storage v1 \[Legacy]

Object Storage v1 (Phonograph) stores data in a distributed set of indices in a durable, horizontally scalable cluster. In these indices, data sits in large data structures that are traversed by the Ontology query engine. When a query is executed, the engine can avoid processing large swaths of data during its search by traversing the index. This process is known as "pruning".

Using this engine, you can search through billions of records by evaluating up to 1000x fewer records. Each physical evaluation of a record is called a "hit". Object Storage v1 is designed to minimize the number of hits in each query.

### Measuring compute with Object Storage v2 \[Legacy]

Object Storage v2 (OSv2) stores objects in an enhanced indexing format that is optimized by Palantir for high-speed indexing, Search Arounds, and writeback, as well as smooth hand-offs to multiple compute backends to accomplish complex tasks. This includes a combination of fully parallelized Spark compute as a part of a query.

Given that Object Storage v2 also uses an efficient indexing structure, the same principle of **hits** from Object Storage v1 applies on basic queries. However, compute-seconds can also be used by on-demand Spark containers that are spun up as a part of the query.

Queries made to objects in the Object Storage v2 backend use compute in the following pattern:

* A minimum compute-second overhead of `16` compute-seconds per query for objects in the Object Storage v1 backend.
* A minimum compute-second overhead of `4` compute-seconds per query for objects in the Object Storage v2 backend. The optimized structure of Object Storage v2 requires less overhead than Object Storage v1 and therefore has a reduced minimum compute-second overhead.
* Additional compute-seconds are required when the process does computational work through the pruning process of the query. The additional compute-seconds scale with the number of objects in the index as well as the type of query.
* In Object Storage v2 (OSv2), the index pruning similarly requires additional compute seconds. However, OSv2 supports also on-demand Spark cluster searches when running search-arounds on over 100,000 objects, or running writeback operations on over 10,000 objects in a single request. These Spark clusters utilize usage in the same way as all other Spark-based applications on the platform. See the [parallelized compute documentation](/docs/foundry/resource-management/usage-types/) for a description.
* Actions with write-back into the Ontology have a minimum overhead. Each action has a compute-second overhead of `18`. Actions also scale with the number of objects that are edited in the write-back request, incurring an additional `1` compute-second per object edited beyond the first.
* Functions run via Functions on Objects have a minimum overhead. Specifically, each function execution has a fixed overhead of `4` compute-seconds.

**The following table summarizes the minimum compute-second usage per query type under the legacy model.**

| Query Type          | Minimum compute-seconds          |
|---------------------|----------------------------------|
| Ontology V1 query   | 16                               |
| Ontology V2 query   | 4                                |
| Action on Objects   | 18                               |
| Function on Objects | 4                                |

## Understanding drivers of Foundry compute usage with Ontology queries \[Legacy]

* As a very simple rule, the fixed compute-usage per query grows linearly with the number of queries. Performing fewer queries will use less compute in aggregate.
* More complex queries to the object set service, such as generic multi-object searches, will kick off multiple sub-queries to each object type. Limit your search to individual object types to reduce the number of queries you are using.
* Queries on smaller object sets will use less compute than those on larger object sets, as the number of **hits** in a query are proportional to the size of the object set being queried.
* Up-front filtering before performing other operations will take advantage of the highly indexed backend structure. This will reduce the number of **hits** in a query, reducing the overall compute usage. This is especially important with aggregations and Search Arounds, where filtered object sets require less compute to process than full object sets.

## Related resources

For best practices on writing efficient functions and Automate configurations that minimize compute usage:

* [Optimize function performance](/docs/foundry/functions/optimize-performance/)
* [Automate performance best practices](/docs/foundry/automate/performance-best-practices/)
