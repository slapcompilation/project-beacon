<!-- source: https://palantir.com/docs/foundry/slate/references-indexes/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Optimize indexes and schema design

:::callout{theme="neutral"}
The documentation on this page focuses on tuning indexes for optimal performance in Postgres and ElasticSearch. We generally recommend building Slate applications on top of Ontology capabilities, using features like [Object Sets](/docs/foundry/slate/concepts-object-sets/) and [Actions](/docs/foundry/slate/applications-writeback/#write-back-data-with-actions) for reading and writing data.
:::

A performant and maintainable application relies on well factored datasets and proper indexing.

Most aspects of schema design for Postgres are completely agnostic to Slate. These concepts are well-documented elsewhere and generic best practices for database design is outside the scope of this discussion. Google will rapidly take you down that rabbit hole if you are not already familiar with different schema patterns or guidance on choosing which columns to index.

Instead, this section focuses on best practices that relate specifically to Slate and Foundry.

#### Push work as far upstream as possible

At every stage in the application development process, ask the question: “Where is the right place to do this work?” and always bias towards moving work as far upstream as possible. For instance, if you find yourself writing a complicated JavaScript function to aggregate your data or extract metrics, ask: “Can I do this instead in my query?”

If you are doing the same work in a query on every page load, for instance deriving a yearly total with a `SUM()` or creating a list with a `DISTINCT()`, ask yourself: “Can I do this in a derived dataset?”

In Foundry, distributed storage and compute are “cheaper” compared to work done in a query or in the users browser, so pre-compute as much as possible.

#### Postgate (Postgres)

Postgate wraps Postgres or RDS for straightforward read-only access to Foundry datasets through PostgreSQL queries. Remember that the limitations of your application queries are determined by the characteristics of relational databases (rather than Spark/HDFS in the rest of the platform) in general, and Postgres specifically.

As you develop queries to retrieve data, use EXPLAIN ANALYZE to profile your query and find bottlenecks. You can learn more about how Postgres interprets your query and how to interpret the results of an EXPLAIN ANALYZE request in this [Thoughtbot blog post ↗](https://robots.thoughtbot.com/reading-an-explain-analyze-query-plan). You can also read our more detailed explanation on [optimizing Postgres queries for Slate](/docs/foundry/slate/references-query-perf/).

You can build modular queries to prevent code re-use and better encapsulate shared logic using [Partials](/docs/foundry/slate/concepts-queries/#query-partials). We recommend using partials and functions to trade off between keeping your queries streamlined and verbose enough to be readable.

#### Phonograph (ElasticSearch)

Phonograph provides a read and write datastore that uses ElasticSearch-style syntax for queries and aggregation, while also allowing CRUD operations on top of Foundry datasets. For much more on Phonograph practices, see the section [Writeback Data from Slate to Foundry](/docs/foundry/slate/applications-writeback/).
