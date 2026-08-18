<!-- source: https://palantir.com/docs/foundry/quiver/card-code-function-timeseries/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Code function time series

The code function time series card creates a plot of time series returned by a [Python function](/docs/foundry/functions/python-getting-started/). To return a time series, you must return a `list[bytes]` formatted as a [time series.](/docs/foundry/time-series/time-series-in-functions/#return-time-series)

* Choose a function from the **Select a Function...** dropdown menu of the card editor to the right of the screen.
* Once you make a selection, the inputs of the function will appear below. Enter the inputs as required.
* Toggle on the **Auto-update** option if you want the analysis to always use the latest version of the function. By default, the function’s version will be set to the latest version available at the time of creation. You can change the version manually using the dropdown menu.

:::callout{theme="warning"}
Categorical time series outputs are currently unsupported.
:::

## Input type

Object set, single object, number, string, time, boolean, number array, string array, time array, boolean array

## Output type

Time series
