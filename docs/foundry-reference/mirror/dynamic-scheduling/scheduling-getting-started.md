<!-- source: https://palantir.com/docs/foundry/dynamic-scheduling/scheduling-getting-started/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Getting started

The following guide provides the steps to implement a first version of your dynamic scheduling workflow. Review the referenced documentation in each section for more information.

## 1. Create core Ontology objects

You must create the following core object types to build a dynamic scheduling workflow:

* Create a `Schedule` object type. This represents the events, assignments, or slots to which resources are allocated. For example, your `Schedule` object type may be `Maintenance Tasks`, which need to be assigned to `Technicians`.
  * The object type must have properties that hold foreign keys to create relations with the resource(s) object types.
  * This object type can have a `fixed duration` Boolean property to enforce or not enforce a static duration of the `Schedule`.
  * You must enable edits on this object, as the start/end/duration and relations to the resources will be edited throughout this process.
* Create one or more resource object types that represent the resources to allocate to the schedule. For example, the persons that need to work on a task (the `Technician`).
* Create links between the `Schedule` object type and the different `Resource` object types.
* Create a save handler action for each `Schedule`. See [drag and drop](/docs/foundry/dynamic-scheduling/scheduling-drag-and-drop/) for more information.
  * A save handler must modify the following parameters on the `Schedule` object. Each parameter must be marked as optional.
    * Resource ID (the foreign key to the resource object)
    * Start Time
    * End Time
  * The parameter IDs in your action must exactly match the property IDs used in your schedule object type (for example, if your property is `start_time`, the parameter ID must also be `start_time`).
  * The start time and end time action parameters must have the same type classes (`schedules:schedulable-start-time` and `schedules:schedulable-end-time`) as the corresponding properties on your schedule object type.

Review the [dynamic scheduling Ontology primitives documentation](/docs/foundry/dynamic-scheduling/scheduling-ontology-primitives/) for more information about the schema of each object type.

## 2. Configure the widget in Workshop

With the core objects created, you can now configure the widget for use in Workshop.

At minimum, the scheduling Gantt chart configuration requires:

* **Timeline Data:** Start and end timestamps that define the global bounds of the chart.
* **Row Data:** The `Resource` objects corresponding to each row of the chart.
* **Input Data (Pucks):** At least one schedule layer with:
  * **Schedule Object Set:** The `Schedule` objects for this layer.
  * **Save Handler Action:** The corresponding save handler action for the `Schedule` object.
    * You should specify the default save handler action parameters within the configuration options using the widget-provided parameters available in the dropdown.

Review the [scheduling Gantt chart widget documentation](/docs/foundry/dynamic-scheduling/scheduling-gantt-chart-widget/) for more information.
