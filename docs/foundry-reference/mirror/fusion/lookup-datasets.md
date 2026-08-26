<!-- source: https://palantir.com/docs/foundry/fusion/lookup-datasets/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Lookup datasets

Foundry datasets are imported into Fusion via `lookup` formulas. These formulas are similar to Microsoft's VLOOKUP function, but are used to bring in live data from a Foundry dataset, as opposed to a spreadsheet.

You can search for data and generate these formulas with the **Find and use data** panel - see [Find and use data](/docs/foundry/fusion/find-and-use-data/) for more details. You can also write these formulas yourself and use them nested in other formulas.

The following `lookup` formulas exist:

* `lookup`: Returns a set of values from a dataset column with optional filters. A single result is returned as a value, while multiple results are returned in an array. For example, `=lookup(dataset_name, column_name, filter_column_1, filter_value_1, filter_column_2, filter_value_2)`.
* `lookup_array`: Same as `lookup` except single results are returned in an array (of length 1).
* `lookup_distinct`: Returns the distinct set of values from a dataset column, with optional filters.
* `lookup_dropdown`: Returns a dropdown where the selectable values are the results of the lookup.
* `lookup_sorted`: Returns a set of values sorted ascending or descending by a column of the dataset.
* `lookup_schema`: Returns an array with the schema of a dataset.

You can find more details on these specific formulas in the [function library](/docs/foundry/fusion/function-library/).

Lookups (e.g. `sum(lookup(...))`) are limited to 2,000 results. If your workflow requires a larger number of elements, you should first perform the aggregations or pivots in Contour, then save the resulting table as a dataset that you can index in Fusion.

Any of the arguments in a `lookup` can be a cell reference from your spreadsheet. This allows you to create dynamic lookups which depend on user input, derived cells, or other lookups.

:::callout{theme="success" title="Tip"}
To expand an array of results from a `lookup`, you can **Shift+drag** that cell down into individual cells.
:::

:::callout{theme="success" title="Tip"}
`lookup` calls with cell references can be dragged or copy/pasted to other parts of the spreadsheet for context specific results.
:::
