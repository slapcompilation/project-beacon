<!-- source: https://palantir.com/docs/foundry/questions-answers/quiver/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Quiver

### How can I enable the save and export options in the Free-form Analysis widget?

To enable the save option, you need to configure the ability to save in the [widget's configuration](/docs/foundry/workshop/widget-free-form-analysis/). After configuring, the save option should appear in the upper right corner. For exporting, you can either open the analysis in Quiver or copy it to Notepad.

*Timestamp:* March 1, 2024

### What could cause the `ObjectSet:MaxNumAggregationsExceeded` error when creating plots in Quiver, and how can it be resolved?

The error is caused due to the number of aggregations being performed at once by the Ontology backend. The solution is to aggregate the data before passing it into the charts, or to create several charts and then merge them in an Overlay Chart.

*Timestamp:* March 15, 2024

### Is it expected that a Quiver aggregate function can reference a property in the backing dataset but not in the Ontology?

Yes, it is expected because the function references the backing materialization of the object set, which is tied to its underlying dataset.

*Timestamp:* March 1, 2024

### Does the Free-form Analysis widget support time series plots or line charts?

It does not.

*Timestamp:* March 15, 2024

### Why can't I find my dashboard in the Quiver widget within Workshop?

Make sure you have published the Quiver dashboard from the dashboard view, not the analysis. You can find the dashboards you created for the analysis by looking for a screen icon on the left side panel. If this is done, we recommend searching for different parts of your dashboard name in the Workshop widget.

*Timestamp:* March 1, 2024

### Why is the embedded Quiver analysis in the Workshop module defaulting to an empty page 2 instead of staying on page 1?

Republish the dashboard while tab 1 is active to ensure that the embedded Quiver analysis stays on page 1.

*Timestamp:* March 15, 2024

### How do I get the first and last timestamp of each time series?

The `Time series start date` and `Time series end date` transforms can be used to get the start and end date of the time series.

*Timestamp:* March 1, 2024

### How can I add more information to the tooltip when a user hovers over a chart?

We recommend using a Vega chart for specific plotting requirements that allow for enhanced tooltip information.

*Timestamp:* March 1, 2024

### How can I choose or rename columns in a materialization flow to union two materializations?

The current solution is to first add "no-op" (no operation) columns via expression boards with the same name on both sides, then add "dummy" joins that do not actually join anything but allow specifying the columns, and finally perform a union. This is the recommended workaround until a more streamlined feature is developed.

*Timestamp:* March 15, 2024

### Why doesn't changing the external interpolation from the formula itself work when trying to infer values for a time series, and is there a way to correctly apply interpolation to address overlapping issues in time series data?

Palantir is currently investigating the issues with changing the external interpolation from the formula itself. For now, the correct way to apply interpolation to address overlapping issues in time series data is by changing the external interpolation of the plot itself, which should work as intended.

*Timestamp:* April 3, 2024

### How can I implement Vega charts with more than 50,000 objects in Quiver?

For charts with more than 50,000 objects, we recommend using object and materializations charts, as these charts do not have scale limitations. You cannot exceed the 50,000 object limit in Vega charts within Quiver.

*Timestamp:* April 10, 2024

### How can users select two different time ranges in a grouped time series plot? Is it possible to display the distribution of values in a distribution plot with proportions instead of counts?

Users can select two different time ranges by using a union time series rather than a grouped time series plot. Currently, it is not possible to display the distribution of values as a proportion.

*Timestamp:* March 1, 2024

### How can I resolve an `invalid type error` when using a boolean in a ternary operator in TypeScript?

To resolve the `invalid type error` when using a boolean in a ternary operator in TypeScript, you should convert the boolean into a number. You can do this by comparing the boolean to `true` or `false` and returning `1` or `0` accordingly, then use this numeric representation in your ternary operation. For example, use `(booleanVariable === true ? valueIfTrue : valueIfFalse)` instead of directly using the boolean variable.

*Timestamp:* April 3, 2024

### Is it possible to have one stacked series and one grouped series together in one bar chart?

Combining a stacked series and a grouped series together in the same bar chart is not currently possible, but as an alternative you can use a Vega plot with two layers, with stacked bars in one layer and grouped bars in another.

*Timestamp:* April 9, 2024

### Why can't I perform a pivot on a joined transform table in Quiver, and what are the workarounds?

You can't perform a pivot on a joined transform table in Quiver because the Pivot Table feature only supports an Object Set as input, not a Transform Table.

*Timestamp:* April 3, 2024

### How can I add a rolling average line to a chart created from an object set and plot it along with the original data on the same chart?

To plot a rolling average line along with the original data on the same chart, you need to create a time series chart without any transformations and then drag-and-drop the plots onto the same chart.

*Timestamp:* March 7, 2024

### How do I change units for the Y-axis in a plot when the unit says unknown?

To change the units for the Y-axis in a plot, you can edit the y-axis unit of a plot inside the plot's configuration editor under 'unit override'. For Time Data Points (TDPs), the option to specify default units is located in **Properties > Display > Time series formatting > Units**.

*Timestamp:* April 3, 2024

### How can the loading speed for a workshop displaying eight time-series charts on a single page be improved?

Maintain a single dashboard for all charts if they are derived from the same object type to avoid reloading the same object set, which is expensive. Additionally, consider splitting the dashboard into tabs so that only the visible time series are loaded at any given time. Truncating historical data with a time range can also help if historical data isn't crucial.

*Timestamp:* April 3, 2024

### Why does the tooltip in the graph not match the 'next' interpolation setting, and why does the series search seem to use 'previous' interpolation?

The discrepancy in the tooltip is due to the graph's hovering behavior, which is designed to display the value of the nearest point to where the user is hovered, regardless of the interpolation setting. As for the series search, it is expected behavior to only consider internal interpolation when joining multiple series and not for individual series display; this results in the appearance of the 'previous' interpolation. These behaviors are by design and not indicative of a product bug.

*Timestamp:* March 27, 2024

### How can I make a chart's series title persist when the chart is used as an overlay?

Set the **Value Axis Title** in the line chart to ensure the series title persists when used as an overlay.

*Timestamp:* March 1, 2024

### How do I change the filter type from `AND` to `OR` on a filter card?

To change the filter type from `AND` to `OR`, you have to create a new nested filter, which will then give you the option to choose between `AND` or `OR`.

*Timestamp:* April 18, 2024

### How can I invert the Y-Axis in a Heat Grid in Quiver?

You cannot directly invert the Y-Axis in a Heat Grid in Quiver. However, you can use Vega plot by performing your aggregations at the objects layer before converting to a transform table / Vega plot. This method gets around any scale limitations.

*Timestamp:* April 17, 2024

### Is a colon (`:`) treated as a special character in a Quiver search query?

Colons are treated as special characters in Quiver search. As a workaround, you can add a type class to your property in the Ontology Manager application, specifically `analyzer.not_analyzed`, to prevent Elasticsearch from tokenizing the property.

*Timestamp:* April 17, 2024

### Where can I find the shared time axis button in Quiver?

The shared time axis button only appears if the current axis is not shared. By default, all time series charts use the default shared time axis. To create and use a new shared axis, select **Create new axis** from the **Select axis** menu, then use the **Shared Axis** button to share the newly created axis. This new axis can then be selected for use in other charts.

*Timestamp:* April 18, 2024

### How can a variable be captured from a user's selection within a Quiver chart embedded in Workshop application, and what are the limitations and solutions when the chart is an output of a transform table?

To capture a variable from a user's selection within a Quiver chart, the suggested method is using the path: **ObjectSet -> Selected ObjectSet -> Unique values of the variable -> Value at index 0**, which returns a string to be used as an output. However, for charts that are outputs of transform tables, there is a limitation as they lack drill down capabilities. A potential workaround is converting the transform table workflow into an object set or materialization format.

*Timestamp:* August 6, 2024

### How can I create a Vega plot for a time series plot?

From the time series plot, select **Convert -> Transform table from time series**. This will give you the backing time series data in tabular format in a transform table, which can be used to build a Vega plot.

*Timestamp:* April 17, 2024

### Why could cause Vega plots to come up blank?

The blank plot is probably caused by an error in the Vega spec, not in the data. To debug, copy the resolved Vega spec into the Vega editor and troubleshoot there to find and fix the error.

*Timestamp:* April 24, 2024

### How can I conditionally select the older of two date cards to filter an object set without using a code function value card?

You can use a numeric formula with a ternary operator, like `$A > $B ? $A : $B`.

*Timestamp:* August 6, 2024

### Is it possible to obtain the base64 string of a Vega plot chart via an API?

No, it is not currently possible to download Vega plot charts via an API.

*Timestamp:* September 25, 2024

### In Quiver, how can I enforce a string output for a function-backed derived property?

The function should output a `FunctionsMap`, and it should pick up the correct type for the column.

*Timestamp:* September 12, 2024

### How can I filter time series data dynamically per row in a transform table?

To filter time series data dynamically per row in a transform table, you can choose the "Manually input start and end date/time" option and use separate start and end date columns for the filter.

*Timestamp:* September 30, 2024

### How can I overlay two time series charts in Quiver?

You can overlay two time series charts by dragging the time series from the legend of one chart to the other chart.

*Timestamp:* September 10, 2024

### In Quiver, how are null Boolean values handled in object set charts?

Null Boolean property values are ignored in object set charts, and by default boolean values are treated as 0 and 1. You can override the labels in the **Display** tab.

*Timestamp:* September 25, 2024

### In Quiver, how do I add a new column with the average of an existing numeric column to a transform table?

To add a new column with the average of an existing numeric column to a transform table, use a **Create Values** transform with the default value set to the aggregation output. Note that the **Create Values** transform should be used in a separate transforms table.

*Timestamp:* September 25, 2024

### How can I hide an extra x-axis on a time series chart when plotting horizontal annotations?

Re-add the plots as time series formulas instead of numeric series, allowing the annotations to share the existing time axis and eliminating the need for the extra x-axis.

*Timestamp:* December 5, 2024

### What are the requirements to use the "Derived property from function on objects" transform?

The "Derived property from function on objects" transform can only be used with a function that has an output in the format of `Map<Object, value>`.

*Timestamp:* November 13, 2024
