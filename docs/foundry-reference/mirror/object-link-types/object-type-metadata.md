<!-- source: https://palantir.com/docs/foundry/object-link-types/object-type-metadata/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Metadata reference

An object type is represented in the Ontology by the following metadata:

* **ID:** A unique identifier of the object type, primarily used to reference objects of this type when configuring an application. For example, `employee` may be the ID of the `Employee` object type.
* **RID:** An automatically generated unique identifier for every resource in Foundry. An object type’s RID will be referenced in error messages across the platform.
* **Icon:** A picture and color used as a visual identifier of the object type that will appear in user applications when a user views an object of this type. For example, the person icon may be used to depict the `Employee` object type.
* **Display name:** The name shown to anyone accessing an object of this type in user applications. For example, the display name for the `Employee` object type may be `Employee`.
* **Plural display name:** The name shown to anyone accessing multiple objects of this type in user applications. For example, the plural display name for the `Employee` object type may be `Employees`.
* **Description:** Explanatory text about the object type that anyone can read in user applications. For example, the description of the `Employee` object type may be `All full-time and part-time employees of Organization X`.
* **Groups:** A group is a label that helps you categorize your object types. For example, the `Employee` object type may belong to groups `HR` and `Employee 360`.
* **API name:** The name used when referring to the object type programmatically in code. For example, the API name of the `Employee` object type may be `Employee`. Read more about [API names](/docs/foundry/functions/api-objects-links/).
* **Visibility:** An indication to user applications for how prominently to display the object type. A `prominent` object type will lead applications to show this object type first to users. A `hidden` object type will not appear in user applications. By default, the `Employee` object type will have visibility `normal`.
* **Status:** A signal to users and other Ontology builders about where in the development process the object type stands. It can be `active`, `experimental`, or `deprecated`. By default, the `Employee` object type will have status `experimental`. Read more about [statuses](/docs/foundry/object-link-types/metadata-statuses/).
* **Index status:** The status of the last reindex of the object type and its backing datasources. It can be `success`, `failed`, or `not started`. Read more about [index statuses](/docs/foundry/object-databases/object-storage-v1/).
* **Writeback:** An indication of whether the object type has a writeback dataset generated, and whether allowing end users to make edits to objects of this type is `enabled` or `disabled`. Read more about [writeback datasets](/docs/foundry/object-link-types/allow-editing/).

[Learn more about creating and configuring an object type in the Ontology and about validation requirements for object type metadata.](/docs/foundry/object-link-types/create-object-type/)

[Learn more about Properties (characteristics of an object type).](/docs/foundry/object-link-types/properties-overview/)
