<!-- source: https://palantir.com/docs/foundry/object-link-types/structs-overview/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Structs

A **struct** is an Ontology property [base type](/docs/foundry/object-link-types/base-types/) that lets a single property hold several fields instead of one value. You declare those fields when you define the property, and each field has its own name and type. You can model many common object properties this way. For example, a `Full Name` property can hold the fields `firstName` and `lastName`, and an `Address` property can hold `street`, `city`, `postalCode`, and `country`.

A struct property is backed by a single datasource column whose type is itself a struct. In Ontology Manager, you select that column as the property's **Backing column** when you [create the struct property](/docs/foundry/object-link-types/create-struct-type/). The field values can start out in different datasources, as long as you combine them into a single struct type column before you define the property in the Ontology.

## Struct configuration

Struct properties have the following constraints:

* A struct property cannot contain another struct.
* A struct field cannot be an array, although a struct property itself can hold an array of structs.
* A struct property must have at least one field.
* Struct property fields currently support only the following types:
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

Structs are indexed similarly to [ElasticSearch object field types ↗](https://www.elastic.co/docs/reference/elasticsearch/mapping-reference/object), which means that a query evaluates each field condition independently. When a struct property holds an array, a query can match an object even though no single struct in that array satisfies every condition.

For example, consider a `Full Name` property that holds an array of values. If an object stores `[{"firstName": "Ada", "lastName": "Chen"}, {"firstName": "Blake", "lastName": "Moreau"}]`, a query for `"firstName": "Ada" AND "lastName": "Moreau"` matches that object. The first value satisfies the `firstName` condition and the second satisfies the `lastName` condition, so both conditions are met even though neither value meets both on its own.

## Current levels of support

Support for struct properties is still expanding, so availability varies across the Palantir platform. Structs are currently supported in the following applications and services:

* **[Ontology Manager](/docs/foundry/ontology-manager/overview/):** Define and edit structs.
* **[Actions](/docs/foundry/action-types/overview/):** [Create and modify struct property values](/docs/foundry/action-types/actions-on-structs/).
* **[Pipeline Builder](/docs/foundry/pipeline-builder/overview/):** Define and edit structs.
* **[Workshop](/docs/foundry/workshop/overview/):** Display and use struct properties as variables.
* **[Marketplace](/docs/foundry/marketplace/overview/):** Package and install struct properties.
* **[Object Explorer](/docs/foundry/object-explorer/search-objects/):** Search for objects by their struct property values. Struct field search is under development.
* **[Ontology SDK](/docs/foundry/ontology-sdk/overview/):** Load struct properties and search for objects by their struct property values. Not every Ontology SDK supports struct properties, so refer to the [unsupported property types](/docs/foundry/ontology-sdk/unsupported-types/#object-types-unsupported-property-types) documentation.
* **[Functions](/docs/foundry/functions/overview/):** TypeScript v2 and Python functions support struct parameters and struct property edits.

Structs will not be supported in Object Storage v1 (Phonograph). You can currently create struct properties only from datasets and restricted views.
