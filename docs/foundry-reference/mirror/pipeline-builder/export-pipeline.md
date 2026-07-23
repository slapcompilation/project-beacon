<!-- source: https://palantir.com/docs/foundry/pipeline-builder/export-pipeline/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Export pipeline code

When building in Pipeline Builder, you can export your pipeline code to an existing [Java transforms repository](/docs/foundry/transforms-java/getting-started/). This export feature is useful in situations where you need access to specific Java libraries.

During an export, your pipeline will be converted to Java transform code that will then be pushed to the target repository. Keep the following considerations in mind for this process:

* Any existing code or files on the specified branch of the target repository will be deleted.
* The new output of the Java transform code may not always be identical to the output of the Pipeline Builder pipeline. See [Exporting Pipeline Builder to Java transforms](#exporting-pipeline-builder-to-java-transforms) for more details.
* This process is irreversible, meaning any changes to the Java transforms code cannot be pushed back into the Pipeline Builder pipeline.
* Some pipeline transformations cannot be converted to code.

Open the pipeline you wish to export and navigate to **Settings > Export code**. A pop-up window will appear where you can search for and select the existing target Java transforms repository. Then, choose the Pipeline Builder branch the export comes from, and optionally create a new branch to use in the target repository.

![The Export pipeline code pop-up window where you can specify the target repository and the host and target branches for the export. ](/docs/resources/foundry/pipeline-builder/export-pipeline-code.png)

The pipeline export will be available for use in `transforms-java/src/main/java/com/` in your repository as `PipelineLogic.java` and `PipelineOutputs.java` files.

![The file navigation view on the left side panel in Code Repositories.](/docs/resources/foundry/pipeline-builder/pipeline-export-files.png)

## Exporting Pipeline Builder to Java transforms

When exporting Pipeline Builder pipelines to Java code, it is important to recognize that the new output may not always be identical to the original pipeline output. There are a few reasons for this:

* Code generation limitations: Certain functionalities, such as user-defined functions (UDFs) and LLM calls, are not supported and require manual implementation. This will show up as `todo` in the generated code.
* Differences from Native Spark: Some expressions in Pipeline Builder have been optimized and implemented differently from native Spark for greater reliability and better error handling. We cannot export these custom optimizations and must revert to native Spark expressions, which may behave differently in these edge cases.

All other supported expressions in code generation are validated against Spark test cases. Exporting to Java transforms should be treated as a starting point that users can manually validate against to ensure complete accuracy.
