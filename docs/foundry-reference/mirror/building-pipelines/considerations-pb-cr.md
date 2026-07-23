<!-- source: https://palantir.com/docs/foundry/building-pipelines/considerations-pb-cr/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Considerations: Pipeline Builder and Code Repositories

Foundry has two products available for writing and managing data pipelines: **Pipeline Builder** and **Code Repositories**. These tools are complementary and are built to work together to provide solutions for all pipelining needs. The guide below is intended to help you determine which tool is best suited to your use case and how to use them in conjunction with each other.

## Pipeline Builder

Pipeline Builder is Foundry’s primary application for fast, flexible, and scalable delivery of data pipelines while providing robustness and security. With Pipeline Builder, end users and data engineers can collaborate in a graph and form-based environment to integrate data, create business logic transformation, and define a rigorous release process for production pipelines. Users can write pipelines that provide real time feedback, with no need to use code. Additionally, Pipeline Builder uses health checks that guarantee only fully compliant data will be deployed to production. [Learn more about Pipeline Builder.](/docs/foundry/pipeline-builder/overview/)

## Code Repositories

Code Repositories provides a web-based integrated development environment (IDE) for writing and collaborating on production-ready code in Foundry. The application provides a user-friendly way to interact with the underlying Git repository. [Learn more about Code Repositories.](/docs/foundry/code-repositories/overview/)

## Best practices

We recommend building your pipeline design in Pipeline Builder. Doing so will:

* Enable collaboration between different user groups through an easily understandable point-and-click interface.
* Safeguard pipeline health by utilizing Pipeline Builder’s rails for safe and usage-efficient data transformations and pipeline management.

In cases where users require specialized code-based logic not available in Pipeline Builder, Code Repositories should be used to create those stages to add to the main pipeline. Some examples of these specialized cases include:

* Making API calls
* Using custom libraries
* Adding code-based logical concepts

Since both Pipeline Builder and Code Repositories use Foundry datasets as inputs and outputs, a pipeline input built in Code Repositories can be added before, after, and in the middle of a pipeline in Pipeline Builder. Schedules and health checks can be configured for the full pipeline in Data Lineage, regardless of the application used to create the pipeline. [Learn more about Data Lineage.](/docs/foundry/data-lineage/overview/)

## Feature summary

The following table describes the features and support available in Pipeline Builder and Code Repositories. As explained above, using both tools together allows you to create robust, type-safe, reusable pipelines with specialized, code-based logic.

|	|**Pipeline Builder**|**Code Repositories**	|
|---	|---	|---	|
|**Recommended use**	|Build and maintain production pipelines for organizations and specialized pipelines for cross-organization collaboration.	|Create specialized, code-based data transformations to add to a pipeline.	|
|**Build interface**	|	|	|
|Pipeline interface	|Graph and form-based 	|Web-based integrated development environment (IDE)	|
|Supported languages	|No code required 	|Python, SQL, Java, Mesa	|
|Reusabilty 	|Copy and paste complete pipelines or pipeline stages.	|Reuse utility functions and libraries, and copy code between files.	|
|Type-safe functions	|Strongly typed; errors are flagged immediately instead of at build time.	|Code-based; errors surfaced at build time.	|
|Parameters	|User-defined persistent parameters that can be used across a pipeline.	|Code-defined constant can be used in a repository.	|
|**Supported pipelines**	|	|	|
|Batch pipeline	|Yes	|Yes	|
|Streaming pipeline	|Yes	|Yes (for advanced users)	|
|File Based transformation	|Yes	|Yes	|
|Incremental computation	|[Yes](/docs/foundry/pipeline-builder/datasets-computation-modes-for-batch/#incremental-computation)	|[Yes](/docs/foundry/transforms-python-spark/incremental-examples/)	|
|Filesystem and API access	|No	|[Yes](/docs/foundry/transforms-python/unstructured-files/)	|
|**Pipeline testing** 	|	|	|
|Data preview scope	|Preview based on full dataset.	|Preview data sample.	|
|Data preview timeline	|Preview updates in real time. 	|Preview upon request.	|
|Data preview checkpoints	|Preview each transformation step.	|Preview intermediary dataframes and variables at selected checkpoints in debug mode.	|
|Debug	|Type-safe; errors surface while creating the pipeline and do not require checks or builds to debug.	|Debugger and Read-Eval-Print Loop (REPL) support.	|
|Unit testing	|[Yes](/docs/foundry/pipeline-builder/dataexpectations-unit-tests/)	|[Yes](/docs/foundry/code-repositories/unit-tests/) (for advanced users)	|
|**Pipeline management**	|	|	|
|Data expectations	|Yes	|Yes	|
|Schedules	|Yes	|Yes	|
|Publish custom libraries	|In development	|[Yes](/docs/foundry/transforms-python/share-python-libraries/)	|
|Versioning	|Full versioning workflow on rails for no-code/high-code user collaboration.	|Full Git workflow.	|
|Build memory management	|Users can set an approved or custom compute profile.	|Code-based configuration is available.	|
|Manage security markings	|[Yes](/docs/foundry/pipeline-builder/outputs-remove-markings-and-organizations/)	|[Yes](/docs/foundry/building-pipelines/remove-inherited-markings/)	|
