<!-- source: https://palantir.com/docs/foundry/quiver/card-pivot-table/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Pivot table

A pivot table is used to display aggregated data over an object set in a table. Object properties are chosen as **row** and **column** properties; the resulting data is grouped by these object properties and aggregated based on the configuration you set in the Editor panel.
Pivot tables are mainly configured in three ways: row properties, column properties, and aggregations.

#### Row properties

Row properties are the properties with values that will be the row headers of the table. Rows will only appear in the table for sets of values with data.

#### Column properties

Column properties are the properties with values that will be the column headers of the table. Columns will only appear in the table for sets of values with data.

#### Aggregations

Aggregation configurations allow you to set the way you want the data to be aggregated for each cell, grouped by row and column properties. The pivot table card provides numerous configuration options for aggregations, such as:

* Count
* Sum of a numeric property
* Min of a numeric property
* Max of a numeric property
* Approximate unique count of a property

Alternatively, you can select **Switch to formula metric** to write your own metric composed of the aggregations listed above. You can also select **+Add Series** to configure as many aggregations as you want. The aggregations will appear next to each other with their own column headers below the headers representing column property values.
For example, suppose you have a dataset of daily precipitation by city in the United States. If you select `city` as a row property, `year` as a column property, and `sum of precipitation` as an aggregation, then the column headers will be `New York`, `Chicago`, and `Los Angeles`, the row headers will be `2015`, `2016`, and `2017`, and the values will be the total precipitation in that city during that year.

The only difference between row and column properties is on which edge of the table they appear. For example, if you have configured row properties `A` and `B` with no column properties, the data will be the same as if you had row property `A` and column property `B`, or column properties `A` and `B` with no row properties. Only the layout of the data will be different.

You can use the pivot table to filter data. Select individual cells or entire rows and columns by clicking on the headers. Clicking **Drill down to selection** will filter the data to those with the property values for the rows and columns you selected. Hold down the shift or command key to select multiple regions of the table.

You can also activate the toggle to **Show grand totals** for rows or columns to show aggregates on the right side (for rows) or bottom (for columns). Be aware that these aggregates apply over all of the data for that set of row or column properties; it is not an aggregate of aggregates. Select the info icon next to this option for a deeper explanation of how grand totals are computed.

If you would like to do further processing on the columns of a pivot table, or use advanced formatting options like conditional coloring, you can convert a pivot table to a [transform table](/docs/foundry/quiver/card-transform-table/).

## Input type

Object set

## Output type

Pivot table, object selection

## Usage information

| Functionality | Availability |
| --- | --- |
| [Standard Quiver card](/docs/foundry/quiver/core-concepts/#cards) | Supported |
| [Transform table transform](/docs/foundry/quiver/cards-transform-table/) | Unsupported |
