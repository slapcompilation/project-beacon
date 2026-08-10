<!-- source: https://palantir.com/docs/foundry/quiver/card-set-math/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Set math

Takes as input two (or more) object sets *of the same type* and returns a combined object set based on operations defined by the user. Supported operations are the union, intersection, or difference of two object sets.

## Input type

Object set

## Output type

Object set

## Examples

In the example below, we are using set math to find the difference between a set of 48,895 Airbnb objects (`$B`) and a filtered set of 22,326 Airbnb objects (`$D`). The output is the set (`$E`) of 26,569 Airbnb objects in `$B` but not in `$D`.

Airbnb data used in this example is open source.

![Example of set math](/docs/resources/foundry/quiver/resource-set-math.png)

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
