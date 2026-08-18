<!-- source: https://palantir.com/docs/foundry/quiver/card-datetime-range-parameter/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Date/time range parameter

Create a date/time range input field which can be used as a variable in other cards (for example, filters or formulas). There are several input options available in the editor:

* **Fixed range:** Manually select a static start and end date/time for the range.
* **Relative range:** Define the range using durations relative to the current time (for example, from 2 weeks ago to now). The range will update each time the page is loaded.
* **Use variables:** Set the start and end date/times to be defined by distinct date/time variables. For example, if you would like a filter to be based on the start and end time of an event object, you can define separate date/time parameters for each start and end date/times of the event object, then use these date/time parameters to define a time range parameter.

[Learn more about time ranges.](/docs/foundry/quiver/timeseries-ranges/)

## Input type

Flow start

## Output type

Time range

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
