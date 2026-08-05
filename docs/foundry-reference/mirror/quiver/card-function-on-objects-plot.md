<!-- source: https://palantir.com/docs/foundry/quiver/card-function-on-objects-plot/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Code function categorical plot

Use a [Function](/docs/foundry/functions/overview/) to create a categorical chart (bar, line, scatter) in Quiver.

Configuring a code function categorical plot requires writing a function that returns either a `TwoDimensionalAggregation` or `ThreeDimensionalAggregation`.

The function should be the same as the one used for a [function-backed workshop chart layer](/docs/foundry/workshop/widgets-chart/#function-aggregations-function-backed-layers).

## Input type

Object set, single object

## Output type

Categorical chart

## See also

[Categorical formula plot](/docs/foundry/quiver/card-categorical-formula-plot/)

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
