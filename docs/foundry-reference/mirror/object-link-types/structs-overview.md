<!-- source: https://palantir.com/docs/foundry/object-link-types/structs-overview/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Structs

A **struct** is an Ontology property [base type](/docs/foundry/object-link-types/base-types/) that allows users to create schema-based properties with multiple fields. Struct properties are created from struct type dataset columns. Struct property fields can have different data sources as long as the property is transformed into a single struct type column before being defined in the Ontology.

Many common object properties can be modeled as structs. For example, a `Full Name` property with the fields `First Name` and `Last Name`, or an `Address` property that includes `Street`, `City`, `Postal Code`, and `Country` fields.

## Struct configuration

The following is a list of struct property constraints and allowed configurations:

* Structs have a depth of one and cannot be nested.
* Structs must have at least 1 field.
* Only the following field types are currently supported:
  * `BOOLEAN`
  * `BYTE`
  * `DATE`
  * `DECIMAL`
  * `DOUBLE`
  * `FLOAT`
  * `GEOPOINT`
  * `INTEGER`
  * `LONG`
  * `SHORT`
  * `STRING`
  * `TIMESTAMP`

## Query semantics

Structs are indexed similarly to [ElasticSearch object field types ↗](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/object), which means that arrays can have unintuitive behavior. For example, if you have an array of `Full Name` properties, an object containing `[{"firstName": "Harvey", "lastName": "Dent"}, {"firstName": "Two", "lastName": "Face"}]` would match a query for `"firstName": "Harvey" AND "lastName": "Face"`. The two conditions are treated independently, rather than requiring to match on the same struct within the array.

## Current levels of support

As support for struct property types expands, availability will vary across the Palantir platform.

Structs are currently supported in the following applications and services:

* **[Ontology Manager](/docs/foundry/ontology-manager/overview/):** Define and edit structs.
* **[Actions](/docs/foundry/action-types/overview/):** Use actions to [create and modify struct property values](/docs/foundry/action-types/actions-on-structs/).
* **[Pipeline Builder](/docs/foundry/pipeline-builder/overview/):** Define and edit structs.
* **[Workshop](/docs/foundry/workshop/overview/):** Display and use struct properties as variables.
* **[Marketplace](/docs/foundry/marketplace/overview/):** Package and install struct properties.
* **[Object Explorer](/docs/foundry/object-explorer/search-objects/):** Search for objects by their struct property values (struct field search is under development).
* **[Ontology SDK](/docs/foundry/ontology-sdk/overview/):** Load struct properties and search for objects by their struct property values in Ontology SDK applications. Not all Ontology SDKs support struct properties. Refer to the OSDK [unsupported property types](/docs/foundry/ontology-sdk/unsupported-types/#object-types-unsupported-property-types) for more information.
* **[Functions](/docs/foundry/functions/overview/):** Struct parameters and struct property edits are supported in TypeScript v2 and Python functions.

Structs will not be supported in Object Storage v1 (Phonograph) and can currently only be created from datasets and Restricted Views.
