<!-- source: https://palantir.com/docs/foundry/contour/boards-overview/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Boards

Boards are the key element of Contour's functionality, allowing the user to perform analysis and filters on the input dataset or perform joins with another dataset. The fundamental analytical action in Contour is the application of one or more boards to your data. Each board provides a different possible visualization and/or data manipulation action. Data flows down through the applied boards from the top of a Contour path to the bottom.

Common operations that can be performed on small datasets with spreadsheets can be accomplished at scale in Contour using boards, including but not limited to filtering data, creating pivot tables, creating charts, performing lookups, and creating custom formulas.

Capabilities of Contour boards include:

* **Visualize:** Display your data in different forms (a histogram, a heatmap with geographic data).
* **Filter rows:** Filter your dataset using regular expressions or with built-in date, number, and null comparisons.
* **Aggregate:** Calculate aggregate metrics about your data (for example, calculate the mean value of data in a particular column).
* **Manipulate columns:** Add columns from other datasets, derive new columns or remove unneeded columns.
* **Remove duplicates:** Remove duplicate rows from your dataset. Duplicate rows may exist in the source dataset or result from operations like removing columns or joining to another set.
* **Combine with other datasets:** Join to or perform set math operations with other datasets.
* **Transform data:** Obfuscate sensitive values or find and replace text.

![boards-toolbar-overview](./images/boards-toolbar-overview.png)

Next steps:

* For a guided tutorial to several boards, see [Getting started](/docs/foundry/contour/getting-started/).
* [Learn more about how to add boards from the toolbar.](/docs/foundry/contour/boards-add/)
* See the [board descriptions](/docs/foundry/contour/boards-descriptions/) for details on all Contour boards.
