<!-- source: https://palantir.com/docs/foundry/quiver/quiver-best-practices/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Quiver best practices

The following sections document best practices and considerations to keep in mind when using Quiver, particularly for improving performance.

## Analysis structure

Quiver uses [canvases](/docs/foundry/quiver/analysis-canvas/) to display and organize the cards in your analysis. Any content in an inactive canvas tab will not be rendered or queried, so consider splitting the analysis into separate canvases if you have a large analysis with many cards. Similarly, any hidden plot will not be queried; you can hide any plots or charts that you might not need to see but are required for the analysis.

To further reduce compute in your analysis, you can update the **Load settings** found in the [**Global settings**](/docs/foundry/quiver/analysis-settings/#global-settings) of the analysis to use **Only visible items** instead of **All items**. This change can improve performance for large canvases, but note that cards will load as they become visible. Every time you scroll to a different section of the canvas, you will need to wait for card computations to finish.

You can easily move cards between canvases through the **Analysis Contents** panel, or you can move a specific card to a different canvas using the **Move to canvas** option in a card's **More actions** menu.

Additionally, you can duplicate cards or entire canvases to a new analysis.

### Graph mode

In [graph mode](/docs/foundry/quiver/analysis-graph/), cards are only computed when their preview is shown. With the compact node design, previews are only displayed when a node is selected or pinned in the [preview panel](/docs/foundry/quiver/analysis-graph/#preview-panel), rather than rendering for all nodes simultaneously. For large analyses, avoid pinning unnecessary previews to reduce compute costs and time.

You can further simplify the graph by using [color groups](/docs/foundry/quiver/analysis-graph-color-groups/) to organize related nodes and collapse or hide groups that you are not actively working with. The [filtering tools](/docs/foundry/quiver/analysis-graph-organization/#filter-nodes) in the **Analysis Contents** panel also allow you to narrow down the visible nodes by type, canvas, dashboard, or function.

## Transform tables

Quiver [transform tables](/docs/foundry/quiver/cards-transform-table/) are a powerful feature that allows you to perform a batch analysis on objects or tabular data derived from objects. However, transform tables can require high compute. For this reason, the maximum number of rows allowed is **50,000**. If your input object set is larger, we recommend using a [filter object set](/docs/foundry/quiver/card-filter-object-set/) to reduce the number of rows before passing it into the transform table.

Because transform table computation is performed in the browser, the performance of certain analyses may vary depending on your hardware (memory size, for example).

Additionally, all transformations in a single transform table are computed sequentially. For example, if you have four numeric formulas, each formula is computed one after the other. This behavior can cause a performance restriction. You can improve performance by parallelizing the computation and dividing the transformations into multiple transform tables.

### Transform table computation

Transform tables are paginated, meaning that only the viewable rows are computed. For example, if you have 50,000 rows in a table but only 100 are in view, the results are only computed over the viewable 100 rows. However, some operations require that the entire table is computed. These operations include any visualizations or charts,  aggregations, and joins.

### Sparklines

When rendered as a sparkline, each time series cell in a table is computed and billed as an independent query. Because of this, applying a time series operation on all rows can lead to high compute costs. For example, if a transform table has a time series aggregation on 100 rows, the required compute would be equivalent to applying an aggregation on 100 quiver plots.

To improve load performance and reduce costs, you can update the [view range setting](/docs/foundry/quiver/cards-transform-table/#view-range-options) of the sparkline to limit the size of the compute. By default, time series sparklines always load the "full extent" of the series, with all data included.

### Materializations

If you are using transform tables without time series or data editing features, consider using [materializations](/docs/foundry/quiver/cards-index-materializations/) instead to improve performance. Materializations offload the computation from your browser and can lead to improved performance on operations such as table joins and aggregations. Materializations also do not have a 50,000-row limit, allowing you to easily work with large-scale datasets. You can switch from a materialization to a transform table at any time without losing the inputs and configurations already added. However, note that transform table operations will likely be slower since they are done in the browser.

You cannot switch from a transform table to a materialization.

:::callout{theme="neutral"}
Materializations do not support time series operations; use a transform table if you need to analyze time series data.
:::

## Object set search around

Quiver allows you to [search around to linked objects](/docs/foundry/quiver/objects-import-linked/) from an object set. If your object set is using Object Storage v1 (Phonograph), your input object set must have fewer than 100,000 objects. If your input object set is using Object Storage v2 (OSv2), the resulting linked object set must have fewer than 10 million objects.

The same restrictions also apply when you're using the [filter object set card](/docs/foundry/quiver/card-filter-object-set/) and trying to filter using linked objects.

## Time series

By default, Quiver renders 1,000 buckets per time series to improve performance. If you require a more granular view of the series, you can adjust your axis by [panning and zooming](/docs/foundry/quiver/timeseries-visualize/#panning-and-zooming) to the desired time range.

Some time series might take longer to load due to index [hydration](/docs/foundry/time-series/faqs/#why-is-my-time-series-taking-a-long-time-to-load). However, once a series is hydrated, any subsequent queries will load much faster.

If you are working with a large time series and want to avoid hydrating the entire series, you should first use the [filter time series](/docs/foundry/quiver/card-filter-time-series/) card with an explicit time range filter to reduce the series. Then, compute any future operations on top of that filtered series. This way, the series will only need to be hydrated for the time range you need and not for the full extent.

Time series card performance depends directly on the number of points in the series; consider using [sample time series](/docs/foundry/quiver/card-sample/) to reduce the number of points. Filtering down to a time range will also speed up compute for any future operations. You can also specify a time range when using the [time series search card](/docs/foundry/quiver/card-time-series-search/) to speed up performance, since the default search range is for the full series.

### Point sets

The following cards are not bucketed. Instead, all points involved in the series are recomputed every time you run a calculation based on the series:

* Categorical time series
* [Tabular time series](/docs/foundry/quiver/card-tabular-time-series/)
* [Event indicator series](/docs/foundry/quiver/card-event-indicator-series/)
* [Code function time series](/docs/foundry/quiver/card-code-function-timeseries/)
* [Forecast time series](/docs/foundry/quiver/card-time-series-forecast/)

With large series, analysis performance can quickly degrade. Quiver has a 25,000-point limit for these time series types, but we recommend limiting the series size to improve performance.

### Streaming

Quiver has two time series streaming modes: analysis-wide streaming and individual axis streaming. By default, [analysis-wide streaming](/docs/foundry/quiver/analysis-settings/#time-series-axes-and-legends) will be activated when pressing the **Stream** button on an axis. This enables metric cards to update along with the new time series data, but degrades performance due to increased cache clearing. To achieve time series streaming while maintaining optimal performance, enable the **Stream individual axis** setting in the [configuration for each of the time axes](/docs/foundry/quiver/timeseries-visualize/#time-axis-x-axis-configuration) in the analysis.

## Dashboards

When embedding Quiver dashboards in other Foundry applications, you should use tabs as much as possible. Just like canvases in a Quiver analysis, content in inactive dashboard tabs will not be rendered or queried. Splitting your dashboard into tabs as much as possible will improve loading time and performance of the dashboard.

### Notepad integration

When embedding multiple charts in a [Notepad document](/docs/foundry/notepad/overview/), use the dashboard widget with the same inputs to reuse the same computation cache and speed up performance.
