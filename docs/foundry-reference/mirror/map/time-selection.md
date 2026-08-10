<!-- source: https://palantir.com/docs/foundry/map/time-selection/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Time selection

:::callout{theme="warning" title="Deprecated functionality"}
Map's **Time selection** panel has been deprecated, and this documentation will be removed in a future release. The panel's functionality now resides in the [timeline.](/docs/foundry/map/time-overview/#selected-time-and-time-range)
:::

Using the **Time selection** panel, you can adjust the currently selected time and time window. By scrolling through the time window, you can understand how your data changes over time.

## Change the selected time

Adjust your map to visualize data at a time of interest by using the time selector.

:::callout{theme="neutral"}
The time selector only allows selecting a time that lies within the current time window.
:::

![Time selector](/docs/resources/foundry/map/time-selection-selector.png)

You can also use the slider to scroll through your time window:

![Time slider](/docs/resources/foundry/map/time-selection-slider.png)

### View the latest data

Click **View latest** to set the selected time to the current time. When on the **Latest Data** view, the selected time will automatically update to match the current time. Use latest data mode in combination with [streaming data](/docs/foundry/building-pipelines/pipeline-types/#streaming) to visualize data on your map that updates in real time.

## Change the time window

Adjust the time window using the date range selector under the time slider:

![Time window](/docs/resources/foundry/map/time-selection-window.png)
