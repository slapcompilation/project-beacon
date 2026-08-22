<!-- source: https://palantir.com/docs/foundry/ontology/derived-properties/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Derived properties \[Beta]

:::callout{theme="neutral" title="Beta"}
Derived properties are in the [beta](/docs/foundry/platform-overview/development-life-cycle/) phase of development and may not be available on your enrollment. Functionality may change during active development.
:::

Derived properties are properties that are calculated at runtime based on the values of other properties or links on objects. This includes aggregating on or selecting properties of linked objects. Derived properties are then available for further operations, such as filtering, sorting, or aggregating within the same request. Derived properties use the security of all objects involved in the calculation, so they do not expose information a user would otherwise be unable to see.

## Availability

Derived properties are available in the following workflows:

* **Ontology SDK:** Derived properties can be used in the TypeScript OSDK with the `withProperties` operation, to be returned or used in additional filters, aggregations, or sorts. The TypeScript OSDK must be running the `2.2.0-beta.x` version of the `@osdk/client` package or later. Review the API documentation in [Developer Console](/docs/foundry/developer-console/overview/) for more details.

## Known limitations

As a beta feature under active development, derived properties currently have some capability limitations. Many of these capabilities will become available over time as additional functionality is built. Current limitations are listed below:

* **OSv1 support:** Queries with derived properties may not contain any object types indexed using [OSv1](/docs/foundry/object-backend/osv1-osv2-migration/).
* **Text search:** Derived properties cannot be used in text search or keyword filters.
* **Structs in OSDK:** Specifically in current versions of the Typescript OSDK, queries with derived properties may not contain any [struct](/docs/foundry/object-link-types/structs-overview/) property types. You can use a `$select` operation in Ontology SDK to exclude struct properties.
* **Marketplace:** Functions using derived properties are not currently supported in Marketplace.
