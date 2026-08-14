<!-- source: https://palantir.com/docs/foundry/dynamic-scheduling/scheduling-concepts/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Core concepts

Dynamic scheduling is built on the following core concepts:

## Schedule object

A schedule object is the Ontology's representation of a task or activity, and should include a start and end time of when that event is occurring and/or its expected duration.

## Resource object

A resource object represents any entity (such as person, location, project, etc.) that the schedule object is being assigned to or scheduled against.

## Scheduling widgets

### Scheduling Gantt chart

The scheduling Gantt chart renders an interactive chart for scheduling or resource allocation workflows and consists of two core elements:

* **Schedule objects:** Schedule objects (for example, aircraft maintenance tasks) are rendered as pucks (blocks) on the scheduling Gantt chart. Users can drag and drop pucks to update a schedule object's start time, end time, and/or linked resource object.
* **Resource objects:** Resource objects (for example, an aircraft mechanic) are rendered as rows in the scheduling Gantt chart. When a user hovers over a row, cards will display the resource object's title, properties selected by the module builder, and a link to the object view.

The scheduling Gantt chart widget provides module builders with the flexibility to choose interface colors and interactions such as puck allocation behavior and snap behavior for schedule object pucks.

For more information, see the [scheduling Gantt chart widget](/docs/foundry/dynamic-scheduling/scheduling-gantt-chart-widget/) documentation.

### Calendar

The calendar renders `Schedule` objects over day, week, month, or custom views.

## Scenarios

[Scenarios](/docs/foundry/ontology/overview-ontology-scenario/) enable the creation and comparison of what-if analyses. By using scenarios, edits made in the widget are not directly written to the Ontology. Instead, they are created as proposed changes in an isolated sandbox that can be reviewed and merged.

## Schedule save action handler

A schedule save action handler is used to execute Ontology edits in the scheduling Gantt chart widget. This action is required so users can edit pucks by dragging and dropping, and stage those changes in the Ontology. Most use cases can use a simple Ontology modify action, but a [function-backed custom save action](/docs/foundry/action-types/function-actions-overview/) can be used for advanced workflows. A function-backed action must accept at least the following optional parameters:

* Resource ID (the foreign key to the resource object)
* Start time
* End time

## Suggestion function

[Suggestion functions](/docs/foundry/dynamic-scheduling/scheduling-suggestion-functions/) indicate the suitability of a potential schedule object placement based on logic defined by your organization. When a user selects a schedule object puck, the user interface highlights regions in the schedule that meet the conditions defined in the rule logic. The output of the rule logic can be used to highlight areas where an assignment can be made or, by contrast, areas where assignments cannot be made. Application builders have the option to enforce these rules through a setting in the Workshop widget configuration. When turned on, this feature will force placement of the puck to the closest highlighted region.

## Search function

[Search functions](/docs/foundry/dynamic-scheduling/scheduling-search-functions/) act as your "problem solver," providing scheduling recommendations tailored to your specific needs and criteria. The function returns a set of schedule objects or time slots, depending on the purpose and requirements. Execute a search function by right-clicking in the scheduling Gantt chart widget. The recommendation function always takes the current state of the world into consideration, ensuring that recommendations take into account any scheduling changes users have made in the active scenario.

### Validation rule

[Validation rules](/docs/foundry/dynamic-scheduling/scheduling-validation-rules/) allow you to codify scheduling constraints, enabling end users to build or modify schedules with an understanding of the limitations and restrictions that define their workflows. Each validation rule is backed by a function that evaluates whether the current state of an assignment object meets a certain condition as defined in the function logic.
