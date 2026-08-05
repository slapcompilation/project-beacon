<!-- source: https://palantir.com/docs/foundry/map/templates/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Map templates

Map templates are a powerful tool to generate maps complete with all the data a user may need for their geospatial analysis task.

Map templates can be used to generate new maps, and can also be embedded in Workshop modules using the [widget](/docs/foundry/map/widget/).

## Create a map template

First, create a standard map as an example of what you would want the generated maps to be. Then, click the down arrow located beside **Save**, then click **Save as template...**.

<img src="./media/save-as-template.png" alt="Save as template option" width="265" />

## Configure a map template

### Parameters

Map templates let you configure two kinds of parameters, that can be used to configure the following **Search Arounds**:

* **Object parameters:** Define which object types will be used to generate the resulting map.
* **Non-object parameters:** Define additional inputs for primitive data types. For example, `string`, `float`, `double`, `integer`, `long`, `boolean`, `date`, or `timestamp` inputs.

![Template parameters](/docs/resources/foundry/map/template-parameters.png)

### Search Arounds

Next, you can **configure Search Arounds** associated with your template. Each object parameter can be associated with Search Arounds, which can be either simple Search Arounds using Ontology links or Search Around functions.

Any non-object arguments to Search Around functions can be mapped to a value, which can be either a constant or a parameter. To map a function input to a parameter, click the **Parameter** button on left side of the input box and select a parameter from the dropdown.

![Template Search Arounds](/docs/resources/foundry/map/template-search-arounds.png)

### Layers

Object layers can be configured as:

* **Constant:** The layer, including all the objects in it, are included as-is in the template
* **Styling:** The current objects in this layer will be ignored, but all the layer styling will be included in the template. If objects of this type are then added to the map, for example, through template SearchArounds, or by the user, they will be styled accordingly in this way.
* Alternately, the layer can be removed by clicking **X** on the layer so it is not included in the template.

Overlay layers can either be included in the template or removed.

### Series

If you have pinned series on your map, you can choose to include or remove those in the resulting template.

### Interface

The interface of the generated maps can be configured in these ways:

* **Workshop module:** Allow users to see a link back to the selected Workshop module.
* **Series panel:** Opens the **Series panel** by default when a new templated map is created.
* **Viewport settings (Fly to objects on map):** Centers the map automatically on objects present on the map.

## Use a map template

Once the template is opened, you will be prompted to supply values for the template parameters.

An object or an object set can also be preloaded into a template using URL query parameters:

* **Single object:** Use the `objectRids` query parameter `objectRids=<object_rid>`
* **Multiple objects:** Use the `objectRids` query parameter with commas separating the object RIDs `objectRids=<first_object_rid>,<second_object_rid>`
* **Object set:** Use the `objectSetRid` query parameter `objectSetRid=<object_set_rid>`

To interact with the given parameter values, click **Parameters** located in the top toolbar. This will allow you to select all the objects used as values for a given object parameter, or change the parameter values to regenerate your map.

:::callout{theme="neutral"}
Templates can also be embedded in Workshop using the [corresponding widget](/docs/foundry/map/widget/).
:::
