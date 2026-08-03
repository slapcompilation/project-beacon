<!-- source: https://palantir.com/docs/foundry/workshop/widgets-pie-chart/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Pie Chart

The Pie Chart widget is used to visualize objects data in a pie or donut chart via grouping of objects by a specified property type into proportional slices.

The Pie Chart widget supports exporting of the current chart visualization as a PNG by using either the **Download chart as image** option or **Custom chart export** option in View mode. The current chart visualization can also be copied as an image to the clipboard. Export and copy to clipboard options appear on hover of the widget.

<img src="./media/widgets-pie-chart.png" alt="Pie chart example" width=700>

## Configuration Options

* **Input object set**
  * The input variable which determines the object data that will be displayed within the widget.
* **Group by**
  * Select the property type used for grouping the object set where each property type value will be represented by a slice.
  * **Enable ontology colors:** If toggled on, the widget will use the conditional formatting rules set for that property in the Ontology.
* **Aggregation**
  * Select the aggregation method used, options include average, count, min, max, sum, or approximate unique count.
* **Radius**
  * The inner radius of the space within the chart can be adjusted to switch chart’s visualization from a pie to a donut chart.
* **Legend**
  * Show legend: If toggled on, a legend displaying the values of the property type used for grouping will be shown. The legend can be displayed to the left, right, top, or bottom relative to the chart.
* **Segment display**
  * The display for individual segments within the chart can be overridden.
  * **Segment value:** Enter the label key for the segment you want to override.
  * **Legend label:** Optionally override the segment’s label text displayed in the legend.
  * **Color:** Select the color used for the segment.
  * **Hide series:** If toggled on, the segment will be hidden from the widget’s default view and must be toggled on in the chart legend by the viewer. If toggled off, the segment will be displayed in the widget’s default view.
* **Selection as filter**
  * Select an object set filter variable to be applied to the widget’s inputted object set.
