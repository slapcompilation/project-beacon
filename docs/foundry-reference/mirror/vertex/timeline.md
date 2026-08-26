<!-- source: https://palantir.com/docs/foundry/vertex/timeline/ · mirrored 2026-08-26 from Palantir Foundry docs -->

# View and filter events on a timeline

The timeline can be used to inspect the time properties of objects and filter to specific events in a given time range.

![overview-expanded](./images/timeline_overview-expanded.png)

## View time events

The **Timeline** button in the lower-left of the interface can be used to show or hide the timeline.

![timeline-button](./images/timeline_timeline-button.png)

If nothing is visible on the timeline, the **Zoom to fit** button can be helpful to show time events on the graph in the timeline's **Time range**.

![zoom-to-fit](./images/timeline_zoom-to-fit.png)

When visible, the timeline will show lines for an object's time properties and bars for time ranges in an object's properties.

![event-lines](./images/timeline_event-lines.png)
![bar-events](./images/timeline_bar-events.png)

## Filter time events

Events can be filtered on the graph by either holding Shift and left-click dragging on the timeline to create a time filter window, or by using the **Time filter** button in the control bar of the timeline.

The **Time filter** is also available on the top of the application. Nodes on the graph that match the filter are fully opaque, while nodes that do not match the time filter are faded out.

![time-filter](./images/timeline_graph-time-filter.png)

## Change cursor position

The cursor position on the timeline can be changed by double-left-clicking on the timeline, dragging the cursor to a new position, or by using the input in the middle of the control bar.

![cursor-pos](./images/timeline_cursor-pos.png)

To get a more specific date for the cursor, you can click the cursor form to input a specific date and time.

![cursor-edit](./images/timeline_cursor-edit.png)

## Expand the timeline

To show each object type on its own timeline row, click the "expand" button (![double chevron icon pointing upward](./images/double-chevron.png)) in the control bar of the timeline.

![by-object-type](./images/timeline_by-object-type.png)

## Style the timeline

To change how objects appear on the timeline, select the brush icon next to the object node in the **Layers** panel to the left of your screen. Then, expand the **Timeline shape** section.

![The Timeline shape style configuration section for the F1 Race object node. The shape is set to Bar, and there are options to select a start property and end property](./images/timeline_shape-menu.png)

You can change the properties used when drawing the selected shape on the timeline; select the **Start property** and **End property** dropdown menus for shapes that use two time properties, or select **Time property** for shapes that use a single property.

![The style configuration section for the F1 Race object node. The shape is set to Diamond, and there is an option to select a time property.](./images/timeline_diamond-select-time-property.png)

The shape chosen in the timeline style configuration will appear for every instance of the object type in the timeline.

Select the **Timeline Color** menu to configure how shape colors are represented on your timeline.

![The timeline color configuration window, currently set to a fixed color.](./images/timeline_color-menu.png)

You can also use properties and measures to configure timeline [color styling](/docs/foundry/vertex/graphs-display-options/#color-by) by changing the selected option in the **Color by** dropdown menu. For example, the image below is configured to color by the `Year` property with a rainbow color spectrum:

![The timeline color configuration window set to color by a property using a rainbow color spectrum. The objects that appear on the map and timeline use a rainbow of colors based on a linear interpolation.](./images/timeline_color-by-property.png)

## Timeline playback

You can use the play button (⏵) to move the time cursor automatically; playback speed can be adjusted with the speed presets (1x, 2x, 5x, 10x, 100x, and so on).

![The timeline playback controls showing the speed presets and the play/pause button](./images/timeline_playback_controls.png)

The cursor will loop automatically through the time window on the timeline or a time filter if it exists.

![The timeline filter showing that the time cursor stays within that range when using the playback controls](./images/timeline_playback_with_filter.png)
