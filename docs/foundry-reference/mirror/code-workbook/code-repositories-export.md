<!-- source: https://palantir.com/docs/foundry/code-workbook/code-repositories-export/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Exporting to a Code Repository

Python and SQL code can be exported from a Code Workbook to a Code Repository. Moving code across to a Code Repository can be useful for production pipelines, as it provides full git version control and several advanced pipelining tools. [Learn more about Code Repositories.](/docs/foundry/code-repositories/overview/)

When exporting, a new branch will be created on the repository with Code Workbook code converted to its Code Repository equivalent. Because this is a best-effort conversion, you may need to adjust this code to move files around, change dataset names and paths, adjust imported packages, etc.

:::callout{theme="neutral"}
The export is a one-time, one-way export. Further edits to the Code Workbook are not automatically pushed to the Code Repository, and subsequent exports of the same datasets into the same repository are not supported. Code cannot be exported from a Code Repository to a Code Workbook. Additionally, the user who is performing the export must have at least Editor permissions on the destination Code Repository.
:::

### Supported Types

Currently, only SQL nodes or Python code nodes with Pandas or Spark dataframe inputs and outputs are supported. The set of exported nodes must be connected to each other, with imported datasets at the root.

Nodes with input types of Python transform input or object are not supported.

:::callout{theme="neutral"}
Before exporting your code to a Code Repository, ensure that the needed languages are supported in the Code Repository. For example, if you export both SQL and Python nodes, you may need to add a new subproject to your SQL-only or Python-only repository.
:::

### How to Export

To export, from a Code Workbook, go to the Settings cog > Export to Code Repository Helper:

![repository-export-button](./images/repository-export-button.png)

Click Select Repository and choose a Code Repository:

![repository-selection](./images/repository-selection.png)

Select datasets to export with the checkboxes in the left hand side panel.

The graph shows which datasets are available for export (white), and which are not available (gray). The export must be a connected graph, and so adding nodes to the selection may make more nodes available for export. Hovering over disabled nodes will explain why they cannot be selected.

![repository-select-nodes](./images/repository-select-nodes.png)

When ready to export, click Create pull request

A new branch will be created in the selected Code Repository with code exported from the Code Workbook. Click "View pull request" to open the pull request in the Code Repository.

![repository-view-button](./images/repository-view-button.png)

From here you can inspect the exported code and make any required edits such as dataset paths and names.

![repository-view-export](./images/repository-view-export.png)

Verify the exported datasets in transforms-python/src/codeWorkbookExport have been imported and added to your pipeline in `transforms-python/src/myproject/pipeline.py` as desired.

![repository-view-pipeline](./images/repository-view-pipeline.png)

Any custom package versions in the Code Workbook will be added to `transforms-python/conda_recipe/meta.yml`.

:::callout{theme="neutral"}
Code Workbook and Code Repositories do not support the exact same set of packages. While the majority of packages should work correctly, some may fail to pass repository checks.
:::

![repository-view-packages](./images/repository-view-packages.png)

Once ready, the PR can be created and the usual process followed to merge the exported code into the pipeline.

### Writing to the same datasets

By default, exporting to Code Repository will write to new datasets. If you would prefer to write to the same datasets as the Code Workbook, follow these steps below:

1. Navigate to the branch created in repository by the Export to Code Repository action. Change the output dataset paths to those of the desired dataset.
2. For each of the datasets, navigate to the `Details` tab of the dataset page, and delete the dataset's job spec. This is necessary to allow the repository to take ownership of the dataset.
3. Create the PR and follow the usual process to merge the code into the pipeline. When the CI checks run in the repository, new job specs will be created on the target dataset.

Note that by transferring these datasets to the repository, **you will no longer be able to use the original Code Workbook to write to the datasets.** You may wish to delete the exported nodes to avoid confusion.
