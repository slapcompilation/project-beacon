<!-- source: https://palantir.com/docs/foundry/quiver/card-transform-table-plot/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Categorical plot from transform table

Create a categorical chart (bar, line, or scatter) using data from a transform table. In the editor, use the **Data** tab to select the input transform table, and define the groups as well as segments (optional). Use the **Display** tab to change the visualization type and other display options.

* Supported aggregation metrics: min, max, sum, average, count, unique count, percentile, standard deviation, and variance

:::callout{theme="warning"}
The categorical plot from transform table does not currently support selection filtering. If your workflow requires selection on a chart created from a transform table, consider using [Vega plots](/docs/foundry/quiver/cards-vega-plot/) instead.
:::

## Input type

Transform table

## Output type

Categorical chart

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
