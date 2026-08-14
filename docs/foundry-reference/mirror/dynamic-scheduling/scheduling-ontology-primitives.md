<!-- source: https://palantir.com/docs/foundry/dynamic-scheduling/scheduling-ontology-primitives/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Ontology primitives and data model configuration

The Ontology primitives for dynamic scheduling are comprised of one `Schedule` object and one or more `Resource` objects. Begin by creating your objects in the [Ontology Manager](/docs/foundry/ontology-manager/overview/). At a minimum, the Workshop widget requires two object types: a `Schedule` object and a `Resource` object.

| Object Type | Description |
| --- | --- |
| Schedule object | A schedule object represents the task or activity of interest and should include a start and end time of when that event is occurring and/or the expected duration. |
| Resource object | A resource object represents any entity (such as a person, location, project, etc.) that the schedule object is being assigned to or scheduled against.  |

## Ontology requirements

The `Schedule` object must meet the property and link requirements outlined below.

### Required schedule object properties

| Object property | Type |
| --- | --- |
| Foreign key to resource | String |
| Start time | Timestamp |
| End time | Timestamp |

### Required Ontology links

The schedule object type should be linked to each resource object type. Both many-to-one and many-to-many relationships are supported. For instance, in the example above, many tasks can be assigned to one aircraft. The **Resource Link Type** in the widget configuration determines whether the relationship is many-to-one or many-to-many.

## Example: Aircraft maintenance schedule

The example below demonstrates the process of scheduling maintenance tasks for aircraft.

### Simple configuration

The two-object-type configuration, the minimum requirement for the Dynamic Scheduling Workshop widget, is illustrated below.

* **Schedule object type:** In the example below, maintenance tasks are a time-bound activity.
* **Resource object type:** Aircraft are the object/place where the tasks are conducted.

<img src="./images/dynamic-scheduling-two-obj.png" alt="Schedule object type." width="500" >

### Advanced configuration

The dynamic scheduling data supports a variety of additional configurations beyond the two-object-type model, allowing application builders to create complex, advanced workflows.

Building on the two-object-type model above, in addition to scheduling *when* maintenance tasks will occur on an assigned aircraft, users can also determine *who* will carry out the maintenance task by assigning the task to a specific mechanic. In this new Ontology, as pictured below, the mechanic object acts as a **second resource object type**, which can be unlimited in number.

* **Schedule object type:** Maintenance tasks are a time-bound activity.
* **Resource object type 1:** Aircraft are the object/place where the tasks are conducted.
* **Resource object type 2:** Mechanic who will carry out the assigned maintenance task.

<img src="./images/three-obj.png" alt="Advanced schedule object type." width="500" >
