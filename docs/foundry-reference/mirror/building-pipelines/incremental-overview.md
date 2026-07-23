<!-- source: https://palantir.com/docs/foundry/building-pipelines/incremental-overview/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Incremental pipelines

[Incremental pipelines](/docs/foundry/building-pipelines/pipeline-types/#incremental) are often used to process input datasets that change significantly over time. By avoiding unnecessarily computing on all the rows or files of data that have not changed, incremental pipelines enable lower end-to-end latency while minimizing compute costs.

However, incremental pipelines carry additional development and maintenance complexity that you should be aware of before getting started.

## Background

Here are some of the factors related to incremental pipelines you may want to consider:

* Developing an incremental pipeline requires a thorough understanding of how datasets change over time in Foundry using [transactions](/docs/foundry/data-integration/datasets/#transactions). You will need to interact with the concepts of dataset transactions in Data Connection syncs and transformation logic to effectively create and manage an incremental pipeline over time.
* Once you understand how transactions work in Foundry, you will need to design your pipeline to be resilient to unexpected transactions in your input datasets. Although incremental pipelines generally only process changed data that arrives in the form of `APPEND` transactions, your logic must be resilient to input datasets occasionally being recomputed, which results in a `SNAPSHOT` transaction. Ideally, your transformation logic should be written with thorough [unit tests](/docs/foundry/transforms-python/unit-tests/) to validate behavior before this happens in practice.
* To ensure incremental pipelines remain performant in the long run, you will need to understand how datasets change over time when many `APPEND` transactions are applied, causing datasets to consist of a large volume of small files. This includes understanding how [Spark](/docs/foundry/optimizing-pipelines/spark-concepts/) handles large numbers of files and how this affects Spark partitioning. [Read more about maintaining high performance for incremental pipelines](/docs/foundry/building-pipelines/maintaining-incremental-performance/).

## Getting started

Get started with incremental pipelines by reviewing the following recommended resources:

* Learn how to [create incremental syncs](/docs/foundry/building-pipelines/create-incremental-syncs/) to bring data into Foundry incrementally.
* See an example of how to [create an incremental pipeline](/docs/foundry/building-pipelines/create-incremental-pipeline-pb/) with Pipeline Builder.
* Refer to the [Python incremental overview](/docs/foundry/transforms-python/incremental-overview/) to learn about developing incremental transform logic.
