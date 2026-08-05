<!-- source: https://palantir.com/docs/foundry/quiver/card-coalesce/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Coalesce

Returns the first input value that is not null, or null if all inputs are null. Can be useful to cast potential null values to a defined value. To do this, select **Manually input (string/number/date/boolean)** as the input array configuration. As the first array value, use a variable input to select a card or column value that is potentially null.  As the second array value, use a static input to manually define a non-null "fallback" value for cases when the first value is null.

## Input type

Number, string, time, boolean, number array, string array, time array,

## Output type

Number, string, time, boolean

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Supported |
