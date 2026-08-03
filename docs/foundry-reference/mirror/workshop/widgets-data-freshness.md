<!-- source: https://palantir.com/docs/foundry/workshop/widgets-data-freshness/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Data Freshness

The **Data Freshness** widget enables users to track data freshness directly within their application by displaying the **Last Updated** timestamp corresponding to the most recent [index](/docs/foundry/object-indexing/overview/) time for configured object types and datasources. The widget helps provide users with more visibility into the state of their data and helps builders catch any unexpected data staleness directly from their application's interface.

<img src="./media/widgets-data-freshness-example.png" alt="An example of the data freshness widget." width="400">

The widget displays the **Last Updated** timestamp for configured object types and datasources to reflect when they were last indexed. If the last index time exceeds 24 hours, the timestamp renders an absolute format (`Thu, Jul 17, 2025, 1:52 PM`). If the last index time is within 24 hours, the timestamp renders a relative format (`2 hours ago` or `30 min ago`).

## Configuration options

<img src="./media/widgets-data-freshness-configuration.png" alt="Data freshness widget configuration empty state." width="400">

* **Add item** Adds a new item that enables builders to display an object type and its backing datasources in the widget.
  * **Object type:** Select an object type to display in the widget.
  * **Add source:** Configure one or multiple datasources per object type to display.
    * **Resource:** Select a datasource to be displayed in the widget with the configured object type using the Foundry resource selector.
    * **Override resource name:** An optional configuration field that allows builders to override and set the name displayed for the datasource in the widget.
