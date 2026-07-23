<!-- source: https://palantir.com/docs/foundry/pipeline-builder/management-overview/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Pipeline management

This page outlines features and best practices for pipeline management in Pipeline Builder.

## Reusing logic across a pipeline

Pipeline Builder supports reusing logic across a pipeline via [parameters](/docs/foundry/pipeline-builder/management-parameter-overview/) and [custom functions](/docs/foundry/pipeline-builder/management-create-custom-functions/). Parameters are values that can be used in multiple transforms in a pipeline. Custom functions are a series of transforms centrally defined as a single transform.

## Large pipeline management

Pipeline Builder supports grouping and optimization features to help manage large pipelines.

You can create [folders](/docs/foundry/pipeline-builder/management-file-tree/) and sub-folders in Pipeline Builder to group nodes. This allows you to organize nodes and toggle the visibility of nodes in a subset of folders to narrow the scope of your pipeline.

You can use [node color groups](/docs/foundry/pipeline-builder/management-color-groups/) in Pipeline Builder to collapse nodes of the same color and improve the readability of your graph.

You can focus on a subsection of your graph by [showing and hiding](/docs/foundry/pipeline-builder/management-show-hide-nodes/) nodes. You can choose these nodes manually or show and hide them based on color groupings.

[Job grouping](/docs/foundry/pipeline-builder/management-job-groups/) in Pipeline Builder allows you to control how your outputs are split into jobs, and compute profiles for each job.

When building pipelines, you can mark transform nodes that are shared between multiple outputs as [checkpoints](/docs/foundry/pipeline-builder/management-checkpoints/). These intermediate results will be computed only once during your next build, which can save compute.

For faster previews, you can add [input sampling](/docs/foundry/pipeline-builder/management-input-sampling/) to downsample your input data as you are prototyping your pipeline. Pipeline deploys will still run on the full dataset.
