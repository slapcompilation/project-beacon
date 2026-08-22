<!-- source: https://palantir.com/docs/foundry/object-link-types/type-reference/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Types reference

When you define your Ontology, you can use a wide variety of types to represent real-world definitions of the data you brought into Foundry. The types used in Foundry are categorized as *Ontology* types or *data* types:

* **Ontology types** are used to model a real-world domain into an Ontology.
* **Data** types are used to represent data values. Data types in Foundry are inspired by similar concepts in [RDF ↗](https://w3c.github.io/rdf-concepts/spec/#section-Datatypes), [OWL ↗](https://www.w3.org/TR/owl-ref/#Datatype) and [XSD ↗](https://www.w3.org/TR/xmlschema-2/#datatype).

## Ontology resources

The following types are available to build and define your Ontology.

### Object type

An **object type** is a schema definition of a real-world entity or event, comprised of individual objects. For example, both `JFK` and `LHR` can be objects of an `Airport` object type.

[Learn more about object types.](/docs/foundry/object-link-types/object-types-overview/)

#### Property

A **property** of an object type is a characteristic that informs a real-world entity or event. For example, if `LHR` is an object of the `Airport` object type, `name` and `country` are properties of `Airport`. For the `LHR` object, the property values would be the following:

* **name:** LHR
* **country:** United Kingdom

[Learn more about properties.](/docs/foundry/object-link-types/properties-overview/)

### Shared property

A **shared property** is a property that can be used on multiple object types in your Ontology. Shared properties allow for consistent data modeling across object types and centralized management of property metadata.

[Learn more about shared properties.](/docs/foundry/object-link-types/shared-property-overview/)

### Link type

A **link type** is the schema definition of a relationship between two object types. A **link** refers to a single instance of that relationship between two objects.

[Learn more about link types.](/docs/foundry/object-link-types/link-types-overview/)

### Action type

An **action type** is the schema definition of a set of changes or edits to objects, property values, and links that a user can make all at once. Action types also include the side effect behaviors that happen when an Action occurs. Once an action type is configured in the Ontology, end users can make changes to objects by applying Actions.

[Learn more about action types.](/docs/foundry/action-types/overview/)

### Object type groups

Object type groups are a classification primitive that helps users better search and explore their ontology.

[Learn more about object type groups.](/docs/foundry/object-link-types/type-groups/)

### Interfaces

An **interface** is an Ontology type that describes the shape of an object type and its capabilities. Interfaces provide object type polymorphism, allowing for consistent modeling of and interaction with object types that share a common shape.

Learn more about [interfaces](/docs/foundry/interfaces/interface-overview/).

## Difference between object types and objects

To clarify the difference between object types and objects, examples are provided below. Note that the same distinction applies to link types and links.

### Object type definitions

Object type definitions, sometimes just referred to as "object types", refer to type-level information about ontology entities such as object types, link types, and action types. For example, the metadata for an object type may include display name, property names, property data types, and description. Metadata does not refer to the actual data or values of an object type’s properties or primary key; these are considered ontology data.

### Object instances

Object instances, sometimes just referred to as "objects", are the actual primary key and property values for specific instances of an ontology entity. For example, an `Airplane` object type can have an object instance with a `Plane ID` property having the value `my_plane_id1`, and a `Maximum Occupancy` property having value `240`.

## Value types

**Value types** are semantic wrappers around a field type comprised of metadata and constraints that can enhance type safety, improve expressiveness, and provide additional context. Value types encapsulate domain-specific data types and enforce data validation in a manner reusable across the platform. Commonly used value types include email addresses, URLs, UUIDs, and enumerations.

While field types and base types are defined statically, value types are customized within the context of a given [space](/docs/foundry/security/orgs-and-spaces/). As a result, users cannot create new field types or base types but are able to create **value types** dynamically.

[Learn more about value types.](/docs/foundry/object-link-types/value-types-overview/)
