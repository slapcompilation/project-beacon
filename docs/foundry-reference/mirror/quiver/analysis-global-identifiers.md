<!-- source: https://palantir.com/docs/foundry/quiver/analysis-global-identifiers/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Global identifiers (IDs)

Unique Quiver global identifiers (IDs) in the form of `$A` are automatically assigned to all Quiver cards when added to an analysis.

## Identify global IDs

Global ID values can be seen in various places across Quiver:

* Next to each card and plot in the [**Analysis contents**](/docs/foundry/quiver/analysis-toolbars/#analysis-contents-panel) panel.
* Next to each parameter in the [**Parameters**](/docs/foundry/quiver/cards-parameters/#the-parameters-panel) panel.
* For each card in the card's header and the editor panel.
* For each parameterized input value in the editor panel.
* In the legend of a time series chart for each time series plot.
* In the axis of a time series chart for each shared axis.

![Global IDs across various locations in Quiver.](/docs/resources/foundry/quiver/concepts-global-ids.png)

## Use global IDs

Global IDs are used in [formulas](/docs/foundry/quiver/cards-formulas/) and [Vega plot](/docs/foundry/quiver/cards-vega-plot/) configurations to reference data sources, such as time series plots, transform tables, charts, arrays, or scalar values. For example, you can reference a transform table with its global ID (such as `$B`) in the data section of a Vega plot. To reference specific columns in a transform table, use the syntax `$A.column_name`. Similarly, you can reference scalar values using the global ID of a numeric metric card (like `$C`).
