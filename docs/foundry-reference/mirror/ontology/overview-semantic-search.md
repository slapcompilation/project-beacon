<!-- source: https://palantir.com/docs/foundry/ontology/overview-semantic-search/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Semantic search

Semantic search is a way to search for text based on the inherent meaning or context, rather than relying solely on keywords or other traditional search methods.

Semantic search is accomplished using AI models to transform the text into vectors, which are arrays of numbers, and are called "embeddings". If the model is effective, the vectors, each of size N, that are close to each other in N-dimensional space are the ones that have similar underlying or semantic meaning. For example, the embedding vector of “face mask” will be closer to the embedding vector of “face covering” than it is to “respirator.”

![Embeddings visualization.](/docs/resources/foundry/ontology/aip-embeddings-visualization.png)

If the embedded text is then associated with a particular object in the [Ontology](/docs/foundry/ontology/overview/), then your search-driven operational workflows become much more useful. Finding related entities or entities related to a particular search query is simply finding the nearest vectors in N-dimensional space.

Review the following documentation pages for topics related to semantic search:

* [Learn how to create a semantic search workflow using a Palantir-provided model](/docs/foundry/ontology/using-palantir-provided-models-to-create-a-semantic-search-workflow/)
* [Learn how to create a semantic search workflow using a custom model](/docs/foundry/ontology/using-custom-models-to-create-a-semantic-search-workflow/)
* [Learn how to incorporate chunking into your semantic search workflow](/docs/foundry/ontology/document-processing/#chunking)
* [Learn how to use PDFs in your semantic search workflow](/docs/foundry/ontology/ontology-augmented-generation/)
* For additional learning materials, see our [YouTube video on "Building with Palantir AIP: Semantic Search" ↗](https://youtu.be/7rRLOTXe60Q) and [blog on "Building with Palantir AIP: Semantic Search" ↗](https://blog.palantir.com/building-with-palantir-aip-semantic-search-dc3adf40f6a6).
