<!-- source: https://palantir.com/docs/foundry/quiver/card-group-by/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Group by

Group transform table rows on zero or more columns. Other columns will be converted into arrays by group.

Array columns in the transform table can then be further operated on by transforms in the [array operations](/docs/foundry/quiver/cards-transform-table-index-array-operations/) category. For example, to create a sum of a numeric column, use a [number array aggregation](/docs/foundry/quiver/card-number-array-aggregation/) on the number array column created by the group by transform.

## Input type

Transform table

## Output type

Transform table

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Unsupported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Supported |
