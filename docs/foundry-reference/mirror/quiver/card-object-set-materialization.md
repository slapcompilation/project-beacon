<!-- source: https://palantir.com/docs/foundry/quiver/card-object-set-materialization/ · mirrored 2026-09-04 from Palantir Foundry docs -->

# Object set dataset

Use a dataset of the data from the underlying object set to perform flexible, high scale analysis.

Quiver will use the object type's [materialization](/docs/foundry/object-edits/materializations/) export dataset. If that is not available, it will attempt to use the backing [datasource dataset](/docs/foundry/object-link-types/create-object-type/#choosing-a-backing-datasource).

When adding any dataset card from the next action menu of an object set card, Quiver will automatically use this card to convert the object set data type to a dataset data type.

## Input type

Object set

## Output type

Dataset

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
