<!-- source: https://palantir.com/docs/foundry/dynamic-scheduling/program-scheduling-configuration/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Widget configuration

The Program Scheduling widget includes several required and optional configuration settings. This section presents an overview, and the required settings are specifically marked as such.

## Timeline

* **Start timestamp \[REQUIRED]:** Set a timestamp variable to control the beginning of the timeline axis.
* **End timestamp \[REQUIRED]:** Set a timestamp variable to control the end of the timeline axis.

## Input data (layers)

You can use multiple layers to represent different workstreams or object types on a single timeline. For example, one layer could display project tasks while another overlays key milestones. Each layer is independently configurable.

* **Data**
  * **Object set \[REQUIRED]:** The object set that provides the tasks or events for this layer.
  * **Puck type \[REQUIRED]:** Select the visual type for items in this layer. Options are **Standard**, **Background**, or **Event**. See the [puck types](/docs/foundry/dynamic-scheduling/program-scheduling-overview/#puck-types) section for a description of each type.
  * **Start time property \[REQUIRED]:** Select a date or timestamp property to use as the start time.
  * **End time property:** Select a date or timestamp property to use as the end time. Event pucks do not require this property.
  * **Dependency property:** For standard pucks, select an array property that defines dependency relationships between tasks. Dependencies are displayed as arrows connecting related pucks on the timeline. See the [dependencies](/docs/foundry/dynamic-scheduling/program-scheduling-overview/#dependencies) section for more information.

* **Display and formatting**
  * **Grouping properties:** Select one or more properties to organize and nest the table rows by, such as project name, team, or phase. You can configure the sort direction for each grouping property as ascending or descending.
  * **Detail properties:** Select properties to display in the detail card that appears when a user selects a puck.
  * **Color:** Select the colors to use when displaying pucks in the timeline.
    * **Static:** Select a single color for all pucks in this layer.
    * **Dynamic:** Configure conditional formatting rules to apply different colors based on property values — for example, coloring tasks by status or priority.

* **Interactions**
  * **Save handler action:** For standard and event pucks, select an action to trigger when a user drags or resizes a puck. The action receives the updated start and end times, allowing you to write scheduling changes back to the Ontology. This action must accept as parameters:
    * Schedule object
    * Start time
    * End time

      If you would like to edit dependency arrows, you will need to add a parameter for the dependency array property.

  * **Right-click menu:** Configure custom context menu items that appear when a user right-clicks a puck. Each menu item can trigger an action or a Workshop event.

## Interface

* **Expand groups by default:** When enabled, all table groups are expanded when the widget loads. When disabled, groups start collapsed.
* **Hide arrows by default:** When enabled, dependency arrows between pucks are hidden initially. Users can toggle arrow visibility at runtime.
* **Show current time indicator:** Display a vertical line on the timeline representing the current date and time.

## Output

* **Selected object set:** A mutable output variable that captures the currently selected objects. This object set can be used by other Workshop widgets within the current module.
