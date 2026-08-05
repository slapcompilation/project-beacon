<!-- source: https://palantir.com/docs/foundry/quiver/card-line-chart/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Line chart

Create a line plot with categories determined by your object properties. Set values to count objects or an aggregation of a property value or values.

* Supported aggregation metrics: min, max, sum, average, count, unique count, percentile, standard deviation, and variance
* Percentile, standard deviation, and variance metrics are not supported for object types backed by [Object Storage v1 (Phonograph)](/docs/foundry/object-backend/overview/#object-databases).

## Input type

Object set

## Output type

Categorical chart, object selection

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |

## See also

[Bar chart](/docs/foundry/quiver/card-bar-chart/)
[Pie chart](/docs/foundry/quiver/card-pie-chart/)
[Categorical scatter plot](/docs/foundry/quiver/card-categorical-scatter-plot/)
