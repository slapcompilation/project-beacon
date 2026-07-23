<!-- source: https://palantir.com/docs/foundry/object-link-types/shared-property-overview/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Shared properties

A **shared property** is a [property](/docs/foundry/object-link-types/properties-overview/) that can be used on multiple [object types](/docs/foundry/object-link-types/object-types-overview/) in your ontology. Shared properties allow for consistent data modeling across object types and centralized management of property metadata. While property metadata is shared across objects, the underlying object data is not.

For example, in Ontology Manager, you may have `Employee` and `Contractor` object types that both have the property `start date`. By creating a `start date` shared property and using it for both object types, you can model your data using a consistent property and update `start date` metadata in one place instead of on each object type.

Shared properties can be [created directly](/docs/foundry/object-link-types/create-shared-property/), or existing properties on object types can be converted into shared properties. Once added to your ontology, shared properties can be [used](/docs/foundry/object-link-types/use-shared-property/) on object types as part of ontologizing your data and [edited](/docs/foundry/object-link-types/edit-shared-property/) in a manner similar to regular properties.

Shared properties on objects are denoted with a globe icon next to their name.

<img src="./media/shared-property-menu-option.png" alt="Shared properties page in Ontology Manager" width="800" />
