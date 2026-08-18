<!-- source: https://palantir.com/docs/foundry/building-pipelines/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Building pipelines

The very first steps to creating a [data pipeline](/docs/foundry/data-integration/data-pipeline/) are to connect organizational data sources to Foundry and get data flowing through the system. Initially, the emphasis should be on validating that data is high-quality and can serve as a reliable foundation for use case development, model development, and analytics.

This section of documentation focuses on the initial stages of creating a pipeline, when business requirements may still be in flux and changes to pipeline logic are occurring frequently. In this phase, the emphasis is on laying a solid foundation—both to support target use cases and to enable pipeline maintenance in the future.

:::callout{theme="success" title="Palantir Learning portal"}
You can find a deep dive course on building your first pipeline at [learn.palantir.com ↗](https://learn.palantir.com/deep-dive-building-your-first-pipeline).
:::

## Initial steps

In most cases, these are the initial steps you should follow in pipeline development:

* Set up the [recommended Project structure](/docs/foundry/building-pipelines/recommended-project-structure/) so that data security and governance are organized from the very beginning of your development process.
* Create a batch pipeline in [Pipeline Builder](/docs/foundry/building-pipelines/create-batch-pipeline-pb/) or [Code Repositories](/docs/foundry/building-pipelines/create-batch-pipeline-cr/) to process input datasets, perform data cleaning and filtering, and join with other datasets to create high-quality datasets that can feed into the [Ontology](/docs/foundry/ontology/overview/) to support workflow development.
* Map your final datasets into [object types](/docs/foundry/object-link-types/object-types-overview/) and [link types](/docs/foundry/object-link-types/link-types-overview/) in the Ontology.
* Set up [schedules](/docs/foundry/building-pipelines/scheduling-overview/) so that data begins to flow through regularly.

Beyond these steps, there are a number of steps you can take to make your pipeline more robust and scalable, including adding unit tests, setting up a branching and release process, and defining health checks. [Learn about best practices for pipeline development](/docs/foundry/building-pipelines/development-best-practices/).

## Incremental pipelines

If the scale of changes to the input data flowing into your pipeline is high, it may be best to create an [incremental pipeline](/docs/foundry/building-pipelines/incremental-overview/) to process the changed data in a performant way. In most cases, you can begin with a batch pipeline and put an incremental pipeline into place afterwards to improve performance and reduce latency.

In some cases, it is preferable to design your pipeline to be incremental from the start, especially when you know that the scale of new data flowing into your pipeline will be very high. However, writing and maintaining incremental pipelines comes with much more complexity than batch pipelines. [Learn more about the different types of pipelines in Foundry](/docs/foundry/building-pipelines/pipeline-types/).

## Streaming pipelines

If the requirements for the latency of your data are very low, it may be best to create a [streaming pipeline](/docs/foundry/building-pipelines/streaming-overview/) to process input data in a performant way. Given streaming pipelines are only as fast as their slowest component, pipelines should be designed from the start to ensure the pipeline will hit the target latency and throughput. Review our [comparison of streaming versus batch processes](/docs/foundry/building-pipelines/stream-vs-batch/) for a more nuanced analysis.
