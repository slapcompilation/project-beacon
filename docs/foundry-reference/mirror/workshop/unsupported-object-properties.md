<!-- source: https://palantir.com/docs/foundry/workshop/unsupported-object-properties/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Unsupported object property types

Certain [Ontology properties](/docs/foundry/object-link-types/properties-overview/) are extremely large and will increase the loading time in a module. These "non-performant" properties are generally unsupported in Workshop. Information on certain Workshop widgets that support displaying unsupported properties can be found on this page.

The following property types are generally unsupported in Workshop:

* **Geoshape:** Geoshape properties are large JSON strings containing large coordinate arrays. As such, Workshop generally does not support geoshapes.
* **Vector:** Vector properties are large fixed-size float arrays. Viewing the values in a vector property is rarely necessary in operational workflows, since a user cannot typically derive meaning from the values in a vector. As such, Workshop generally does not support vectors.

## Widgets that display unsupported property types

Certain Workshop widgets can be configured to allow viewing of unsupported property types. For widgets that support viewing a property type on-demand, the unsupported property must be specifically revealed by a user action as described below. A warning icon with tooltip will also be displayed for unsupported properties during widget configuration describing its non-performance due to large size.

![adding\_unsupported\_property\_type](/docs/resources/foundry/workshop/adding-unsupported-property-type.png)

The following widgets support viewing specific unsupported properties of an object on-demand:

* **[Object List](/docs/foundry/workshop/widgets-object-list/):** To view an unsupported property's value in an object list widget, select **Load** to reveal its value. <br><br>
  ![unsupported\_property\_in\_object\_list](/docs/resources/foundry/workshop/object-list-supported-property-type.png) <br><br>

* **[Object Table](/docs/foundry/workshop/widgets-object-table/):** To view an unsupported property's value in an object table widget, select **...** button to reveal its value. <br><br>
  ![unsupported\_property\_in\_object\_table](/docs/resources/foundry/workshop/object-table-unsupported-property-type.png) <br><br>

* **[Property List](/docs/foundry/workshop/widgets-property-list/):** To view an unsupported property's value in a property list widget, select **Load** to reveal its value. <br><br>
  ![unsupported\_property\_in\_property\_list](/docs/resources/foundry/workshop/property-list-unsupported-property-type.png) <br><br>

The following widgets support viewing unsupported properties of an object:

* **[Map](/docs/foundry/workshop/widgets-map/):** If a Geoshape property is configured in a Map widget, it will be automatically loaded.
