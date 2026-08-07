<!-- source: https://palantir.com/docs/foundry/quiver/card-tabular-time-series/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Tabular time series

Select a timestamp and a value column from an input transform table and return a time series.

## Input type

Object set, transform table

## Output type

Time series

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Supported\* |

\* In the transform table, this transform is called "group to time series", and must be performed on a date group and numeric group column (result of a group by transform).
