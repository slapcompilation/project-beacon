<!-- source: https://palantir.com/docs/foundry/object-monitors/create_new_object_monitor/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Create a new object monitor

:::callout{theme="warning"}
Object Monitors are superseded by [Automate](/docs/foundry/automate/overview/). Automate is a fully backward-compatible product that offers a single entry point for all business automation in the platform.
:::

:::callout{theme="neutral"}
This tutorial assumes you already have data integrated into your Foundry Ontology. If you need to do this first, learn how to [create your Ontology](/docs/foundry/ontology/overview/) in the documentation.
:::

## Create from Object Explorer

Monitors can be created in Object Explorer after saving an exploration by clicking **Monitor** in the upper right of your screen. An exploration can be saved by clicking **Save** in the exploration view and selecting a Project or folder destination.

<img src="./media/save_exploration_tooltip.png" alt="save_exploration_tooltip" width="400"/>

### Create an object monitor

After saving the exploration, click **Monitor** to open a view showing all object monitors using this exploration as an input. In newly created explorations, this list is empty.

<img src="./media/add_new_monitor_popover_zero_state.png" alt="add_new_monitor_popover_zero_state" width="400"/>

Click **Add new Monitor** to open a simplified setup view for a new monitor.

<img src="./media/create_new_monitor_object_explorer_view.png" alt="create_new_monitor_object_explorer_view" width="400"/>

Add a monitor name, optional description, and monitor [condition](/docs/foundry/object-monitors/condition/).

<img src="./media/condition_dropdown_create_new_monitor_object_explorer_view.png" alt="condition_dropdown_create_new_monitor_object_explorer_view" width="400"/>

:::callout{theme="neutral"}
Advanced conditions containing nested sub-conditions cannot be configured from this view. Instead, they must be created and modified from the Object Monitors application.
:::

You may also optionally change the default save location from **Private** to a Public project. If you plan to have additional subscribers, we recommend storing the saved exploration and monitor in a shared Project.

<img src="./media/monitor_save_location_dialog.png" alt="monitor_save_location_dialog" width="400"/>

After entering the required information and clicking save, you will return to the list of monitors for the exploration. This list will now contain the newly created monitor.

<img src="./media/after_creation_monitor_list_object_explorer.png" alt="after_creation_monitor_list_object_explorer" width="400"/>

### After saving

Additional options are available once a monitor has been saved.

Metadata about the monitor, including its save location, creation time, and last updated time, are shown in the **Details** tab. This tab also displays the [expiration date](/docs/foundry/object-monitors/monitor/#expiration) and allows you to extend the expiration three months into the future.

<img src="./media/object_explorer_monitor_details_tab.png" alt="object_explorer_monitor_details_tab" width="400"/>

Subscribers may be added or removed from the **Subscribers** tab, and notifications can be enabled or disabled per subscriber.

<img src="./media/object_explorer_monitor_subscribers_tab.png" alt="object_explorer_monitor_subscribers_tab" width="400"/>

Actions may be optionally configured from the **Actions** tab.

Learn more about [configuring Actions](/docs/foundry/object-monitors/actions/) with Object Monitors.

<img src="./media/object_explorer_monitor_actions_tab.png" alt="object_explorer_monitor_actions_tab" width="400"/>

The quick actions dropdown provides options for disabling or muting the monitor and an option to delete the monitor by moving it to the trash.

<img src="./media/object_explorer_monitor_quick_actions_popover.png" alt="object_explorer_monitor_quick_actions_popover" width="400"/>

## Create from Object Monitors application

The Object Monitors application shows an overview of all available monitors across all Projects for a given user. Follow these steps to create a new monitor in the application interface.

<img src="./media/management_application_overview.png" alt="management_application_overview"/>

1. Create a new monitor by clicking **Add Monitor** in the upper right corner.

<img src="./media/management_app_create_new_monitor_zero_state.png" alt="management_app_create_new_monitor_zero_state"/>

2. Select a save location for the new monitor. For monitors that will have multiple subscribers, we recommend storing them in a shared Project.

<img src="./media/management_app_change_save_location.png" alt="management_app_change_save_location"/>

3. Provide the full condition configuration. Configuration options vary depending on if you choose to use [event](/docs/foundry/object-monitors/condition/#event) or [threshold](/docs/foundry/object-monitors/condition/#threshold) conditions. The monitor [inputs](/docs/foundry/object-monitors/input/) must use existing saved explorations created in Object Explorer. If the required input exploration does not exist, [create it](/docs/foundry/object-explorer/save-explorations/) in Object Explorer and then return to this step.

<img src="./media/management_app_threshold_condition_tab.png" alt="management_app_threshold_condition_tab"/>

<img src="./media/management_app_event_condition_tab.png" alt="management_app_event_condition_tab"/>

Additional subscribers may be added from the **Subscribers** tab.

<img src="./media/management_app_subscriber_tab.png" alt="management_app_subscriber_tab"/>

4. Click **Save** to store and enable your new monitor.
