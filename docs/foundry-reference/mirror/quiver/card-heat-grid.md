<!-- source: https://palantir.com/docs/foundry/quiver/card-heat-grid/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Heat grid

Display a chart in three dimensions, showing two categorical dimensions and an aggregate dimension by color.

* Supported aggregation metrics: min, max, sum, average, count, unique count, percentile, standard deviation, and variance
* Percentile, standard deviation, and variance metrics are not supported for object types backed by [Object Storage v1 (Phonograph)](/docs/foundry/object-backend/overview/#object-databases).

## Input type

Object set

## Output type

Object selection

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
