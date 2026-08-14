<!-- source: https://palantir.com/docs/foundry/optimizing-pipelines/overview/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Optimizing pipelines

In the course of creating [data pipelines](/docs/foundry/data-integration/data-pipeline/) in Foundry, you may run into cases where it is necessary to understand the details of how computation works behind the scenes in order to effectively debug job failures or improve compute performance. In general, you should follow these steps when you encounter unexpected compute issues or performance problems.

Note that if your pipeline is a [batch pipeline](/docs/foundry/building-pipelines/pipeline-types/#batch), you may be able to speed up some compute jobs by making better use of the Spark engine that underlies computation in Foundry. However, this sort of performance tuning has limits. If your pipeline inputs are growing rapidly over time, you may need to adapt your pipeline to be [incremental](/docs/foundry/building-pipelines/pipeline-types/#incremental) instead, to only process the rows or files of data that are actually changing.

If you want to start by debugging a job or end-to-end pipeline that is failing unexpectedly, refer to these guides:

* [Debug a failing job](/docs/foundry/optimizing-pipelines/debug-job/)
* [Debug a failing pipeline](/docs/foundry/optimizing-pipelines/debug-pipeline/)

If you are interested in understanding how computation works in Foundry under the hood, begin by [exploring the Spark core concepts](/docs/foundry/optimizing-pipelines/spark-concepts/).
