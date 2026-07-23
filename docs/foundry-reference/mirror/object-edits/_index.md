<!-- source: https://palantir.com/docs/foundry/object-edits/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Object edits and materializations

The Foundry Ontology powers operational workflows, helps generate insights, and maintains an up-to-date representation of what matters to you by combining data from a variety of datasources with data coming from user-driven edits to objects. In the Foundry Ontology, users can edit property values, add and remove links, and create and delete objects by applying [Actions](/docs/foundry/action-types/overview/).

An Action in Foundry is a single transaction that changes the properties of one or more objects, based on user-defined logic. Actions enable you to use and manage data while thinking about your overall objectives, rather than chasing specific property edits. Actions can be triggered from Foundry applications (like [Workshop](/docs/foundry/workshop/actions-use/) and [Object Views](/docs/foundry/object-views/overview/)) or from external applications with [Foundry APIs](/docs/foundry/action-types/use-actions/). For more information about how to configure and apply actions, see the [Actions documentation](/docs/foundry/action-types/overview/).

The other pages in this section discuss the necessary configuration for object types and link types to enable Actions, as well as the underlying mechanisms that enable user-driven edits in the Ontology.

:::callout{theme="warning"}
Actions are not yet supported on [object types with Foundry stream datasources](/docs/foundry/object-permissioning/managing-object-security/#object-input-data-sources)
:::
