<!-- source: https://palantir.com/docs/foundry/object-link-types/shared-property-metadata/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Metadata reference

A shared property is represented in the Ontology by the following metadata:

* **Name:** The name for the shared property.
* **Description:** Explanatory text about the shared property that anyone can read in user applications. For example, the description of the `start date` shared property may be `The day the employee began new hire training`.
* **RID:** An automatically generated unique identifier for every resource in Foundry. A property’s RID will be referenced in error messages across the platform.
* **Base type:** Indicates the type of values for this property and determines the set of operations available in user applications. For example, the `start date` property will have base type `date`. User applications will allow you to configure a timeline widget with this property.
* **Value formatting:** Depending on the base type of the property, numeric formatting, date and time formatting, user ID, and resource ID formatting are available to apply to the property, transforming its raw values into more readable versions in user applications. Learn more about [value formatting](/docs/foundry/object-link-types/value-formatting/).
* **Type classes:** Additional metadata that are interpreted by user applications. Learn more about [type classes](/docs/foundry/object-link-types/metadata-typeclasses/).
* **Render hints:** Indications to user applications about how to render the property that may be different than most properties of the same base type. Many render hints can be used to impact the performance of reindexes of the object type on which the property is defined. For example, if you do not expect any users to search or sort on the `start date` property in user applications, you can deselect the `searchable` and `sortable` render hints and improve the reindex performance of the `Employee` object type. Learn more about [render hints](/docs/foundry/object-link-types/metadata-render-hints/).
* **Visibility:** An indication to user applications for how prominently to display the property. A `prominent` property will lead applications to show this property first to users. A `hidden` property will not appear in user applications. By default, the `start date` property will have `normal` visibility.
* **Usage:** The object types on which a shared property is used. For example, the `start date` property can be in use by the `Employee`, `Contractor`, and other object types within the Ontology.
