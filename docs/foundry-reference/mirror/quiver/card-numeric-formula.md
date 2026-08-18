<!-- source: https://palantir.com/docs/foundry/quiver/card-numeric-formula/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Numeric formula

Takes in numeric inputs and returns the result of a [simple or complex math expression](/docs/foundry/quiver/cards-formula-syntax/). These inputs can be any card of numeric type, such as [object set aggregations](/docs/foundry/quiver/card-numeric-aggregation/), [object property values](/docs/foundry/quiver/card-object-property/), [transform table aggregations](/docs/foundry/quiver/card-transform-table-aggregation/), numeric outputs of [code Functions](/docs/foundry/quiver/card-code-function-value/), [numeric parameters](/docs/foundry/quiver/card-numeric-parameter/), or other numeric formula cards. You can reference other cards in the formula box by typing their global IDs (`$A` or `$B`, for example).

If used as a transform inside of a transform table, columns can be referenced using `@column` notation.

## Input type

Number

## Output type

Number

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Supported |
