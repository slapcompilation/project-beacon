<!-- source: https://palantir.com/docs/foundry/data-lineage/faq/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Data Lineage questions

The following are some frequently asked questions about Data Lineage.

For general information, view our [Data Lineage documentation](/docs/foundry/data-lineage/overview/).

* [How can I see the backing and writeback datasets for my object type in Data Lineage?](#how-can-i-see-the-backing-and-writeback-datasets-for-my-object-type-in-data-lineage)
* [What datasets in my pipeline also have a specific column?](#what-datasets-in-my-pipeline-also-have-a-specific-column)
* [Who was the last person to modify a resource on this pipeline?](#who-was-the-last-person-to-modify-a-resource-on-this-pipeline)
* [How can I find which of my datasets have open transactions?](#how-can-i-find-which-of-my-datasets-have-open-transactions)
* [Where are most of the datasets used in the pipeline stored?](#where-are-most-of-the-datasets-used-in-the-pipeline-stored)
* [How can I share my unsaved Data Lineage graph?](#how-can-i-share-my-unsaved-data-lineage-graph)
* [Why is my dataset not up-to-date?](#why-is-my-dataset-not-up-to-date)

***

## How can I see the backing and writeback datasets for my object type in Data Lineage?

* First, add your object to the Data Lineage graph by searching for it in the right panel (the tab with a magnifying glass icon). Select **Object types** to filter your search, then enter the name of the object for which you want to view the backing and writeback datasets.

* Next, select the arrow on the left side of your Object type to show its ancestors. This should produce one ancestor node if your object type is read-only and two ancestor nodes if your object type has writeback enabled. Make sure **Resource overview** is selected in the **Node color options** dropdown to see your Writeback Dataset colored as per the legend in the top right. Backing schema dataset colors depend on the transform type used.

* Your writeback and backing datasets for an object type will also have a small globe icon in the top right.

[Return to top](#data-lineage-questions)

***

## What datasets in my pipeline also have a specific column?

1. First, ensure all desired datasets in your pipeline have been added to the Data Lineage graph.
2. Next, select desired datasets by using the **Select** mode in the **Tools** toggle in the upper left corner of the canvas.
3. Then open the **Histogram of selection properties** from the right side panel. Under the section titled **Frequent columns**, you will see the most frequent columns by column name in your selection.

Selecting one of these columns will highlight the datasets in your selection that contain this column.

[Return to top](#data-lineage-questions)

***

## Who was the last person to modify a resource on this pipeline?

* First, ensure that all datasets of interest in your pipeline have been added to the Data Lineage graph.
* Next, select datasets by using Select mode from the **Tools** toggle in the upper left corner of your screen. Then, open the **Histogram of selection properties** from the right side panel.
* Under the **Last Modified** section, you will see the last user(s) to modify datasets in your selection. Selecting a username will highlight the datasets that user last modified within the graph.

[Return to top](#data-lineage-questions)

***

## How can I find which of my datasets have open transactions?

In the dropdown menu in the top right side, choose **Build Status**. Now, you should be able to see if any dataset is currently running. Any such dataset has an open transaction.

[Return to top](#data-lineage-questions)

***

## Where are most of the datasets used in the pipeline stored?

* First, ensure that all datasets of interest in your pipeline have been added to the Data Lineage graph
* Next, select all datasets of interest with the **Select** mode from the **Tools** toggle in the upper left corner of your screen. Then, open the **Histogram of selection properties** from the right side panel.
* Under the section titled **Frequent folder paths**, you will see the most common folder paths for resources in your selection.

Selecting a golden path will highlight the resources in this path on the graph. Hovering over a folder path will show you the full path.

You can select multiple properties in the **Histogram of selection properties** panel such that the graph highlights all resources that satisfy your selection.

[Return to top](#data-lineage-questions)

***

## How can I share my unsaved Data Lineage graph?

To share your unsaved Data Lineage, select the arrow in the top right corner near Save. Once there, you can see a quick share link.

[Return to top](#data-lineage-questions)

***

## Why is my dataset not up-to-date?

There are a few reasons why your dataset may not be up-to-date.

Consider the following reasons why your dataset may not be up-to-date:

* Is your dataset build failing?
* Is there an upstream dataset that has not built and is not up-to-date?
* Have you received up-to-date data from the source?

You can easily answer these questions in Data Lineage:

1. First, verify the status of each of the resources in your pipeline by opening up the dataset of interest in Data Lineage and then right-clicking on the node.

2. Then, select **Expand node...**. You can view all ancestor nodes for that dataset by selecting the double left arrow above **Expand parents...**.

3. Next, select the **Build status** option in the **Node color options** dropdown menu in the top right to view the build status of every resource in your pipeline. This view of your pipeline will make it easier to diagnose stale datasets.

[Return to top](#data-lineage-questions)
