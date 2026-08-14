<!-- source: https://palantir.com/docs/foundry/dynamic-scheduling/scheduling-schedule-layer-style/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# Schedule layer (puck) styling

Schedule layers are rendered by default as "pucks" on the Gantt chart. These pucks can represent different concepts of your workflow and be customized to create a dynamic set of visualizations.

There are three ways to customize the appearance of your schedule layer (or "pucks"):

1. **Puck Style**
2. **Coloring**
3. **Properties**

You can also select a **Puck style** to change the visual representation of the pucks in your schedule layer.

## 1. Puck style

Selecting a **Puck style** allows you to change the visual representation of pucks in your layer. Three puck styles are available for configuration:

<img src="./images/schedule-layer-styling-2.png" alt="Schedule layer example styling." width="700" >

* **Standard:**
  * Standard styling renders a rectangular puck on your Gantt chart that can be interacted with via mouse interactions.
  * Optionally, you can provide a puck height to determine the thickness of your puck. As this is backed by a Workshop variable, you can also expose this variable to end users and enable them to change the puck height on demand.
  * Common uses of puck height include:
    * Using a "thin" puck to represent a status over time.
    * Using a "thin" puck to represent a less important or secondary set of information.
    * Using a "thick" puck to represent a "card" of information about the respective event.

* **Background:**
  * Background styling renders a slightly transparent puck on your Gantt chart that cannot be interacted with via mouse interactions.
  * Background pucks do not support Rules.
  * Common uses of background pucks include:
    * Using a background puck to represent availability (for example: green and red color-coded).
    * Using a background puck to represent phases or statuses.
    * Using a background puck to represent preferences.

* **Event:**
  * Event styling renders a point-in-time marker on the Gantt chart, representing a single timestamp rather than a time range.
  * Event pucks do not support drag-and-drop or Rules.
  * The following options are available:
    * **Is global:** When enabled, the event extends across all rows in the chart.
    * **Always open:** When enabled, event flags are always expanded.
    * **Icon:** Select a standard icon or a custom icon backed by a Media Reference property.

## 2. Coloring

You can define the color definition for each schedule layer. Options include: **Static**, **Segmented by**, and **Conditional** coloring.

## 3. Properties

For each schedule layer, you can define the properties from the ontology that will appear directly on the puck or on the popover card.

* Popover properties:
  * Select properties from your schedule layer's object, its linked objects, or use a function-backed property.
  * You can choose to rename or remove the display name. Property formatting is configured alongside the property configuration in Ontology Manager.
  * These properties will appear on the popover card. The popover card appears when a puck is hovered-over.

* Puck properties:
  * Select properties from your schedule layer's object, its linked objects, or use a function-backed property.
  * You can choose to rename or remove the display name. Property formatting is configured alongside the property configuration in Ontology Manager.
  * These properties will appear directly on the puck. If all selected properties cannot fit on the puck, you may need to adjust the height of your puck using the **Puck styling > Standard > Variable height** option described above.
