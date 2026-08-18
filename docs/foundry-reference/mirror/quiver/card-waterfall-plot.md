<!-- source: https://palantir.com/docs/foundry/quiver/card-waterfall-plot/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Waterfall plot

Create a waterfall plot by defining series on an object set, or by specifying numeric values.  When constructed from an object set, its possible to group by a property and calculate a metric (average, count, min, max, sum, unique count) to calculate the buckets.  Its also possible to "compute total" which will add an additional bucket which computes the total of all buckets in the series.

## Input type

Object set, number

## Output type

Flow end

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
