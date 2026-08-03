<!-- source: https://palantir.com/docs/foundry/workshop/widgets-property-list/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Property List

The **Property List** widget displays a list of properties from a single provided object.

<img src="./media/widgets-property-list.png" alt="Property list example" width=600>

## Configuration Options

* **Input object set**
  * The input variable which determines the object data that will be displayed within the widget.
  * If the object set contains more than one object, only the first object will be displayed within the widget.
* **Load data from scenario**
  * If toggled on, allows loading object data from a selected [Scenario](/docs/foundry/workshop/scenarios-overview/).
* **Layout**
  * Adjusts the positioning of properties displayed in the widget. Property values can either be displayed adjacent to their corresponding property type labels or below.
* **Property configuration**
  * Select which properties to be displayed in the widget and specify the number of columns displayed.
* **Show security markings**
  * If enabled, [property security markings](/docs/foundry/security/property-security-markings/) render as a condensed gray pill with an expanded window view on selection.
* **Hide null properties**
  * If enabled, null properties will be hidden from the list.

### Unsupported property types

Some large properties, such as Geoshape and Vector, are not loaded by default to improve performance. In View mode, users can select **Load** next to an unsupported property to reveal its value on demand. During configuration, unsupported properties are indicated with a warning icon and tooltip.

## Inline editing

The Property List widget supports inline editing of property values. To enable inline editing for a property, configure an inline action for the property in the Ontology Manager. Once the inline action is configured, users can edit property values directly within the Property List widget.

:::callout{theme="neutral"}
If inline editing is not working for a property in the Property List widget, verify that an inline action has been configured for that property in the Ontology Manager.
:::
