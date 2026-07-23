<!-- source: https://palantir.com/docs/foundry/object-views/widgets-properties-links/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Properties and links

This page discusses all widgets displaying simple tabular views of an object’s data model and ontology, highlighting the properties of the current object, and the links that the object has to other objects.

This category also includes widgets to present statistics, metrics or KPIs that are either pre-calculated in the object’s pipeline and available as a property of the object, or that require aggregations over Linked Objects to the current object.

## Properties widget

The **Properties** widget displays properties of an object or a linked object. A tab containing this widget is created as the default Object View for any newly defined object type.

![Properties widget](/docs/resources/foundry/object-views/widgets_hu-properties.png)

### Properties widget configuration

#### Properties definition in the Ontology Manager

The Properties widget configuration is closely related to the properties definition in the Ontology Manager. As you “Edit Properties and Backing Dataset”, each Property has a separate settings panel, which allows you to define how it will be displayed in the Object View.

There are several settings that affect the display in the Properties Widget:

* Property visibility
  * Prominent: The property will be displayed in the Properties widget, and there is a configuration option in the widget to only display prominent properties. This option is used for the most important core properties of an object.
  * Normal: The property will be displayed in the Properties widget. This option is used for most properties.
  * Hidden: The property will not be displayed in the Properties widget (or anywhere in the Object View or Object Explorer). This option is used for properties such as internal IDs, relation-columns for links to other objects, and so on.
* Render Hints
  * Long text: This option, marking a property as a long text (usually for long strings, such as descriptions, comments, etc.), enables displaying texts in a separate section of the Properties widget.
  * Keywords: Render a property as a keyword, which changes the way it is viewed in the Properties widget, and also allows to display it in a separate section within the widget.
* Type classes: This allows you to define type classes to properties, which would affect their functionality.
* Make a property editable: If you wish to make a property editable, set up an [action type](/docs/foundry/action-types/overview/) or an [inline action](/docs/foundry/action-types/inline-edits/).

<img src="./media/widgets_hu-properties-oma.png" alt="Properties in Ontology Manager" height="500"/>

#### Configuration of the Properties widget itself

In the widget configuration, first select if you wish to display properties of the Current Object, or properties of a Linked Object:

* In case of displaying a Linked Object, first select the link that you wish to display.
* Displaying properties of a Linked Object is possible only if the Current Object is linked to only one object, which is possible either (1) in a one-to-one relationship; (2) in a many-to-one relationship, with the Current Object defined as the “many”.
  * Example: Configuring a Flight object, it is possible to display the properties of the Aircraft linked to this flight (Flights to Aircraft has a many-to-one relationship). However, looking at the Aircraft object, it would not be possible to display properties of the linked Flight, as there are many Flight objects linked to any single Aircraft.

After choosing Current Object / Linked Object, there are 3 components to configure: Data, Sections, View Options.

##### Data

* Select what properties you wish to display:
  * All Properties: Display all properties that are defined as Prominent or Normal, but no Hidden properties. Allows exclusion of a specific set of properties using the `Properties to Exclude` selector (see below).
  * Prominent Properties: Display only the properties defined as Prominent in the Ontology Manager. Allows exclusion of a specific set of properties using the `properties to exclude` selector (see below).
  * Specific Properties: Opens a multi-select dropdown with all properties of that Linked Object, to select between.
  * No Properties: Do not display any property.
* Properties to Exclude: Select which properties you wish to exclude from display - only available for the first two options - of All Properties and Prominent Properties.

##### Sections

By default, there are three sections of properties, which are:

* Normal properties: All Normal and prominent;
* Long text properties: Only long text properties, which are defined as such in the Ontology Manager (see details above);
* Keyword properties: Displays keyword properties of object as tags. Only properties that were marked as keywords in the Ontology Manager, under “Edit Properties and Backing Dataset” would be displayed here.

You can remove or change the order of these sections. There are no additional types of sections to these three.

##### View options

* **User Editable:** Whether to allow users to edit properties. This requires two settings in the Ontology Manager in advance (see more details above):
  * Dataset level: Edits must be enabled on the object type.
  * Property level: There must be an [inline edit action](/docs/foundry/action-types/inline-edits/#object-explorer-inline-edits) attached to the property.
* **Hide Undefined Values:** Hide all properties with undefined (null) values. If this toggle is off, the property will be displayed with “no value” text greyed out.
* **Include link to 'More properties':** This option will render a **View all** button that takes the user to a **Properties** tab within the same object view.

#### Common issues and notes

* The order in which properties are displayed is alphabetical. The main way to order properties in a different way is by using the "Sections" mentioned above, under the widget configuration.
* For more details on how to setup properties as Prominent, set properties as a Long Text or a Keyword, or making them user editable, see the [documentation on editing properties](/docs/foundry/object-link-types/edit-properties/).

## Property Cards

The **Property Cards** widget lets you visualize cards with properties and aggregations over linked objects.

Use the Property Cards widget to display important properties (numeric, timestamps, dates, strings, etc.), aggregations, statistics, metrics, KPIs, and any other key information for the current object or for objects linked to it.

![Property cards](/docs/resources/foundry/object-views/widgets_property-cards.png)

* This widget is affected by filters, which apply to any aggregations of linked objects.
* The Property Cards widget supports a rich UI for [conditional formatting](/docs/foundry/object-link-types/conditional-formatting/) and [value formatting](/docs/foundry/object-link-types/value-formatting/), including both global (based on ontology-level configurations in the ontology editor) and local override options.

### Property Card configuration

Start by adding a new card for each visualization of a property / linked object aggregation. Then, configure the
overall layout of all cards within the widget.

#### Configuration per card

* Property cards can either display **a property** or an **aggregation of linked properties**.
  * When displaying a property, a card can show both properties of the current object, as well as properties of a linked object with a one-to-one relation or a many-to-one (e.g. if the current object is Flight, with a many-to-one relation to Aircraft, it would be possible to show the properties of the Aircraft object).
  * When displaying a linked object, the card can show aggregations of any object linked to the current object in a one-to-many or many-to-many relation.
* In case of an aggregations, select the type of aggregation - count, unique count / cardinality, average, min, max, sum.
* Add a label which will be displayed on the card, as well as an icon and icon color.
* **Conditional formatting and value formatting:** By default, the widget uses the global ontology formatting rules defined at the ontology level for that specific object and property.
  * This widget supports conditional formatting (e.g. color value to red/green according to predefined rules). Supported options are global formatting (as configured in Ontology Manager (see [conditional formatting documentation](/docs/foundry/object-link-types/conditional-formatting/)) and an optional local override. Note that this applies only for properties, not for aggregations.
  * The Property Cards widget supports value formatting (e.g. `$3.6M` instead of `3,625,329`). Supported options are global value formatting (as configured in Ontology Manager; see [value formatting documentation](/docs/foundry/object-link-types/value-formatting/)) and a local override. Note that this applies to properties and to aggregations of linked properties.
  * For local overrides, both value and conditional formatting use the same UI as the ontology level formatting, check the ontology documentation (linked above) for further details.

#### Configuration for all cards on a Property Cards widget

* Once all property and aggregation cards are configured, use the layout configuration to determine styling of background, size, style, alignment and icon style of cards in display.
* If you wish to use different types of visual configurations for different cards, consider adding a new widget instance for each different configuration.

<img height="500" alt="Property cards config" src="./media/widgets_property-cards-config.png">

#### Common issues and notes

* Property Cards is the supported widget for visualizing prominent properties, aggregations, statistics, metrics, KPIs and any other key information for the current object and linked objects.
  * This widget is the preferred solution over any other widget for purposes of visualizing single key properties and aggregations. Consider using the Property Cards widget instead of the following widgets: Statistics, Context Stat Section, Linked Statistics, Advanced Statistics, or Property Plus.
* The Property Cards widget does not support [Functions on Objects](/docs/foundry/functions/functions-on-objects/). If this support is required, consider using Workshop or Quiver and embedding it in the Object View using the dedicated widgets.

## Links

The **Links** widget displays an object's links in a tree view, with the ability to traverse through Links and navigate to Linked Objects. This includes:

* Display a tree of all Linked Objects, with the ability to expand the view for each Linked Objects, to display all Objects Linked to it, and continue hopping through Links (“nested links”);
* Hover over any Object to see a tooltip with all prominent properties of that Object;
* Click on any object to jump to its Object View.

See an example below, which includes 3 steps:

* Starting with an Airport object;
* Moving to all Linked Flights;
* Moving to all Linked Objects of one of these Flights: Aircraft, Destination Airport, all related Post-Flight Reviews.

![Links widget](/docs/resources/foundry/object-views/widgets_hu-links.png)

### Links widget configuration

* Link types (first links only) - allows you to determine which types of links will be displayed on the widget. Users can traverse through links and hop to other linked objects (e.g. from an Airport → to all Flights → to the Aircraft carrying these Flights → to the Airlines owning these Aircraft, etc.)
* Filter Nested Links by Type - this setting allows you to only display Linked Objects that are chosen under the “Link types (first links only)”.

#### Common issues and notes

* It is currently not possible to sort or determine the order of
  * The list of values of Linked Objects (e.g. show all Linked Flights alphabetically).
  * The *types* of Linked Objects under this widget (e.g. show Linked Flights first and Linked Aircraft second).
* This widget is currently not affected by filters. Links displayed are always *all* Objects linked to the current Object.

## Edit History

The **Edit History** widget displays a list view with the history of all edits made for the current object in view. If the object has never been edited or the subset of selected columns (more below) has no edits, this widget will display a `No Edits` message.

<img src="./media/widgets_hu-edits-history.png" alt="Edit history" />

### Edit History configuration

|Option |Description    |
|---    |---    |
|All Properties |Displays edits for all properties on the given object type.  |
|Specific Properties    |Specific Properties, Only displays edits for properties selected in the `Properties to Include` selector in the widget config. |

#### Common issues and notes

* Only changes made via Actions to the object will be shown in Edit History. Changes made in the backing dataset or in the pipeline upstream will not be reflected on this widget.
* Edit History will only reflect the changes made to objects indexed into Object Storage v2 after the [**Track user edit history**](/docs/foundry/object-edits/user-edit-history/) toggle is enabled within Ontology Manager.
* Tracking user edits for object types with marking properties is not supported at this time.
* Each submitted value is logged as an edit, even if it is coming from a default value configured in an action parameter.
