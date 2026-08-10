<!-- source: https://palantir.com/docs/foundry/object-indexing/overview/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Indexing

In the Ontology, **indexing** is the process of making tabular or other forms of data in Foundry datasources available for faster data retrieval operations through specialized databases.

This section of documentation describes the indexing process for Object Storage v2, in which indexing is overseen by the Object Data Funnel service ("Funnel"). The Funnel service is responsible for orchestrating Funnel pipelines that create and modify object instances in the Ontology and ensure up-to-date data and metadata.

There are two main types of funnel pipelines, **funnel batch pipelines** and **funnel streaming pipelines**, which allow users to adopt one or the other indexing mechanism depending on their datasource landscape, latency and workflow requirements, and cost considerations.

[Learn more about Funnel batch pipelines.](/docs/foundry/object-indexing/funnel-batch-pipelines/)

[Learn more about Funnel streaming pipelines.](/docs/foundry/object-indexing/funnel-streaming-pipelines/)

For low-latency writes and edits into the Ontology, you can also use [direct datasources](/docs/foundry/object-indexing/direct-datasources/).

For information about Object Storage v1 (Phonograph) indexing, review the [legacy documentation](/docs/foundry/object-databases/object-storage-v1/).
