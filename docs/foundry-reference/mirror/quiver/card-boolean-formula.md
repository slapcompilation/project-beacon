<!-- source: https://palantir.com/docs/foundry/quiver/card-boolean-formula/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Boolean formula

Create a new column in a transform table using a [formula](/docs/foundry/quiver/cards-formula-syntax/). Write a mathematical expression returning a boolean value which can reference table columns using `@` (for example, `@column > 0`). You can also use data in your analysis by referencing global identifiers using `$`. (for example, `@column > $A`, where $A is a numeric parameter in your analysis).

## Input type

Number, boolean

## Output type

Boolean

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Unsupported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Supported |
