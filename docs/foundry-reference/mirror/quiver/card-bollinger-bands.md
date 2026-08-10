<!-- source: https://palantir.com/docs/foundry/quiver/card-bollinger-bands/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Bollinger bands

A Bollinger band plot is a type of technical analysis tool used by traders and investors to analyze and identify potential trends, price volatility, and market sentiment in financial markets. The plot consists of two bands plotted around a simple moving average (SMA) on a configurable rolling time window. These bands are:

1. **Upper Bollinger band:** This band is plotted at a multiple of standard deviations (typically 2) above the moving average.
2. **Lower Bollinger band:** This band is plotted at a multiple of standard deviations (typically 2) below the moving average.

As shown in the example below, these bands are usually plotted together with the moving average itself and they can be added separately using the [rolling aggregate](/docs/foundry/quiver/card-rolling-aggregate/) plot.

![Bollinger bands example](/docs/resources/foundry/quiver/resource-bollinger-bands-example.png)

Bollinger bands are also called Statistical Process Control (SPC) or Statistical Quality Control (SQC) charts.

## Input type

Time series

## Output type

Bounded time series

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |

## See also

[Reference profile bounds](/docs/foundry/quiver/card-reference-profile-bounds/)
