<!-- source: https://palantir.com/docs/foundry/quiver/card-switch-to-linked-object-set/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Switch to linked object set

Also referred to as “performing a search around”, this operation uses links between objects defined in the Ontology to bring additional objects to the analysis. If you begin with a set of objects of type `A` and create a linked object set of type `B`, you will return all objects of the correct type (type `B`) that have a relation defined between them and the selected objects of type `A`. These object sets do not have to be the same size, and the linked object set may be smaller or larger than the starting object set.

When using this card, if the input object set is under 100k, the scale is unlimited. If the input object set is over 100k, the resulting set of linked objects must be less than 10m.

Learn more about [searching around to linked objects](/docs/foundry/quiver/objects-import-linked/).

## Input type

Object set

## Output type

Object set

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |

## See also

* [Join to linked objects](/docs/foundry/quiver/card-join-to-linked-objects/)
* [Join materializations](/docs/foundry/quiver/card-join-materializations/)
