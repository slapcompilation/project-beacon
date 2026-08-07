<!-- source: https://palantir.com/docs/foundry/quiver/objects-property-drilldown/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Drill down on objects sets

You can efficiently drill down from an object set to any specific object or object property in the set through a 1-click pop-out action. This page explains how to drill down to objects, time series columns, and object metrics.

## Specific objects

Rows in an object set card can be popped out as individual object cards.

To pop out an object, move the cursor over the row and click the blue **Pop out object** button that appears to the left of the row. Clicking the button will add an object selector parameter preconfigured to the selected object and an object card that takes the object selector as input.

![Example of popping out an object card](/docs/resources/foundry/quiver/howto-object-set-drilldown-single-object.png)

## Time series columns

Time series columns render as a sparkline directly in the object set card. All time series columns can be popped out as a time series plot.

To pop out a time series, move the cursor over the time series and click the blue **Pop out property** button that appears to the right of the property cell. Clicking the button will add a time series chart with the selected time series plot.

![Example of popping out a time series column](/docs/resources/foundry/quiver/howto-object-set-drilldown-ts-column.png)

Learn more about [adding and removing object properties and linked sensors](/docs/foundry/quiver/cards-index-objects/#browsing-object-set-properties-and-linked-sensors) in an object set card.

## Object metrics

All columns that are not time series can be popped out as an object property (metric) card.

To pop out a non-time series property, move the cursor over the property cell and click the blue **Pop out property** button that appears to the right of the property cell. Clicking the button will add an object property (metric) card with the selected object property preconfigured as input.

![Example of popping out a metric property](/docs/resources/foundry/quiver/howto-object-set-drilldown-metric-property.png)
