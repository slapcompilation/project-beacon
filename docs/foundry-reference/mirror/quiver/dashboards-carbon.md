<!-- source: https://palantir.com/docs/foundry/quiver/dashboards-carbon/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Add to a Carbon workspace

Quiver dashboards can be added to a [Carbon workspace](/docs/foundry/carbon/overview/) as a module. There are three types of modules in Carbon: anchored modules, new tab modules, and discoverable modules.

## Add a dashboard as a module

To add a module, select the **Edit** button in the top right of your Carbon workspace, then choose your current workspace.

<img alt="Carbon edit button" src="./media/carbon-edit-button.png" width="200px">

Discoverable modules can be added from the general tab, while anchored and new tab modules can be added from the menu tab.

<img alt="Carbon discoverable module" src="./media/carbon-discoverable-module.png" width="300px">   <img alt="Carbon anchored and new tab modules" src="./media/carbon-anchored-new-tab-modules.png" width="300px">

Once you’ve decided which type of module you want to add, select **Add item**. This will open a dialog. For **Type**, choose **Quiver dashboard** and then use the **Open Compass dialog** button to find the dashboard you want to add.

<img alt="Carbon add item" src="./media/carbon-add-item.png" width="400px">

Discoverable modules will be accessible to users from the **Open in** menu in Object Explorer.

<img alt="Open in" src="./media/open-in.png" width="300px">

## Add input parameters

You will be presented with configuration options. You can choose to add parameters to pass as input to your Quiver dashboard. To map a parameter to the dashboard input, you need to change the parameter name to map the dashboard input name.

<img alt="Add Carbon parameters" src="./media/carbon-add-parameters.png" width="400px">

If a parameter value is not set, it will default to an empty value (or the base object type for object sets).

Carbon only supports three types of parameters to be passed: *String*, *Object* or *Object type*. This means that if you have inputs to your Quiver dashboard that are of type Boolean, number, or time, they will need to be passed in as strings from Carbon. See the mapping table below for type mapping information.

|Quiver input type	|Carbon input type	|
|---	|---	|
|Boolean	|String: `true` or `false`	|
|Number	|String	|
|String	|String	|
|Time	|String, in ISO format	|
|Time Range	|*Not supported*	|
|Time Series	|*Not supported*	|
|Object	|Object	|
|Object Set	|Object Type	|
|String List	|String: `["option_1","option_2"]`	|

## Set version

By default, the dashboard will autoupdate to the latest version available. You can set the version by adding a `DASHBOARD_VERSION` parameter and setting its value to the version number.
