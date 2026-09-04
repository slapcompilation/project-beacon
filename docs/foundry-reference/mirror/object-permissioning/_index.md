<!-- source: https://palantir.com/docs/foundry/object-permissioning/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Object permissioning

The Foundry Ontology allows for granular, robust, and flexible security controls for all ontology entities. These entities include [object types](/docs/foundry/object-link-types/object-types-overview/), [link types](/docs/foundry/object-link-types/link-types-overview/), and [action types](/docs/foundry/action-types/overview/), as well as [objects and links](#objects-and-links) (the data itself).

We can conceptualize the Ontology's authorization structure on these two levels: ontology resources, and objects and links.

## Ontology resources

Ontology resources such as object types, link types, and action types define the schema of the ontology. For example, an object type may include display name, property names, property data types, and description. These resources do not refer to the actual property values or primary key values; the actual property values and primary key values are contained in the objects and links.

[Learn more about permissions for ontology resources.](/docs/foundry/object-permissioning/ontology-permissions/)

## Objects and links

Objects and links are the data in the Ontology, with actual primary key and property values. For example, an Airplane object type can have an object with a `Plane ID` property having the value `my_plane_id1`, and a `Maximum Occupancy` property having value `240`.

[Learn more about permissions for objects and links.](/docs/foundry/object-permissioning/managing-object-security/)
