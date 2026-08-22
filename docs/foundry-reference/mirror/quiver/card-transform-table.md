<!-- source: https://palantir.com/docs/foundry/quiver/card-transform-table/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Transform table

A [transform table](/docs/foundry/quiver/cards-transform-table/) is a local table used for flexible, low-scale analysis. It can be used for a number of different workflows in Quiver including:

* Converting between different data types.
* Joining and aggregating objects
* Editing tabular data in-line
* Deriving properties, and then performing operations on those derived properties such as filtering and plotting
* Performing batch time series operations

For a complete list of transforms available in transform tables, consult the [index of transform table transformations](/docs/foundry/quiver/cards-transform-table-index/).

:::callout{theme="neutral"}
Transform tables handle certain computations and visualizations differently than object sets. For details on property type stringification, categorical chart behavior, and pivot table dimension handling, see [transform table computation differences](/docs/foundry/quiver/transform-table-computation-differences/).
:::

## Input type

Object set, transform table, event set, materialization, Materialization SQL, categorical chart, pivot table, time series chart, Ontology SQL, number array, string array, boolean array, time array

## Output type

Transform table

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
