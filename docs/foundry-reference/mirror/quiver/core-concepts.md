<!-- source: https://palantir.com/docs/foundry/quiver/core-concepts/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Core concepts

This page discusses several core concepts that are fundamental to understanding the Quiver application:

* [Cards](#cards)
* [Canvas and graph](#canvas-and-graph)
* [Objects](#objects)
* [Time series](#time-series)
* [Dashboards](#dashboards)
* [Parameters](#parameters)
* [Saving and versioning](#saving-and-versioning)

## Cards

Exploration and analysis in Quiver are performed through the use of cards, which can be chained together to perform complex operations. Some cards create charts or perform calculations, while others are used to manipulate your data by filtering, joining, deriving new columns, and so on.

Every card in Quiver takes zero or more inputs, and produces an output of a specific type, for example `object set`, `time series`, `categorical chart`, `number`, etc. Together, these types form Quiver’s [data model](/docs/foundry/quiver/analysis-data-model/), and define how cards can be chained together.

Cards can be configured in the editor panel by selecting the <img alt="Settings icon" src="./media/howto-gear.png" width="30px"> icon in the top-right corner of the card.

## Canvas and graph

Quiver provides two view modes for building your analysis: [canvas](/docs/foundry/quiver/analysis-canvas/) mode and [graph](/docs/foundry/quiver/analysis-graph/) mode.

A **canvas** is a page where you can display, rearrange, and resize the cards in your analysis. An analysis can contain multiple canvases.

:::callout{theme="neutral"}
Unlike a [Contour path](/docs/foundry/contour/core-concepts/#paths), a Quiver canvas is used for display and organization only. Rearranging cards on your canvas will not affect the underlying sequence of data transformation.
:::

In [graph mode](/docs/foundry/quiver/analysis-graph/), cards are represented as nodes and their connections as links, using a left-to-right layout that makes it easy to follow data flow. You can organize the graph using [color groups](/docs/foundry/quiver/analysis-graph-color-groups/), and [hide or filter nodes](/docs/foundry/quiver/analysis-graph-organization/) to focus on a specific area of your analysis.

Cards added in graph mode are not automatically placed on a canvas. You can add or remove cards from a canvas at any time.

:::callout{theme="neutral"}
Graph mode is best for tabular analysis, while canvas mode is best for time series analysis. Regardless of data type, canvas mode is better for presenting final outputs such as charts and tables, and graph mode is better for inspecting card dependencies.
:::

[Learn more about canvas mode](/docs/foundry/quiver/analysis-canvas/) and [graph mode](/docs/foundry/quiver/analysis-graph/).

## Objects

In Quiver, objects from the [Ontology](/docs/foundry/ontology/overview/) are used as the primary data input for tabular analysis. Quiver natively supports many different cards for filtering, transforming, and visualizing objects data.

For advanced transformations on objects data, such as deriving properties and joining between linked objects, users can also leverage Quiver’s suite of [transform table](/docs/foundry/quiver/cards-transform-table/), [materialization](/docs/foundry/quiver/cards-index-materializations/), and [function](/docs/foundry/functions/overview/) cards.

[Learn more about object analysis.](/docs/foundry/quiver/objects-overview/)

## Time series

Quiver has first-class support for [time series](/docs/foundry/time-series/time-series-overview/) analysis. Time series are primarily added to Quiver through [time series properties](/docs/foundry/time-series/time-series-properties/), however [time series syncs](/docs/foundry/time-series/time-series-syncs/) can also be viewed directly.

Quiver provides an extensive library of [transformations](/docs/foundry/quiver/timeseries-transform/) and [visualizations](/docs/foundry/quiver/timeseries-visualize/) for time series data. Quiver also supports advanced time series workflows such as [anomaly detection](/docs/foundry/quiver/timeseries-search-anomalies/) and [event analysis](/docs/foundry/quiver/timeseries-analyze-events-data/).

Additionally, time series transformations can be saved as [derived series](/docs/foundry/time-series/derived-series-overview/), or used to create alerts with [time series automations](/docs/foundry/time-series/alerting-overview/).

[Learn more about time series analysis.](/docs/foundry/quiver/timeseries-overview/)

## Dashboards

With Quiver, you can build interactive dashboards that display the results and findings of your analyses. These dashboards can be used as standalone views, or embedded in other Foundry applications such as [Workshop](/docs/foundry/quiver/dashboards-workshop/).

[Learn more about dashboards.](/docs/foundry/quiver/dashboards-overview/)

## Parameters

Quiver parameters allow you to easily switch between different views of the data and results. After creating parameters, you can use them in your cards and expose them in your dashboard. This allows end users of a dashboard to interact live with the data and results presented.

[Learn more about parameters.](/docs/foundry/quiver/cards-parameters/)

## Saving and versioning

Quiver analyses are saved manually by clicking the Save button in the top right of the application. A version history is also provided, allowing you to view or revert your analysis to previous saved versions. Additionally, in between each Save action, Quiver auto-saves your "working" state (storing it in the `state` URL variable, for example `state=j05na7mun3`). This allows you to refresh your page and get back your exact analysis state even if you have not saved. Note that if you are sharing a URL link with the `state` variable set, this will open that working state rather than the latest analysis version.

If multiple users are working on the same analysis at the same time, they are able to work independently without interference, however saving changes will overwrite each others saved changes.

[Learn more about saving and versioning.](/docs/foundry/quiver/analysis-save-share/)
