<!-- source: https://palantir.com/docs/foundry/questions-answers/quiver-community/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Quiver (Community)

### In Quiver, is it possible to filter an object set using a number range that is derived from a selection in a Vega plot?

Quiver includes a “Within Range” filter type that can be used for this purpose. The steps are as follows:

1. Hover over the transform table cell that contains the output from the Vega plot selection. Pop out the numeric range value
2. In an “Object Set Filter” card, use a “Within Range” filter option to input the range from Step 1 as the parameter

*Topic Link:* [https://community.palantir.com/t/quiver-how-can-i-filter-an-object-set-with-a-range/186 ↗](https://community.palantir.com/t/quiver-how-can-i-filter-an-object-set-with-a-range/186)

*Timestamp:* October 10, 2024

### What are the necessary steps to pass an object set defined in Workshop to a Quiver dashboard?

The steps to pass an object set from Workshop to Quiver are as follows:

* When you start your Quiver analysis, import object sets using the objects option in “Add Data” header and start your analysis from there.
* From your Quiver analysis, create a Quiver dashboard and add the required Quiver cards.
* Choose the input to the Quiver dashboard. Use the object-set as the input. Refer the [Quiver dashboard documentation](/docs/foundry/quiver/dashboards-create/).
* Publish the dashboard.
* From the workshop add the Quiver Dashboard widget. In the widget configuration, select the Quiver dashboard you just published.
* The configuration will automatically show the inputs the dashboard needs.
* Pass the filtered object set variable (assuming you have created an object-set variable in the workshop) from your workshop as an input to the Quiver dashboard.

*Topic Link:* [https://community.palantir.com/t/how-do-i-inject-a-object-set-into-a-embedded-quiver-dashboard-in-workshop/40 ↗](https://community.palantir.com/t/how-do-i-inject-a-object-set-into-a-embedded-quiver-dashboard-in-workshop/40)

*Timestamp:* December 6, 2024
