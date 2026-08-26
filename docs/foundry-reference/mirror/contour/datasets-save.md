<!-- source: https://palantir.com/docs/foundry/contour/datasets-save/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# Save as dataset

You can save the results of your analysis as a dataset in Foundry by clicking `Save as Dataset` at the bottom of your Contour path.

If the path already has an associated dataset, the dataset will appear at the bottom of your Contour path. Click `Update` to update that dataset with new logic or data. Note that if you change the logic in a Contour analysis, building a resulting dataset using Dataset Preview or the Data Lineage tool will not update the logic used to build the dataset. You must use the `Update` button to pick up logic changes. If you build through Dataset-app or Data Lineage, data updates will be picked up.

:::callout{theme="neutral"}
All datasets built in Contour will always use the latest versions of the input datasets. This means that even if the analysis is using an older version of the data (for example, from using the Version Selector), the dataset built from the analysis will always use the latest versions.
:::

:::callout{theme="neutral" title="Restricted Views"}
You will not be able to save a path with a Restricted View as an input as a dataset.
:::

In a project scoped analysis, all inputs and outputs must be in scope to save the results of a path as a dataset. [Learn more about project references.](/docs/foundry/contour/project-references/)
