<!-- source: https://palantir.com/docs/foundry/dynamic-scheduling/scheduling-drag-to-create/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Drag to create

:::callout{theme="neutral"}
This page describes drag to create for the [Scheduling Gantt Chart widget](/docs/foundry/dynamic-scheduling/scheduling-gantt-chart-widget/). For setting up drag to create for the Calendar widget, see [Drag to create](/docs/foundry/dynamic-scheduling/scheduling-calendar-widget/#drag-to-create).
:::

Enable end users to create new schedule objects on demand using drag to create. Drag to create allows you to initialize a new schedule object on a particular row, at a "dragged from" and "dragged to" start and end timestamp.

In order to configure drag to create, you must provide a `Create Action Type`. On drag and drop of a puck, the widget will call this action.

In the example below, we will refer to the schedule layer as `Object type A`.

## Set up drag-to-create behavior

1. In Ontology Manager, navigate to `Object type A` and create a `Create Action Type`. This action type should have the following parameters:
   * The primary key for your new object
   * The `Start Timestamp` property
   * The `End Timestamp` property
   * The `foreign key` property
   * Optionally, add properties that you want to be filled out on object creation.
   * In the end, the action type should be configured such that inputting a `Start Timestamp`, `End Timestamp`, and `foreign key` will create an object of `object type A` with those values.
2. Now, in Workshop, navigate to **Input Data (Pucks) > \[your schedule layer] > Interactions > Drag Cursor to Create Action**.
3. Under **Drag to Create Action**, select the action type you configured.
4. Under the action type you just inputted, choose **Select parameter to configure** and select the start timestamp, end timestamp, and foreign key parameters. You should now see these three parameters listed in the configuration. We will now select scheduling Gantt variables to pre-fill these parameter values.
   * For the **Start Timestamp** parameter, under **Local Default Value**, select **SELECTED START TIMESTAMP** in the popup to ensure that, on drag to create, the widget automatically passes in the timestamp that you have dragged from.
   * For the **End Timestamp** parameter, under **Local Default Value**, select **SELECTED END TIMESTAMP** in the popup. This will ensure that, on drag to create, the widget automatically passes in the timestamp that you have dragged to.
   * For the **foreign key** parameter, under **Local Default Value**, select **RESOURCE ID** in the popup to ensure that, on drag to create, the widget automatically passes in the row (resource) that you have triggered drag to create on.

## Use

Once set up, `Shift + Drag` on a given row from a start and end time. This will trigger a popup of your drag to create action form. Upon submission, a new schedule object will be created for the specified row, incorporating the start and end timestamps from the "dragged from" and "dragged to" actions.

<img src="./images/drag-to-create.gif" alt="Setting up Drag to Create." width = "800">
