<!-- source: https://palantir.com/docs/foundry/quiver/card-cross-filter/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Cross filter

Creates an object set that can be filtered based on selections in multiple charts. These charts can also filter each other. This offers a more horizontal and interactive selection experience for users, especially consumers of dashboards.

## Input type

Object set, categorical chart

## Output type

Object set

## Example

In the example below, both the pie chart and the bar chart filter the object set below them. Making a selection on the pie chart, for example, selecting `Steeping Vat` nine, seven, and three, not only filters the object set down to the corresponding objects, but also filters the bar chart by reducing it to those 3 categories.

![An example of cross filtering.](/docs/resources/foundry/quiver/howto-chart-selection-cross-filtering.gif)

You can add this card by selecting **Filter > Cross filter** from the next actions menu of an object set.

### Cross filtering configuration

1. Select the input object set that you want the charts to filter.

    <img alt="Select root object set" src="./media/howto-chart-selection-cross-filtering-select-root-object-set.png" width="400px">

2. Then, create categorical charts that take the cross filter card as input. The following charts are supported in the cross filter card:

   * Pie charts
   * Bar charts
   * Line charts
   * Categorical scatter plots

    <img alt="Select root object set" src="./media/howto-chart-selection-cross-filtering-select-cross-filtered-object-set.png" width="400px">

3. Lastly, open the editor panel of the cross filter card and add the charts above to the **Subscribed plots** category. Charts that are subscribed to the cross filter will act as filters on the object set and also filter each other.

    <img alt="Adding charts to cross filter object set card" src="./media/howto-chart-selection-cross-filtering-adding-charts.png" width="400px">

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
