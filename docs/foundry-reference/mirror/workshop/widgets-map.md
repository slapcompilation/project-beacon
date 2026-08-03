<!-- source: https://palantir.com/docs/foundry/workshop/widgets-map/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Map

The **Map** widget displays an object set or object data as a configurable, interactive, geospatial visualization. This widget shares many core capabilities with the Map application. For more details on layer configuration and interacting with complex geospatial data, see the [Map documentation](/docs/foundry/map/overview/).

Map visualizations are comprised of three types of layers:

* **Base map:** Also called a **base layer**, this layer provides the background map imagery.
* **Object layers:** Represent object data as points or shapes on top of the base layer.
* **Overlay layers:** Preconfigured views of geospatial datasets that can be reused across maps.

The Map widget renders using [MapboxGL ↗](https://docs.mapbox.com/mapbox-gl-js/api/) and requires WebGL. It is optimized for desktop browsers and does not support mobile environments. For mobile or non-WebGL environments, use the [Map \[Legacy\]](/docs/foundry/workshop/widgets-map-legacy/) widget. See the [Map \[Legacy\] vs. Map](/docs/foundry/workshop/widgets-map-legacy/#map-legacy-vs-map) comparison for guidance on choosing between widgets.

Below are some examples of maps with various layer configurations:

<img src="./media/widgets-map-ex.png" alt="Four examples of maps with different layer configurations." width="700" />

## Layers

Users can configure the map object layers using two different options:

* **Local configuration (recommended):** build and modify the contents and style of the map within the Workshop widget editor

* **Import map template:** select an existing [map template](/docs/foundry/map/templates/) resource to use in your module, and map variables to the corresponding input parameters.

### Local configuration

In the widget editor, select **Add object layer** to add a new layer to the map. Then, open the newly created layer, and create a new object set variable or reuse an existing one under **Input object set**. Once added, the new object layer will populate on the map.

With local configuration, layer settings can be completely controlled from the widget editor:

* **Input**
  * **Label:** Rename the layer display title by editing this text field.
  * **Selected objects:** Specify an object set variable that represents the collection of selected objects in a layer in the Map widget. This variable is bidirectional and can either be used to update the layer's selected objects, or it can respond to and adopt object sets that a user selects from the map.
  * **Layer visibility:** Control whether the contents of the layer are visible or hidden in the map. This setting can be configured as a static value or a boolean variable.
  * **Lock layer:** Toggle whether or not the layer is locked. Objects in locked layers cannot be selected by users.
* **Style**
  * From the **Style** section, users can configure the default color, opacity, and label/tooltip settings for a layer. For more information about these options, see the [layer style](/docs/foundry/map/visualize-objects/#layer-style) section from the Map application documentation.
* **Geometry**
  * Under the **Geometry** section, a user can edit the styling for a specific geometry displayed on the map. Like in the Map application, [geometries](/docs/foundry/map/visualize-objects/) are different ways of representing the layer's objects.
  * Geometries can be added by selecting **Add geometry**.  Reorder geometries by dragging them from the left side of their labels, and delete them by selecting the trash icon when hovering over a geometry.
  * [Loading methods](/docs/foundry/map/objects-loading-methods/) \[beta] can also be configured under the **Geometry** section for supported geometry types.
  * If an object type includes a Geoshape property and you configure it in a Map layer geometry, the Map widget automatically loads and renders it. Because Geoshape values can be large, they may impact loading performance. Learn more in [Unsupported object property types](/docs/foundry/workshop/unsupported-object-properties/).
* **Legend visibility**
  * An object layer and its geometries are visible by default in the legend panel of the map. Under the **Legend visibility** section, you can toggle the visibility of the entire layer or individual geometries.

In addition to object layers, the local configuration editor also allows users to add overlay layers. These overlays are created in the [map layer editor](/docs/foundry/map/layer-editor/).

The base layer picker controls the default background map imagery. When the **Show base layer picker** toggle is enabled, users can edit the base map from the Map widget interface.

<img src="./media/widgets-map-base-layer-picker.png" alt="The 'Show base layer picker' toggle below the base map configuration." width="450" />

### Import map template

For information about using an existing resource to configure a Map widget, see [how to embed a map template in a Workshop module](/docs/foundry/map/widget/).

## Interactions

* **Draw options:** Configure which shape drawing tools will be available in the toolbar.
* **Drawn shape colors:** Configure the color of drawn shapes on the map.
* **Drawn shape opacity:** Configure the opacity of drawn shapes on the map.
* **Shape output type:** Control whether the GeoJSON string output of the drawn shapes variable and selected shape variable are represented as a GeoJSON feature or geometry collection.
* **Drawn shapes:** A bidirectional string variable that reflects the shapes drawn within the map interface as a GeoJSON string.
* **On drawn shape:** Configure Workshop events to trigger when a shape is drawn in the map.
* **Enable single draw mode:** Limit users to only draw one shape at a time on the map interface, automatically removing the previous shape when a new one is drawn.
* **Clear shapes after operation:** Control whether drawn shapes are cleared after an operation that uses them (selecting intersecting objects, searching for objects, or searching for tracks).
* **Enable splitting on antimeridian:** Control whether shapes that are drawn across the antimeridian will be split into separate polygons.
* **Enable shaped-based selection:** Enable a tool to select objects on the map that intersect a drawn shape. <br><br>
  ![A button labeled Select intersecting.](/docs/resources/foundry/workshop/map-shapes-toolbar-select-intersecting.png) <br><br>
* **Enable geospatial object search:** Enable a tool to search the Ontology for objects that intersect a drawn shape. <br><br>
  ![A button labeled Search within.](/docs/resources/foundry/workshop/map-shapes-toolbar-search-within.png) <br><br>
* **Enable shape-based track tools:** Enable tools that allow users to search the Ontology for tracks that intersect a drawn shape and filter map breadcrumbs by that shape. <br><br>
  ![A button labeled Track search.](/docs/resources/foundry/workshop/map-shapes-toolbar-track-search.png) ![A button labeled Filter breadcrumbs.](/docs/resources/foundry/workshop/map-shapes-toolbar-filter-breadcrumbs.png) <br><br>
* **Enable shape editing tools:** Enable a tool to modify a drawn shape. <br><br>
  ![A button labeled Modify.](/docs/resources/foundry/workshop/map-shapes-toolbar-modify.png) <br><br>
* **Enable measurements:** Allow users to view the measurements of their drawn shapes. Units are based on [map settings](/docs/foundry/map/settings/#units) if configured, or [default to organization settings](/docs/foundry/map/control-panel/#map-defaults).
  * **Enable polygon perimeter:** Show the length of each segment or the total perimeter length along a drawn polygon's edges.
  * **Enable polygon area:** Show the polygon's area in the center of the drawn polygon.
  * **Enable line measurements:** Show either individual segment lengths or the total length of a drawn line
* **Selected shapes:** A bidirectional string variable that reflects the shapes selected on the map interface as a GeoJSON string.

## Time configuration

* **Enable timeline:** Display the timeline open button at the bottom of the map interface.
  * **Allow user to change selected time:** Enable user control of the selected time cursor in the timeline panel.
    * **Enable user facing live mode toggle:** Enable the **View latest** option in the timeline panel.
  * **Open timeline by default:** Open the timeline by default without selecting the timeline button.
* **Selected time:** Control the selected time using a Workshop variable of type `Timestamp` or `Date`.
* **Time window:** Control the time window using two Workshop variables of type `Timestamp` or `Date`.
* **Time zone:** Change the time zone used on the timeline panel to be `Local` or `UTC`.
  * **Time format:** Additional configuration for the `Local` time zone to be in the time format of `12-hour`, `24-hour`, or `Local`.
* **Playback state:** Use a boolean variable to control whether the timeline is playing or paused.
* **Playback position:** Output the current playback time (in milliseconds) as a numeric variable.
* **Auto pause at:** Use a timestamp array variable to automatically pause playback at specific times.

## Interface

* **Legend:** Display the legend panel in the map interface.
* **Collapse legend panel:** Collapse the legend panel by default when the map is first opened.
* **Panel size:** Choose whether the legend panel should be displayed in full size or in a compact manner.
* **Enable search around:** Enable [search arounds](/docs/foundry/map/templates/#search-arounds) using the toolbar and context menu.
* **Enable advanced selection tools:** Enable selection tools in the toolbar and context menu.
* **Show selection panel:** Display the list of currently selected objects or a selected object's details in a panel in the Map widget interface.
* **Viewport auto zoom:** Control the zooming behavior of the Map widget.
  * **Object set:** Centers the map on the content of the given object set.
  * **All objects:** Centers the map on all objects added to the Map widget
  * **Only update if outside viewport:** Restrict auto zooming behavior to instances where the target objects are completely outside of the current viewport
* **Viewport bounds:** This setting is a bidirectional string variable where the GeoJSON value represents the current viewing window of the map.
* **Viewport follow object set:** Provide an object set that the map window will keep centered as the objects' locations change with the selected time.
* **Enable transition to full Map application:** Allow users to open the Map application from the widget, using their current state.
