<!-- source: https://palantir.com/docs/foundry/quiver/card-pivot-transform-table/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Pivot transform table

The pivot transform table is similar to the object set [pivot table card](/docs/foundry/quiver/card-pivot-table/). A [transform table](/docs/foundry/quiver/card-transform-table/) is chosen as input and columns of that table are chosen as **row** and **column** properties; the resulting data is grouped by these properties and aggregated based on the configuration you set in the editor panel.

#### Row properties

Row properties are the properties with values that will be the row headers of the table.

#### Column properties

Column properties are the properties with values that will be the column headers of the table.

#### Aggregations

Aggregation configurations allow you to set the way you want the data to be aggregated for each cell, grouped by row and column properties. The pivot transform table card provides numerous configuration options for aggregations, such as:

* Count
* Sum of a numeric property
* Min of a numeric property
* Max of a numeric property
* Unique count of a property

For example, suppose you have a dataset of daily precipitation by city in the United States. If you select `city` as a row property, `year` as a column property, and `sum of precipitation` as an aggregation, then the column headers will be `New York`, `Chicago`, and `Los Angeles`, the row headers will be `2015`, `2016`, and `2017`, and the values will be the total precipitation in that city during that year.

The only difference between row and column properties is on which edge of the table they appear. For example, if you have configured row properties `A` and `B` with no column properties, the data will be the same as if you had row property `A` and column property `B`, or column properties `A` and `B` with no row properties. Only the layout of the data will be different.

If you would like to do further processing on the columns of a pivot table, or use advanced formatting options like conditional coloring, you can convert a pivot table back to a [transform table](/docs/foundry/quiver/card-transform-table/).

See [transform table computation differences](/docs/foundry/quiver/transform-table-computation-differences/#pivot-table) for more details on how the output of this card may differ from the [pivot table card](/docs/foundry/quiver/card-pivot-table/) for similar input.

## Input type

Transform table

## Output type

Pivot table, transform table

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
