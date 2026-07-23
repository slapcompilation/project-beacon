<!-- source: https://palantir.com/docs/foundry/pipeline-builder/datasets-add/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Add datasets

To begin building a pipeline, add data to your graph using one of the following four methods:

* [Data Connection application](#add-data-to-pipeline-builder-from-data-connection)
* [Select a dataset or media set from Foundry](#add-data-from-foundry-to-pipeline-builder)
* [Manually upload data](#upload-data-from-your-computer-to-pipeline-builder)
* [Manually enter data in your pipeline file](#manually-enter-data-in-pipeline-builder)

## Add data to Pipeline Builder from Data Connection

To access data from a data source, navigate to the **Data Connection** app in the Foundry navigation sidebar. Find the data source you want to integrate, then click **Start Pipelining**. Choose a location for your new pipeline, then click **Save**. This will create a new pipeline, and all syncs connected to your data source will be imported to your Pipeline Builder graph.

:::callout{theme="neutral"}
You cannot save a new pipeline to your personal file folder. Set up the [recommended Project structure](/docs/foundry/building-pipelines/recommended-project-structure/) so that data security and governance are organized from the beginning of your development process.
:::

![The Data Connection application showing a sample data source.](/docs/resources/foundry/pipeline-builder/datasets-data-cnx@2x.png)

## Add data from Foundry to Pipeline Builder

To import datasets or media sets that already exist in your Foundry filesystem, proceed to the Pipeline Builder application and select **Add Foundry data** in the center of your graph space. Search for and select an available dataset, then choose **Add data**.

![The Add Foundry data button in the center of the graph space.](/docs/resources/foundry/pipeline-builder/welcome-to-pipeline-builder-updated.png)

You can add multiple datasets or media sets by adding each of them and choosing **Add to selection**; once all are selected, choose **Add data**.

![The prompt for adding multiple datasets to the selection.](/docs/resources/foundry/pipeline-builder/data-add-datasets-prompt@2x.png)

## Upload data from your computer to Pipeline Builder

You can also upload dataset or media set files from your computer. Select **Upload from your computer** to select the file you want to add, or drag and drop the file onto your graph.

![The section for manually uploading data from your computer.](/docs/resources/foundry/pipeline-builder/data-manually-upload-data@2x.png)

## Manually enter data in Pipeline Builder

Input datasets can also be created by defining a data table and manually populating it with data.

![The icon for entering data manually in Pipeline Builder.](/docs/resources/foundry/pipeline-builder/manually-enter-data@2x.png)

Define the new table's schema by selecting column names and types, then manually add values to the table. Manually entered tables can be modified at any point.

![A manually entered data table with defined columns and values.](/docs/resources/foundry/pipeline-builder/manually-entered-data-table@2x.png)

The following table lists some of the most common column types in a manual entry table:

| Column type |  Format |
|---|---|
| String | All characters |
| Timestamp | `mm/dd/yyy hh:mm:ss`; additional timestamp <br /> formats can be used |
| Date | `mm/dd/yyyy` |
| Boolean | 0 → false, not 0 → true |
| Binary | All characters, will be shown as `base64` |
| Integer, long | Positive and negative numbers, no decimal point |
| Double | Positive and negative numbers, including decimal point |
| Array | A list of values of the same type, entered as `[value1, value2]` |

:::callout{theme="neutral"}
After selecting the **Array** column type, double-click the cell or type `[` to open a pop-up where you can add string values to your array. Array string values must be entered this way and cannot be pasted in.
:::

:::callout{theme="warning"}
You may experience longer loading times when viewing proposed changes to large manually entered tables. As an alternative, you can view the raw tables side by side.
:::

## Next steps

After adding datasets or media sets to Pipeline Builder, you can change their [computation mode](/docs/foundry/pipeline-builder/datasets-computation-modes-for-batch/), choose to [transform the data](/docs/foundry/pipeline-builder/transforms-overview/) or [add outputs](/docs/foundry/pipeline-builder/outputs-add-dataset-output/).

![A Pipeline Builder graph showing imported datasets.](/docs/resources/foundry/pipeline-builder/demo-pipeline@2x.png)
