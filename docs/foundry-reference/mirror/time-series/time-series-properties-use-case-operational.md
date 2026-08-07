<!-- source: https://palantir.com/docs/foundry/time-series/time-series-properties-use-case-operational/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Use time series properties on objects in a Workshop module and Quiver analysis

The Workshop module built in this example (**\[Example] Time Series Properties on Objects | Delay TSP**) is built on the aviation ontology in the reference ontology, which may or may not be available on your enrollment. For more information on the relationships between those objects, see [the use case overview](/docs/foundry/time-series/time-series-properties-use-case/). This example module will be a reference for you as you configure your own Workshop module using time series properties.

## Select objects in Workshop

The **Selecting an Object** section of the module contains two standard Workshop widget features. A brief description of the widgets are explained below, and you can learn about general functionality in Workshop in our [documentation](/docs/foundry/workshop/overview/). Follow the steps below to configure these widgets before adding time series properties to the module.

### Part I: Add the Filter List widget

The [Filter widget](/docs/foundry/workshop/widgets-filter-list/) should take the `Flight` object set and apply filters based on the `Airport` properties. The filter widget should output an `Airport` filter that can be used in the Object Table widget.

1. In your Workshop module, choose to **+ Add widget**, then select the Filter List widget.
2. In the right side configuration of the filter list widget, create a new variable for the **Object set Input** and name it "All airports". The **Starting object set** should use the `[Example] Airport` object type.

![The Filter List widget configuration for the input variable](./images/time-series-properties-workshop-filter-input.png)

3. Add the `Airport`, `Complete Flight History`, `Airport State Name`, `Arriving Flight Count`, and `Departing Flight Count` properties by selecting the **+ Add filter** button.

![The Filter List widget column selection configuration](./images/time-series-properties-workshop-filter-column.png)

4. Move down to the **Filter output** field, and you will see that a filter output has already been created for you. Give it a descriptive name like "airport filter"; no other configuration is required.

### Part II: Add the Object Table widget

The [Object Table widget](/docs/foundry/workshop/widgets-object-table/) will enable users to filter down on the object set and select an airport for further investigation.

1. In your Workshop module, choose to **+ Add widget**, then select the Object Table widget.
2. In the **Input data** section, create a new variable and name it "filtered airports". Under **Starting object set**, select the **Existing object set variable** for `all airports`.

![The Object Table widget for selecting a filtered variable as an input](./images/time-series-properties-workshop-object-filtered-airports-select-existing.png)

3. In the **Filter...** section, select **Using a variable** and choose the `airport_filter` variable we created as an output for the Filter List widget.

![The Object Table widget for selecting the filter and creating input](./images/time-series-properties-workshop-filter-input.png)

4. In the **Column Configuration** add the `Title`, `Daily Avg Arr Delay`, `Daily Avg Dep Delay`, and `Daily count of flights` columns by selecting **+ Add column**.

5. Configure **Default Sort(s)** to be a property, and choose **Select a property to sort by**. Then, choose `Arriving Flight Count`.

![The Object Table widget default sort configuration](./images/time-series-properties-workshop-object-view-sort.png)

6. Set up the output for the selected table in the **Selection** section of the Object Table configuration. Configure the output to run analysis on the time series properties of the selected airport.

![The Object Table widget selected object output configuration](./images/time-series-properties-workshop-object-view-selected-object.png)

## TSPs in Workshop

The **TSPs in Workshop** section of the module uses the available [time series transforms in Workshop](/docs/foundry/workshop/time-series-properties/). Follow the instructions below to set up the Chart XY and Metric Card widgets shown in the dashboard.

![The configured Chart XY and Metric Card widgets in Workshop](./images/time-series-properties-workshop-widgets.png)

### Part I: Add a Chart XY widget

1. In your Workshop module, choose to **+ Add widget**, then select the Chart XY widget.
2. In the configuration menu to the right, choose to add a plot layer.

![The Chart XY widget configuration to add a plot layer to the chart](./images/time-series-properties-workshop-chartXY-add-plot-layer.png)

3. Select the layer in the menu to configure the data input as a **Time series set**.
4. Create a new variable that contains the `daily count of flights for selected airport` time series property, where the selected airport is the output variable from the Object Table widget. Be sure to give your new variable an understandable name.

![The Chart XY widget configuration for the first plot layer.](./images/time-series-properties-workshop-chartXY.png)

5. Add another plot layer and variable for the `daily dep delay for selected airport` TSP.
6. Add a third plot layer for the `Weekly Avg Dep delay` property. This time, when setting up the time series set variable, choose to also add a transform. In the transform, select **Rolling** and then **Average** over 1 weeks as the aggregation method. Be sure to give your new variable an understandable name.

![The Chart XY widget configuration for the third plot layer.](./images/time-series-properties-workshop-chartxy-third-layer.png)

7. Ensure the axes are set up so there is an axis for each layer. You can also select where the axis units appear for each plot layer (to the left or right of the chart).

![The Y-axis configuration for the Chart XY widget in Workshop.](./images/time-series-properties-workshop-chart-xy-axes.png)

### Part II. Add a metric card next to the Chart XY widget

1. Add a [Metric Card widget](/docs/foundry/workshop/widgets-metric-card/).
2. In the configuration menu, choose to either **Add Metric** or use the default that is created when you first add the widget. Then, hover over the metric to open further configuration options, and choose **Number** as the value type.

![The Workshop Metric Card widget, where you can select a metric for configuration](./images/time-series-properties-workshop-hover-metric.png)

3. Choose **Select numeric value...**, hover over **New numeric variable**, then choose **Time series**.
4. Select the `Max weekly average departure delay` variable you created when setting up the third plot layer of your Chart XY widget.
5. Select the **Max** aggregation type over the **All time** time range as the single value metric. Be sure to give your new variable an understandable name.
6. Set up numeric formatting as desired.

![The Workshop Metric Card widget configuration](./images/time-series-properties-metric-card.png)

## TSPs in Quiver

The following guidances assumes a basic knowledge of navigating Quiver. To learn more about general Quiver functionality, review [our documentation](/docs/foundry/quiver/getting-started/).

The **TSPs in Quiver** section of the example Workshop module contains an [embedded Quiver dashboard](/docs/foundry/quiver/dashboards-overview/). This Quiver dashboard performs similar calculations to the [Workshop widgets discussed above](#tsps-in-workshop). Follow the instructions below to set up the time series chart and metric card shown in the dashboard.

Once the following steps are complete, the resulting dashboard should look like the example below:

![Quiver dashboard view](./images/time-series-properties-quiver-dashboard.png)

### Part I: Set up a time series comparison in a Quiver analysis

1. Create a [new Quiver analysis](/docs/foundry/quiver/getting-started/) and open the **Time Series** menu from the top bar.

2. In the top left, filter the results to the `Airport` object type and select the **Daily Avg Dep Delay** time series property from one of the objects.

![The Quiver time series menu selection.](./images/time-series-properties-quiver-time-series-menu.png)

3. Configure the x-axis of the resulting plot to **Fit to extent**, this will ensure that the axis is scaled to the data's time range.

![A Quiver time series plot configured to fit to extent.](./images/time-series-properties-quiver-fit-to-extent.png)

4. Select **Graph** in the top right of the viewable content to enter the analysis graph view.

![The graph mode toggle.](./images/time-series-properties-quiver-toggle-graph.png)

Note that by adding the time series property of an object, a time series chart, a numeric axis (unit), and a default shared time axis card were also generated.

![Quiver generated graph mode.](./images/time-series-properties-quiver-generated-graph.png)

5. Hover over the object's time series property card until the menu appears. From the next actions menu, select the time series property from the **Continue analysis from** dropdown.

![The Quiver time series property next actions menu.](./images/time-series-properties-quiver-time-series-property-next-actions.png)

6. Select the **Add plot** button and search for "rolling aggregate" to add a **Rolling aggregate** card to the canvas.

![The Quiver plot next actions rolling aggregation.](./images/time-series-properties-quiver-plot-next-actions-rolling-aggregation.png)

7. From the settings menu on the plot in the upper right of the card, choose **Average** with a **Value** of 1 and a **Unit** of **Week**, indicating every one week.

![The Quiver rolling aggregate card configuration.](./images/time-series-properties-quiver-rolling-aggregate.png)

8. Hover over the plot until the menu appears. From the next actions menu, **Continue analysis from** the newly created rolling aggregate. Select **Search** and search for "numeric aggregation". In the numeric aggregation settings, set the **Aggregate type** to be **Minimum**. Repeat this step to add a maximum numeric aggregation card.

![The Quiver time series numeric aggregation.](./images/time-series-properties-quiver-numeric-aggregation.png)

9. In the **Analysis contents** panel, find the **Default Shared Time Axis**. In the configuration side panel on the right, toggle on the **Controlled** option, select **Use variable input**, and select **New date/time range parameter** in the **Range** dropdown. This will create a new date/time range parameter that will be used to control the time range of the shared time axis.

![The Quiver default shared time axis.](./images/time-series-properties-quiver-default-shared-time-axis.png)

10. In the **Parameters** panel you should see the newly created date/time range parameter. Create two date/time parameters, one representing the start of the time range and one representing the end of the time range.

![Quiver time range parameters.](./images/time-series-properties-quiver-date-time-parameters.png)

11. Select the date/time range parameter created in step 9, and in the right configuration panel toggle on **Select separate start and end date parameters**. Then, select the start and end parameters created in step 10 from the dropdown menus. Now the time axis of the plots can be controlled by the start and end parameters.

![The Quiver time range parameter configuration.](./images/time-series-properties-quiver-date-time-range-parameter-configuration.png)

12. In the parameters panel, create a new **Object** parameter.

![The Quiver add object selector parameter.](./images/time-series-properties-quiver-add-object-selector-parameter.png)

13. In the right side configuration panel, select the `Airport` object type and select any airport from the dropdown.

![The Quiver configure object selector parameter.](./images/time-series-properties-quiver-configure-object-selector-parameter.png)

14. Select the `Daily Avg Dep Delay` card that was created in step 2. In the configuration panel on the right select **Use variable input** next to the **Series Object** configuration and select the newly created object selector parameter. Now, the airport can be controlled, and the `Daily Avg Dep Delay` time series will update along with all of our downstream operations.

![The Quiver update input object.](./images/time-series-properties-quiver-update-input-object.png)

15. Hover over the plot containing the rolling weekly aggregate and select the rolling aggregate from the **Continue analysis from** dropdown in the next actions menu, then search for "shift time series". Add the **Shift time series** card and configure it to shift the input series back one week.

![The Quiver shift time series configuration.](./images/time-series-properties-quiver-shift-time-series-configuration.png)

16. Add another plot by hovering over the existing plot, and use the **Search** action in the next actions menu to search for "time series formula". Add the **Time series formula** card and add the following formula to the card configuration:
    `$L - $AA`; where `$L` is the weekly average departure delay, and `$AA` is the weekly average delay shifted back one week. The result is a week over week variation.

![A Quiver time series formula configuration.](./images/time-series-properties-quiver-time-series-formula.png)

### Part II: Set up Quiver dashboard

1. Select **Add to new dashboard** from the top right corner of the time series chart containing the rolling weekly aggregate and the average departure delays for the airport.

![Add a plot to  a Quiver dashboard.](./images/time-series-properties-add-plot-to-dashboard.png)

2. Open your dashboard using the dashboard icon in the left sidebar. From the dashboard view, drag the numeric aggregations representing the minimum and maximum weekly average delay and the week over week variation from the left panel into the dashboard content.

![The Quiver add "cards to dashboard option."](./images/time-series-properties-add-cards-to-dashboard.png)

3. In the **Inputs** section of the Dashboard settings panel on the right, add three inputs for the `Airport` object selector parameter, the start time parameter, and the end time parameter.

![Quiver dashboard inputs.](./images/time-series-properties-quiver-dashboard-input.png)

4. Publish the dashboard.

### Part IV: Embed your dashboard in Workshop

1. Create a date range widget for controlling the start and end times.

![The date range widget.](./images/time-series-properties-workshop-date-range-widget.png)

2. Add a Quiver Dashboard widget, then select your newly created dashboard. Additionally, wire up the workshop airport `Selected Airport`, `Start date` and `End date` variables to the associated Quiver dashboard inputs.

![The Quiver dashboard widget.](./images/time-series-properties-workshop-quiver-dashboard-widget.png)

Now, the selected `Airport` object and the configured time range in the Workshop module will be reflected in the Quiver dashboard.
