<!-- source: https://palantir.com/docs/foundry/object-indexing/data-restrictions/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Data restrictions

Object Storage v2 (OSv2) enforces data restrictions to ensure the quality of data going into the ontology, provide more deterministic behavior, and increase legibility across the platform. These restrictions are validated during indexing. For object types backed by batch datasources, violations will cause indexing jobs to fail. For object types backed by streaming datasources, records that violate these restrictions are dropped.

## Primary keys and uniqueness

OSv2 enforces unique object primary keys for datasources. If there are duplicate primary keys within a single transaction, indexing will fail and throw an error. If there are duplicate primary keys across transactions, the version in the later transaction will be used.

OSv2 prevents certain data types from being used as primary keys in order to encourage Ontology modeling best practices. The following types **cannot** be used as primary keys:

* Geopoint
* Geoshapes
* Arrays
* Time series properties
* Real number types (decimal, double, float)

## Property type restrictions

* OSv2 enforces data type coherence between datasource schema and object type schema on every sync. Incompatible data types for a property will cause the build to fail.
* When changing the base type of an existing property (for example, from `Double` to `Integer`), all existing values for that property must be strictly compatible with the target type. If any data entries include values incompatible with the new type (such as fractional numbers when changing to Integer, or currency symbols), the migration will fail with an error such as `A property could not be cast to the new type`. Schema migrations will not proceed if incompatible values exist, and the migration process cannot automatically clean or coerce these values.
* OSv2 does not allow `NaN` or `±infinity` as property values.
* Empty strings are not allowed in OSv2; in OSv1, empty strings were silently converted to nulls.
* `Lat, Long` should be a comma-separated string with no parentheses, for example `-29.123, 150.982`.
* OSv2 does not allow properties with nested arrays.
* OSv2 does not allow properties with array data types to have null elements within the array.
* OSv2 supports `Not` conditions in granular permissioning policies of restricted view datasources where the negated field is a collection and has a **non-empty** constraint. This can be configured in Ontology Manager by marking the relevant property as **required**.
* OSv2 has stricter validations on geopoint properties.

## Property size limits

OSv2 enforces size limits on individual properties to ensure reliable indexing performance and stability. These limits address serialization constraints and memory pressure that can occur when processing large property values.

| Property type | Maximum size |
| ------------- | ------------ |
| String properties | 12 MB |
| Array properties | 100,000 elements |

Properties exceeding these limits will cause indexing jobs to fail. These limits are initially enforced for object types backed by batch datasources; similar limits will be applied to object types with streaming datasources in the future.

### Recommendations for large data

* **Large string properties:** If you need to store data exceeding 12 MB, use a [media reference property](/docs/foundry/object-link-types/base-types/#media-references) instead. Media references allow you to associate large files or binary content with an object without impacting indexing performance.
* **Large arrays:** If you need to model relationships that would exceed 100,000 elements, consider using [link types](/docs/foundry/object-link-types/create-link-type/) instead of array properties. Links provide a more scalable and queryable way to represent relationships between objects.
