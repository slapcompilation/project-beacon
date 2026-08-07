<!-- source: https://palantir.com/docs/foundry/quiver/card-string-to-date/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# String to date

Convert a string into a date; for example, `18/07/2023` or `July 18, 2023` into a time type. Set the timezone to be used to a custom timezone, local time, or UTC. Optionally, also provide the date format for parsing in [Day.js ↗](https://day.js.org/docs/en/display/format) format. American date format is used by default (`mm/dd/yyyy`). Will return `Invalid timezone or date` for invalid values.

## Input type

String

## Output type

Time

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Supported |
