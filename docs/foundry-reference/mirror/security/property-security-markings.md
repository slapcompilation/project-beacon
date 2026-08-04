<!-- source: https://palantir.com/docs/foundry/security/property-security-markings/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Property security markings

:::callout{theme="neutral"}
Review the [markings](/docs/foundry/security/markings/) and [Classification-based Access Controls (CBAC)](/docs/foundry/security/classification-based-access-controls/) documentation before learning more about property security markings in Foundry.
:::

Property security markings display the markings and CBAC values configured through [object and property security policies](/docs/foundry/object-permissioning/object-security-policies/) when you view or select a property in the following [Workshop](/docs/foundry/workshop/overview/) widgets:

* [Property List](/docs/foundry/workshop/widgets-property-list/)
* [Object List](/docs/foundry/workshop/widgets-object-list/)
* [Object Table](/docs/foundry/workshop/widgets-object-table/)

Displayed strictly for informational purposes, property security markings render as a condensed gray pill with an expanded window view on selection.

![An object property's security markings are displayed in a condensed pill and its expanded window.](/docs/resources/foundry/security/property-security-condensed-pill.png)

Foundry verifies each property against its security markings to ensure all users with the appropriate access can view its value, even if you toggle the pill's visibility off in any of its supported widgets. Property security markings abstract away certain complexities about the requirements necessary to view the property's data. As an example, a property marked with the `Mock Unclassified` CBAC marking within an object with the `Mock Secret` CBAC marking will be displayed as `Mock Unclassified` in the object view. However, users must have access to the `Mock Secret` CBAC marking to view the property's data.

[Learn more about Foundry's strict access requirements and user permissions controls.](/docs/foundry/security/checking-permissions/)

:::callout{theme="neutral"}
The ability to view property security markings will extend to additional Workshop widgets and other Foundry applications as the feature matures during active development.
:::

## View property security markings in Workshop

Toggle on **Show security markings** in the **Widget setup** tab when configuring a Property List, Object List, or Object Table widget in Workshop, then choose from the following display options:

* **Responsive:** Displays the full security marking when space permits and a truncated tag to fit available space. Foundry displays the full marking in a tooltip upon hover. This option is not available for the Object Table widget.
* **Full Tag:** Displays the full security marking at all times, line-wrapping at small widths.
* **Icon Only:** Displays the marking icon and the full security marking only upon hover.

:::callout{theme="neutral"}
If your enrollment does not contain CBAC markings, then you will not need to select from the options listed above. Foundry solely displays the marking shield icon next to properties that contain mandatory markings and renders the marking labels upon hover.
:::

![The Show security markings toggle is enabled in the Property List, Object List, and Object Table widgets in Workshop.](/docs/resources/foundry/security/show-security-icon-in-widgets.png)

Select a property security marking pill on the right side of a property's value in either the Object List or Property List widgets to render an expanded view.

![A property's security markings expanded view is displayed in the Object List and Property List widgets in Workshop.](/docs/resources/foundry/security/property-security-object-property-list-widget.png)

To render the same expanded view in the Object Table widget, hover your cursor over a property value in the table.

![A property's security markings expanded view is displayed in the Object Table widget in Workshop.](/docs/resources/foundry/security/property-security-object-table.png)

## Expected property base type behavior

Property security markings display different behavior based on the property's [base type](/docs/foundry/object-link-types/base-types/).

* **Struct:** Each value in a [struct](/docs/foundry/object-link-types/structs-overview/) field contains the same property security marking, which Foundry displays within a single pill.

![A struct property's security markings pill renders with the struct's singular value.](/docs/resources/foundry/security/property-security-marking-struct.png)

* **Array:** Each value in a base type containing multiple values as an array contains the same property security marking for a value, which Foundry displays in unique pills.

![An array property's security markings pills render with each array value.](/docs/resources/foundry/security/property-security-marking-array.png)

* **Derived property:** A [derived property](/docs/foundry/ontology/derived-properties/) may contain different security markings for each value, whether the property is derived from other singular or struct properties using the **Collect list** aggregation method.

![A derived property's security markings pills differ at the property value level.](/docs/resources/foundry/security/property-security-marking-derived-property.png)

### Unsupported property base types

Currently, Foundry does not support property security markings for the following property base types:

* Arrays of:
  * [Cipher](/docs/foundry/cipher/overview/) text
  * [Media references](/docs/foundry/object-link-types/base-types/#media-references)
  * Attachments
* Geoshape
* [Geotemporal series reference](/docs/foundry/geospatial/types-of-geospatial-and-geotemporal-data/#geotemporal-series-reference-gtsr)
* [Time series](/docs/foundry/time-series/time-series-overview/)
* Vector

Additionally, Foundry does not render property security markings for the following property base types when you hover your cursor over a property value in an Object Table widget:

* Attachment
* Cipher text
* Geotemporal series reference
* Media reference
* Vector
