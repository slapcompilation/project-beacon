<!-- source: https://palantir.com/docs/foundry/pipeline-builder/core-concepts/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Core concepts

This page provides an introduction to the core concepts of Foundry data integration that are relevant to Pipeline Builder.

## Build

The concepts of [datasets](#datasets), [branches](#branches), [transforms](#transforms), and [outputs](#pipeline-outputs) are fundamental to Pipeline Builder. We recommend reviewing these topics before building your first pipeline and as you transform your data and integrate towards pipeline outputs.

### Datasets

Datasets are the building blocks of a pipeline. In the data integration process, data is represented as **Foundry datasets** from when the data lands in Foundry until the data is mapped into the [Ontology](/docs/foundry/ontology/overview/) object model.

Fundamentally, a [Foundry dataset](/docs/foundry/data-integration/datasets/) is a wrapper around a collection of files which are stored in a [backing file system](/docs/foundry/data-integration/datasets/#backing-filesystem). Pipeline Builder is primarily intended for structured data but can also be used for semi-structured data.

[Learn more about input datasets in Pipeline Builder.](/docs/foundry/pipeline-builder/datasets-overview/)

### Branches

Version control is crucial to maintaining healthy pipeline workflows. In Pipeline Builder, version control is implemented with pipeline **branches**, which operate similarly to code branches in Git version control.

A pipeline branch is a copy of the pipeline on which a user can iterate without saving back to the main pipeline, similar to a code branch in Git. Users can make changes, preview, save, and build on their branch. Once they are happy with the changes, they can propose to merge back into the **Main** branch, similar to merging a Git pull request.

[Learn more about branches in Pipeline Builder.](/docs/foundry/pipeline-builder/branches-overview/)

### Transforms

A transform can be thought of as a function definition; that is, a transform accepts a set of inputs (such as datasets) and produces a set of outputs. A pipeline is a linkage of datasets, data expectations, and targeted data outputs that are connected by transforms.

[Learn more about transforms in Pipeline Builder.](/docs/foundry/pipeline-builder/transforms-overview/)

### Pipeline outputs

Outputs in Pipeline Builder are the result of transforms performed in the pipeline and can be datasets, [virtual tables](/docs/foundry/data-integration/virtual-tables/), or Ontology components such as object types, object link types, or time series. Outputs can be used in other Foundry applications such as Quiver or Code Workbook.

[Learn more about pipeline outputs in Pipeline Builder.](/docs/foundry/pipeline-builder/outputs-overview/)

## Manage

The concepts of [schedules](#schedules) and [data expectations](#data-expectations) are useful for maintaining healthy, stable pipelines. We recommend learning more about these topics once you build your first pipeline.

### Schedules

**Schedules** are used to run [dataset builds](/docs/foundry/data-integration/builds/) on a recurring basis to keep data flowing through Foundry consistently. In Pipeline Builder, builds can be scheduled at a specific time, on a specific cadence, or based on the status of a parent resource; for example, you can set a build to occur when an upstream dataset is updated.

[Learn more about schedules in Pipeline Builder.](/docs/foundry/pipeline-builder/schedules-overview/)

### Data expectations

Pipeline Builder supports data expectations on outputs and intermediate transforms through unit tests. Data expectations are requirements that can be applied to dataset outputs. These requirements (known as "expectations") can be used to create checks that improve data pipeline stability.

Data expectations can be set on each pipeline output to define an expectation on the resulting output. Pipeline Builder currently supports two data expectation types: primary key and row count.

If any expectations fail, the build will be failed. The job expectations pane will show which data expectations passed and failed.

[Learn more about data expectations in Pipeline Builder.](/docs/foundry/pipeline-builder/dataexpectations-overview/)
