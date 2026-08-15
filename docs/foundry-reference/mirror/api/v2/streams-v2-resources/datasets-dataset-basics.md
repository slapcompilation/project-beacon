<!-- source: https://palantir.com/docs/foundry/api/v2/streams-v2-resources/datasets/dataset-basics/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Dataset basics

A Foundry stream is a combination of a streaming dataset (for "cold storage") and a buffer of data (for "hot
storage"). Streams are particularly useful for workflows that require second-level latency and constant
compute, such as real-time operational data analysis and processing.

Each branch of the streaming dataset can have one active stream.

For more information on streaming datasets,
[review Streams documentation.](/docs/foundry/data-integration/streams/)
