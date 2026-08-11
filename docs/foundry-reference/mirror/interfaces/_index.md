<!-- source: https://palantir.com/docs/foundry/interfaces/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Interfaces

An **interface** is an Ontology type that describes the shape of an object type and its capabilities. Interfaces allow for consistent modeling of and interaction with object types that share a common shape. For example, a `Facility` interface may include `Facility Name` and `Location` properties. `Facility` could be implemented by object types such as `Airport`, `Manufacturing Plant`, or `Maintenance Hangar`, which could each contain additional type-specific properties.

<img src="./images/interface-example.png" alt="An example of a `Facility` interface." width="800" />

By using the `Facility` interface, workflows can interact with `Airport`, `Manufacturing Plant`, and `Maintenance Hangar` object types, either in aggregate or independently, without needing to know specific details about those object types. Additionally, if new object types that implement the `Facility` interface are introduced, the workflow will be immediately compatible with the new object types without additional refactors.

Review the [current levels of support](/docs/foundry/interfaces/interface-overview/#current-levels-of-support) to learn more about where you can use interfaces in the platform.

## Interface features

An interface is composed of interface properties, [link type constraints](/docs/foundry/interfaces/interface-link-types-overview/), [action type constraints](/docs/foundry/interfaces/interface-action-type-constraints/), and [metadata](/docs/foundry/interfaces/interface-metadata/) about the interface. Interface properties can be defined locally on the interface (recommended) or using [shared properties](/docs/foundry/object-link-types/shared-property-overview/). An interface can be implemented by multiple object types.

Much like interfaces in programming languages, you can [extend an interface](/docs/foundry/interfaces/extend-interface/) to create a child interface that inherits the properties of the original interface, then add new, more specific properties to the child interface. Object types can then [implement the interface](/docs/foundry/interfaces/implement-interface/) to indicate that they conform to the interface definition. Object types can implement multiple interfaces, for use in different workflows. Interfaces can also extend multiple other interfaces, including interfaces that themselves extend other interfaces, resulting in properties that are inherited through layers of interfaces.

## Differences between interfaces and object types

There are both functional and stylistic differences between interfaces and object types within the Ontology.

Object types are concrete; they have schemas defined by shared or local properties, are backed by datasets containing property values, and can be instantiated as objects.

By contrast, interfaces are abstract; they have schemas defined by interface properties, are not backed by datasets, and cannot be instantiated directly but must be instantiated as a specific object type.

Stylistically, interfaces are visually distinguished from object types in the platform by having dashed lines around their icons.

<img src="./images/interface-icon-example.png" alt="Example interface icon" width="100" />

## Interface permissions

Interfaces are permissioned through [Ontology roles](/docs/foundry/object-permissioning/ontology-permissions-legacy/#ontology-roles).

## Current levels of support

As support for interface Ontology types expands, availability will vary across the Palantir platform.

Interfaces are currently supported in the following applications and services:

* **[Ontology Manager](/docs/foundry/ontology-manager/overview/):** Define, edit, and implement interfaces.
* **[Marketplace](/docs/foundry/marketplace/overview/):** Package and install interfaces.
* **[Functions](/docs/foundry/functions/overview/):** TypeScript v2 functions.

Interfaces are partially supported in the following applications and services:

* **[Actions](/docs/foundry/action-types/overview/):** Define actions to create, modify, delete, or link objects implementing an interface. Interface action type constraints are in beta and can be used to define expected action capabilities across object types implementing an interface.
* **[Object Set Service](/docs/foundry/object-backend/overview/#object-set-service-oss):** Search and sort objects by interfaces. Support for aggregating by interfaces is in development. Support for interface link types is in development.
* **[Ontology SDK](/docs/foundry/ontology-sdk/overview/):** Use interfaces as an API layer for interacting with implementing object types. Support varies by language; TypeScript is currently supported and support for Java and Python is in development.

Interfaces are under active development, but not yet supported in the following:

* **[Workshop](/docs/foundry/workshop/overview/)**
* **[Functions](/docs/foundry/functions/overview/):** TypeScript v1 and Python functions

## Get started with interfaces

To add interfaces to your Ontology, you can [create](/docs/foundry/interfaces/create-interface/) new interfaces or [extend](/docs/foundry/interfaces/extend-interface/) existing ones. Once you have an interface, you can then [implement](/docs/foundry/interfaces/implement-interface/) that interface with an object type of the appropriate shape or [edit](/docs/foundry/interfaces/edit-interface-definition/) it to better fit your Organization as your Ontology evolves.
