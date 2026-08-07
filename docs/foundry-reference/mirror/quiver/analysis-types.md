<!-- source: https://palantir.com/docs/foundry/quiver/analysis-types/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Analysis types

When creating a new analysis, you can choose between three analysis types, each designed for different use cases and levels of complexity. All three types support saving and sharing analyses as resources.

## Comparison

|                          | Quiver analysis | Time series analysis | Object set path analysis |
|---                       |---              |---                   |---                       |
| Analytical flexibility   | High            | Low                  | Low                      |
| Available data           | All             | Time series          | Objects                  |
| Complexity           | Medium          | Low             | Low                 |
| Dashboard building       | Yes             | No                   | No                       |
| Convert to Quiver        | —               | Yes                  | Yes                      |

:::callout{theme="neutral"}
Time series analysis and object set path analysis resources can be converted to a Quiver analysis using the **Open in Quiver** option. This creates a new Quiver analysis with the same data and configuration. Note that Quiver analyses cannot be converted to the simplified analysis types, and changes made to the new Quiver analysis will not be reflected in the original object set path or time series analysis.
:::

## Quiver analysis

[Quiver analyses](/docs/foundry/quiver/overview/) provide a robust suite of analytical capabilities, including support for both object and time series data, a comprehensive library of [cards](/docs/foundry/quiver/cards-index/) for data transformation and visualization, and the ability to create interactive [dashboards](/docs/foundry/quiver/dashboards-overview/).

Key features include:

* Visualizing, filtering, and transforming object and time series data without code
* Parameterizing analyses to easily switch between different views of the data and results
* Creating interactive dashboards that you can embed in operational applications such as [Workshop](/docs/foundry/workshop/overview/)
* Embedding charts in reporting applications such as [Notepad](/docs/foundry/notepad/overview/)
* Using [transform tables](/docs/foundry/quiver/cards-transform-table/) and [materializations](/docs/foundry/quiver/cards-index-materializations/) for more advanced transformations and aggregations

We recommend a quiver analysis when:

* You need more advanced analytical operations such as Ontology SQL, transform tables, or materializations.
* You want to build interactive dashboards to share with others.
* You are working with both object and time series data in a single analysis.
* You need to parameterize your analysis for different views of the data.

[Learn how to get started with a new Quiver analysis.](/docs/foundry/quiver/getting-started/)

## Time series analysis

A time series analysis provides a streamlined interface focused on ad-hoc time series analysis. It is designed for users who want to quickly visualize and compare time series data without the full complexity of a Quiver analysis.

Key features include:

* Adding time series data from the Ontology
* Performing time series operations such as union, formula, filter, and more
* Visualizing event sets from linked objects or conditions
* Quickly switching underlying data to compare values starting from different root objects

We recommend a time series analysis when:

* You are working exclusively with time series data.
* You want to quickly visualize and compare multiple time series.
* You do not need to build a dashboard from your analysis.
* You want to build an on-rails environment for operational users to perform time series analysis in a [Workshop](/docs/foundry/workshop/overview/) application.

[Learn more about time series analyses.](/docs/foundry/workshop/widget-time-series-analysis/)

## Object set path analysis

An object set path analysis provides a streamlined interface for investigating object data through a sequence of cards that filter, transform, and visualize an input object set. It is designed for users who want to perform simple, ad-hoc analysis on object data without the full complexity of a Quiver analysis.

Key features include:

* Filtering object sets based on object properties and linked objects
* Visualizing data with bar charts, line charts, pie charts, heat grids, and waterfall plots
* Displaying object data in tables and singular property value cards
* Exploring linked object relationships

We recommend an object set path analysis when:

* You are working exclusively with object data.
* You want to quickly filter, aggregate, and visualize an object set.
* You do not need to build a dashboard from your analysis.
* You want to build an on-rails environment for operational users to perform object set analysis in a [Workshop](/docs/foundry/workshop/overview/) application.

[Learn more about object set path analyses.](/docs/foundry/workshop/widget-free-form-analysis/)
