<!-- source: https://palantir.com/docs/foundry/building-pipelines/stream-vs-batch/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Comparison: Streaming vs batch

When deciding whether to process data in Foundry as a stream or as a batch dataset, it is important to understand the requirements of your particular use case. We recommend considering the feature, performance, and technical expectations of both streaming and batch pipelines to ensure you choose the tool that works best for your use case.

Generally, streaming is used for workflows that require low end-to-end latency. For uses cases that can tolerate more than ten minutes of latency, [incremental](/docs/foundry/building-pipelines/pipeline-types/#incremental) or standard batch [datasets](/docs/foundry/data-integration/datasets/) may also be suitable solutions.

## Feature considerations

Streaming and batch pipelines share many common features. The primary differences to consider are latency, compute cost, and supported transform languages. The table below shows the features available for streaming and batch pipelines.

|Feature	|Streaming	|Batch	|
|---	|---	|---	|
|Higher latency data usage for all Foundry products	|Yes	|Yes	|
|Transactional	|Yes	|Yes	|
|Atomic	|Yes	|Yes	|
|Branching	|Yes	|Yes	|
|Security markings and classifications	|Yes	|Yes	|
|Provenance tracking	|Yes	|Yes	|
|Ontology support	|Yes	|Yes	|
|Time series support	|Yes	|Yes	|
|Java supported transforms	|Yes	|Yes	|
|Pipeline Builder support	|Yes	|Yes	|
|Python supported transforms	|No	|Yes	|
|Low latency data access	|Yes	|No	|

## Front-end tools

Some Foundry front-end tools can consume a streaming dataset in "real time", such as live updating a graph. The tools that can natively consume streams are [Ontology](/docs/foundry/ontology/overview/), [Pipeline Builder](/docs/foundry/pipeline-builder/overview/), [Quiver](/docs/foundry/quiver/overview/), [Dataset Preview](/docs/foundry/dataset-preview/overview/), and [Foundry Rules](/docs/foundry/foundry-rules/overview/). Other apps in Foundry, like [Contour](/docs/foundry/contour/overview/), can consume the stream's archival dataset. This is a standard batch dataset that updates with the stream's newest data every few minutes. In practice, you can select the streaming dataset in any app you want, and Foundry will automatically know which mode to use.

## Performance considerations

Along with feature considerations, consider the different performance expectations between streaming and batch pipelines. These factors include latency and throughput. Review [streaming latency and throughput considerations](/docs/foundry/building-pipelines/streaming-performance-considerations/) for additional details.

## Technical considerations

In addition to the feature and performance factors that define streaming and batch processing, consider technical factors including state management, downtime impact, and consumption layer latency.

### State management

In contrast to batch transforms, where the size of inputs is bounded and known ahead of time, [stateful streaming ↗](https://nightlies.apache.org/flink/flink-docs-master/docs/concepts/stateful-stream-processing/) applications may have unbounded state that can grow over time and result in an out of memory error at an unknown point in the future.  As an example, performing an aggregation over one or more keys is generally a dangerous operation if the size of the key space is unbounded. Unlike batch compute, it is usually difficult to anticipate and provision sufficient resources. For this reason, and due to the temporal nature of most streaming applications, ensure state growth is not unbounded when designing streaming transforms.

### Low latency

Low latency is usually an important requirement of a streaming pipeline, but achieving low latency is not always a clear process. Since streaming pipelines typically have multiple steps, latency is bounded by the highest latency across all layers. Therefore, achieving low latency may involve fine-tuning multiple applications and consumption layers, from the source system to the streaming application and downstream consumers.

### Downtime impact

Since batch pipelines are not typically used for operational workflows with strict low latency requirements, they tend to have a higher tolerance to downtime compared with streaming pipelines. Batch pipelines usually run on a fixed schedule; an individual run failure is not typically a major issue and the build can be retried. In contrast, streaming pipelines are continuously running processes with no defined endpoint, and failures are often more impactful. A 10 minute outage of a data store holding real time data has a much higher impact than a 10 minute outage of a data store with daily updates.

### Consumption layer latency

Because batch pipelines are usually held up by transforms rather than reading or writing data, almost any consumption layer can be used. For streaming pipelines, consumption layers that natively support fast, frequent writes are required to maintain low latency. This means that each application in the end-to-end pipeline must be able to process data with low latencies to ensure low end-to-end latency. Most Foundry products support this natively, including Pipeline Builder, time series, Foundry Rules, and the Ontology. Data connectors also exist to support low latency writes to external systems.

## Cost considerations

Due to the high-throughput, low-latency computation, the average cost of a streaming pipeline is often higher than the average cost of a batch pipeline. However, for a streaming-shaped pipeline, which requires low-latency processing of data, streaming could be the most cost-effective solution compared to a continuously running batch pipeline.

Review [Compute usage with Foundry Streaming](/docs/foundry/building-pipelines/streaming-compute-usage/) for more information on how streaming costs are computed.
