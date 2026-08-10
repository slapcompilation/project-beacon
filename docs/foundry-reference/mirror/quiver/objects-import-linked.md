<!-- source: https://palantir.com/docs/foundry/quiver/objects-import-linked/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Search around to linked objects

Linked objects (objects that have a [link](/docs/foundry/object-link-types/link-types-overview/) defined between them) are an important part of the Ontology and fundamental for object analysis in Foundry.

## Switch to linked object set

Quiver's [Switch to linked object set](/docs/foundry/quiver/card-switch-to-linked-object-set/) card allows you to create a new object set with all objects of a given type that are linked to an existing object set in your analysis. This process is also known as a *Search Around*.

You can add this card through the next actions menu by selecting  **Join > Switch to linked object set**. Once added, use the relation type dropdown to choose a linked object type. Like all object set cards, these cards can be chained to traverse multiple links.

In the example below, starting with Tea Batch objects, we first search around to the linked Tea Vat objects. Then, from the Tea Vat objects we search around again to linked Tea Vat Sensors.

![Use the switch to linked object set card to perform a search around.](/docs/resources/foundry/quiver/howto-object-set-linked-objects.gif)

This card also supports traversing links using [shared properties](/docs/foundry/object-link-types/shared-property-overview/)

When using this card, if the input object set is under 100k, the scale is unlimited. If the input object set is over 100k, the resulting set of linked objects must be less than 10m.

## Join to linked objects

If you would like to perform a join to linked objects rather than a switch to linked objects, you can use the **Join to linked objects** transform in the [transform table](/docs/foundry/quiver/cards-transform-table/).  This is useful if you want to perform a calculation or visualization on both current property values as well as linked property values at the same time.

The **Join to linked objects** card can be added through the next actions menu by selecting **Join > Join to linked objects**. This card is only available if the input object set is less than 50k objects.

The example below uses the **Join to linked objects** card to join Tea Tasting objects with their linked Tea Batches. The result is a single row that contains properties from both the original tea tasting as well as the linked tea batch.

![Use the join to linked object set card to perform a join across an ontology link.](/docs/resources/foundry/quiver/howto-object-set-join-linked-objects.gif)

## Join materializations

If you would like to perform a join across linked objects but your scale is above 50k objects, you can use a [join materializations](/docs/foundry/quiver/card-join-materializations/) card.  With this card, you will need to define the property match conditions for the join (as opposed to natively using the ontology link), however it allows calculation and visualization across linked object types at scale.
