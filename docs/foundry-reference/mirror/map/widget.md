<!-- source: https://palantir.com/docs/foundry/map/widget/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Embed a map template in a Workshop module

[Map templates](/docs/foundry/map/templates/) can be embedded in Workshop modules. Their parameter values can be passed directly from Workshop variables.

There are three steps to embed a map template in a Workshop module:

1. [Add a Map widget in Workshop](#add-a-map-widget-in-workshop)
2. [Choose a resource](#choose-a-resource)
3. [Configure the widget](#configure-the-widget)

## Add a Map widget in Workshop

In a section of your choice in the Workshop module, select the **+** icon or **+ Add widget** to open the widget menu, and search for the [Map widget](/docs/foundry/workshop/widgets-map/).

## Choose a resource

In the **Layers** section of the widget editor, select **Import map template** instead of the default **Local configuration**. Under the **Resource** setting, choose **Select** to see a list of compatible resources and select the map template resource you want to embed.

## Configure the widget

For the **Map** widget, most of the configuration options are the same for local configuration and embedded templates. For general configuration, refer to the [Map widget documentation](/docs/foundry/workshop/widgets-map/#interactions). Some widget settings only apply to the embedded template configuration:

* **Layers**
  * **Resource:** Choose the map template resource to embed. Optionally provide an **Override map RID**. If provided, an existing map will be displayed instead of the default map that is generated using the template and its parameters. This allows actions such as loading an existing map from an RID saved in an object property.
  * **Parameters:** Supply values for template parameters using Workshop variables.
  * **Refresh key:** Whenever this variable's value changes, the widget will perform a complete reload of the map.
  * **Base layer picker:** Controls the default background map imagery. When the **Show base layer picker** toggle is enabled, users can edit the base map from the map widget interface.
  * **Load data from scenario:** Load the given resource using a scenario instead of the base Ontology.
  * **Regenerate map after applying scenario:** When set, the map will be refreshed after each scenario modification.

* **Interaction**
  * **Selected objects:** Output an object set of the currently selected object(s). This object set can then be used in downstream widgets in the current module.
  * **On selected objects change:** Configure Workshop events to trigger when the selected objects on the map change. For example, the trigger could open a drawer with a more detailed view of the selected objects.
  * **All visible objects on map:** Output an object set of the visible objects in the current map.
  * **Available actions:** Controls the actions that will be available for submission from the widget. Choose the **Some** option to manually specify the available actions, along with an action config that can leverage module variables as default parameter values.
  * **On selected action application:** Configure Workshop events to trigger when any action is successfully applied within the widget.

* **Interface**
  * **Show layers panel:** Display the layers panel within the map widget interface.
  * **Show histogram:** Display the histogram panel to enable filtering the map by object type or property.
  * **Show series panel:** Display the series panel on the bottom of the map interface.
  * **Incomplete inputs message:** When a map template cannot run due to missing required inputs, this message is displayed to the user in a dialog.
  * **Enable image export to clipboard:** Allow users to export an image of the map to their clipboard.
  * **Filter rendered objects:** When set, allow users to filter the displayed objects on the Map via an **Object set filter** variable.
  * **Saving settings:** Enable to allow the user to save the current map.
    * When the embedded resource is a map template, saving will create a new map resource.
      * This map will be given the name specified by **Default resource name** and be placed in the folder given by **Default folder**. If **Show resource dialog** is enabled, the user will be prompted to pick a resource name and location, with the configured name and folder being shown as a starting point in the resource dialog.
      * If a map is successfully created, the events and/or ontology Action defined in **On create new map** will be triggered. If you wish to use the created map RID as an input to an Action parameter, use the special **Saved map RID** option in the parameter input picker. Note that all required parameters must be configured with a defined default value, as no Action form will be shown to the user.
    * When the embedded resource is a map, saving will simply update the embedded map resource, rather than creating a new resource.

:::callout{theme="neutral"}
Previously, template inputs were supplied using a single input object set variable that contained all the required object types defined in the map template. This is now discouraged as it only works for templates without non-object parameters and one object parameter per object type. If you wish to use this feature regardless, select the **Use legacy input object set** checkbox and supply an object set variable.
:::
