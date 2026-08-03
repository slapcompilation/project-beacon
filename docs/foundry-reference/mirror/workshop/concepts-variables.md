<!-- source: https://palantir.com/docs/foundry/workshop/concepts-variables/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Variables

**Variables** are used by module builders to configure how data moves through a Workshop module. A list of available [variable types](#variable-types) can be found below.

To access existing variables in a Workshop module or define new variables, open the **Variables** menu found in the left sidebar.

![Variables sidebar panel in Workshop editor](/docs/resources/foundry/workshop/workshop_variables_panel.png)

The **Variables** panel (shown above) displays a list with the current variables that exist within a module, a plus **+** option to add a new variable, an input to search variables by their name or unique ID, an option to open the [variable lineage graph](#variable-lineage-graph), and a filter to display variables based on their definition type or what settings are enabled. The variable list includes partitions to help you quickly find relevant variables: when a widget is selected, a partition displays variables used by that widget; when no widget is selected, a partition displays variables used in the active page.

Selecting a variable from the list on the left allows you to view and modify the configuration of that variable in a window that opens to the right of the variables list. The following configuration options are available:

* **Variable name:** Selecting the variable name or the pencil icon will allow you to edit the name of the variable. We recommend using descriptive variable names to help document the configuration of your Workshop module and make it easier to find a desired variable later in the configuration process.
* **Variable definition type:** Next to the variable name is a dropdown menu that provides options for how a given variable is defined and populated with data. Available choices will vary based on the selected variable type and can include options such as the following:
  * **Static:** For manually set variable values
  * **Function:** For function-backed, dynamically computed variables
  * **Object set aggregation:** For variables derived from an aggregation of an object set
  * **Object property:** For variables tied to a selected property value of single object
    * **Note:** [Complex non-performant object properties](/docs/foundry/workshop/unsupported-object-properties/) are not supported as variables in Workshop.
  * **Object set definition:** Specifically for object set variables defined by selected object types, filters, and linked objects traversals
  * **Variable transformation:** For defining a variable value as a series of common operations, possibly referencing other variables; review the [variable transformations](/docs/foundry/workshop/variable-transformations/) documentation for more information.
* **Delete variable (trash icon):** Variables that are unused in a module (by widgets or downstream variables) can be deleted.
* **New variable from current (object set variables only):** Next to the duplicate variable button, the **New variable from current** button allows you to create a new object set variable that automatically takes the current object set as its input. This is useful when you want to build upon an existing object set's configuration while maintaining a reference to the source variable.
* **Variable definition configuration:** The main part of the screen where the specifics of a variable are configured. The options provided here will change based on the selected variable type and variable definition type and will feature on-screen instructions.
* **Variable settings:** The variable settings panel allows configuration of an external ID and which of the below features should be enabled for a given variable.
  * **[Module interface](/docs/foundry/workshop/module-interface/)**
  * **[Routing](/docs/foundry/workshop/routing/)**
  * **[State saving](/docs/foundry/workshop/state-saving/)**

The screenshot below shows an example configuration for an Object Set variable:

![Editing an Object Set variable](/docs/resources/foundry/workshop/workshop_object_set.png)

The screenshot below shows an example configuration for a string array variable:

![Editing a string array variable](/docs/resources/foundry/workshop/workshop_string_array.png)

## Lazy variable loading

In both view and edit mode, Workshop variables will compute and recompute lazily only when displayed by a visible widget or layout. This means that variables used in non-visible pages, tabs, overlays, or non-visible pages of a looped layout will not be computed until they are shown. This behavior is the same for non-visible variables used in embedded modules.

## Variable types

Workshop supports the following variable types:

* **Array:** Accepts an array of Boolean, date, numeric, geopoint, geoshape, string, timestamp, or struct values.
* **Boolean:** Accepts values of `true` or `false`. Initialized from either a static value or the output of a function, aggregation, or object property.
* **Date:** Accepts a date. Initialized from either a static value or the output of a function, aggregation, or object property.
* **GeoPoint:** Accepts a geopoint. Initialized from an object property.
* **GeoShape:** Accepts a geoshape. Initialized from an object property or the output of a function.
* **Numeric:** Accepts a numerical value, including both integers and floats. Initialized from either a static value or the output of a function, aggregation, or object property.
* **Object set:** Stores a set of one or more objects. Initialized from either an entire object type or another object set variable and then may be optionally filtered by property values or Filter variables, or optionally pivoted to linked objects via a Search Around. You can also pivot to other object types across ontologies through [shared property types](/docs/foundry/object-link-types/shared-property-overview/) or [object-backed link types](/docs/foundry/object-link-types/create-link-type/#object-backed-links).
* **Object set filter:** Stores a set of property type / property value pairs used to filter object set variables. Initialized from an object type and then a set of property type / property value filter pairs. See [object set filter variables](/docs/foundry/workshop/object-set-filter-variables/) for more information.
* **String:** Accepts text. Initialized from either a static value or the output of a function, aggregation, or object property.
* **Struct:** Stores a composite type that maps string fieldIDs to values. Currently, nested structs are not supported but any other Workshop variable type for a struct field's value is accepted. Initialized from the output of a function. See [Struct variables](/docs/foundry/workshop/struct-variables/) for more information.
* **Timestamp:** Accepts a timestamp. Initialized from either a static value or the output of a function, aggregation, or object property.
* **Time series set:** Stores a time series property of a single object, optionally allowing the application of time series transforms to it. See [Time series properties in Workshop](/docs/foundry/workshop/time-series-properties/#time-series-transforms) for more information.

## Recompute variable value

Workshop offers the following configurable recompute behavior options for variable definition types:

* Function
* Object set aggregation
* Object property
* Variable transformation
* Object set filter

The recompute options behave in the following ways:

* **Automatic:** The variable value is recomputed automatically when the value of any of the variables it depends on changes. This is the default option. Note that in some cases, variables with automatic recompute behavior may recompute even when no upstream values have changed. This can happen when upstream objects reload, for example after an action submission or other data reloading trigger, such as [auto-refresh](/docs/foundry/workshop/auto-refresh/).
* **Only when triggered by an event:** The variable value is recomputed only when explicitly triggered by a [recompute {variable name}](/docs/foundry/workshop/concepts-events/#recompute-variable-name) event.
* **On module load, and when triggered by an event:** The variable value is recomputed when the module is initially loaded, and when explicitly triggered by a [recompute {variable name}](/docs/foundry/workshop/concepts-events/#recompute-variable-name) event.

The `Object set definition` variable definition type does not offer recompute behavior configuration, and functions similarly to `Automatic` recompute behavior. If this is undesirable, the recompute behavior may be set on upstream variables. If you wish to manage the recompute behavior of object set variables explicitly, you can use a function backed variable.

## Variable lineage graph

![The button to open the variable lineage graph on the header of the variables panel.](/docs/resources/foundry/workshop/variable-lineage-open-button.png)

Use the **Variable lineage graph** option found in the header of the **Variables** panel, to visualize how variables and widgets in your module depend on one another. Use it to debug recompute behavior, trace which widgets read or write a variable, and better understand complex relationships between application elements.

![A screenshot of the Workshop variable lineage graph showing variables, widgets, and their dependencies.](/docs/resources/foundry/workshop/variable-lineage.png)

### Expanding the graph

Each node on the graph represents a variable or widget. Nodes with dependencies have chevron arrows on their top and bottom edges. Select an arrow to expand a node's parents (upstream dependencies) or children (downstream consumers) and trace a chain of relationships through the module. Use the **Show all** action in the graph header to expand to the full application graph or **Clear** to remove all nodes.

Undo and redo options in the graph header step backward and forward through expand, collapse, and selection actions, mirroring the module's own undo/redo controls.

![A detailed screenshot of the variable lineage graph showing pages and computation time.](/docs/resources/foundry/workshop/variable-lineage-detail.png)

Each node can display the pages and overlays where a variable is used and the time at which a variable was computed.

### Pages and overlays

Nodes are tagged with the pages and overlays where they are referenced. Toggle **Show pages and overlays** in the header to display a legend that lists each page and overlay in use. The legend only lists pages and overlays that appear on visible graph nodes, so the list stays scoped to what you can see in the graph.

### Computation time

Toggle **Show computation time** in the header to display per-variable timing information. Computation time refers to when the value of the variable was last computed in the application (as it appears to the user), not when the underlying data was last updated outside of the application. Variables that take longer to recompute may be candidates for restructuring: for example, splitting a complex function-backed variable into smaller pieces or changing the recompute behavior on upstream variables to avoid unnecessary work.
