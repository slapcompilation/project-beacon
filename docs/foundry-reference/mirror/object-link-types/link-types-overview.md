<!-- source: https://palantir.com/docs/foundry/object-link-types/link-types-overview/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Link types

A **link type** is the schema definition of a relationship between two object types. A **link** refers to a single instance of that relationship between two objects in the same Ontology.

For example, in the Ontology Manager, you may create a link type between the `Employee` object type and the `Company` object type that defines the relationship between `Employee` and `Employer`. A link refers to a single instance of the `Employee → Employer` link type, like the relationship between the notional employee “Melissa Chang” and her employer, “Acme, Inc.”

Similarly, in the Ontology Manager, you may create a link type between the `Flight` object type and the `Aircraft` object type that defines the relationship between `Scheduled Flight` and `Assigned Aircraft`. A link refers to a single instance of the `Scheduled Flight → Assigned Aircraft` link type, like the relationship between “JFK → SFO 24-02-2021” and its assigned aircraft “Boeing 737-123”.

Links can also exist between two objects of the same type. A link type `Direct Report ↔ Manager` can be defined between the `Employee` object type and itself.

Note that links between object types across different Ontologies is not supported. In this case, you may prefer to leverage a shared Ontology.

## Directionality

A link type is bidirectional: it always has two **sides**, one for each of the two object types it relates. Each side of a link type can be traversed independently and has its own display name and [API name](/docs/foundry/functions/api-objects-links/). For example, a single `Flight ↔ Aircraft` link type includes a `Flight` side and an `Aircraft` side. From code, calling `flight.assignedAircraft.get()` traverses the `Aircraft` side of the link type to retrieve the aircraft assigned to a flight, and calling `aircraft.flights.all()` traverses the `Flight` side to retrieve the flights assigned to that aircraft.

:::callout{theme="neutral" title="Note"}
Creating a single link type between two object types does not implicitly create a second, reverse link type. Instead, that single link type already supports traversal in both directions through its two sides, so there is no need to separately define a link type from `Aircraft` to `Flight` and another from `Flight` to `Aircraft` to represent the same relationship.
:::

You can define multiple, distinct link types between the same two object types, but each one represents a separate real-world relationship rather than a reverse direction of an existing one. For example, in addition to a `Flight ↔ Aircraft` link type representing an assigned aircraft, you could define a second, independent `Flight ↔ Aircraft` link type representing a scheduled maintenance record. Each link type requires unique [API names](/docs/foundry/object-link-types/create-link-type/#define-link-type-names) on its sides so applications can distinguish between the relationships.

The concepts underpinning the Ontology have analogous concepts in the structure of a dataset. The definition of a link type in the Ontology is analogous to that of a join between two datasets, while the definition of a link is analogous to that of a row joined with the fields of the same row in another dataset. For example, you can join the `Employee` dataset with the `Company` dataset to explore the relationship between `Employees` and their `Employers`. In the joined dataset, a single row that joins “Melissa Chang” with her employer “Acme, Inc.” represents a link.

Rather than being an abstract data model, the Foundry Ontology maps each ontological concept to an organization's actual data, enabling this data asset to power real-world applications. Links are created and displayed in user applications by adding backing datasources to the object types referred to in the link type in the Ontology Manager. In the case of link types where object types are related with a many-to-many cardinality, datasources back the link types themselves. To create links of type `Employee → Employer`, an organization will add backing datasources to the `Employee` and `Company` object types and connect their employee directory and other enterprise data into the Ontology.

Get started by learning how to [create a new link type](/docs/foundry/object-link-types/create-link-type/).
