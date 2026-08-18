<!-- source: https://palantir.com/docs/foundry/quiver/transform-table-computation-differences/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Transform table computation differences

The following sections documents the differences between how Quiver [transform tables](/docs/foundry/quiver/card-transform-table/) handle certain computations/visualizations and how they are handled in [object sets](/docs/foundry/quiver/objects-overview/).

## Property types treated as strings

Some complex property types do not have specific transform operations associated with them, but are treated as strings and can be used as input to [string operations](/docs/foundry/quiver/cards-transform-table-index-string-operations/). Ontology array properties are also stringified. For example, if an object had a property with value `["a", "b", "c"]`, then in a transform table it would be a single string `"[a, b, c]"`. In this case, the [split transform](/docs/foundry/quiver/card-split/) can be used to convert the string back into an array.

The following properties are treated as a string in transform tables:

* Geoshape
* Vector
* Struct
* Byte
* Any array property

## Categorical Charts

The transform table categorical charts behave slightly differently for the per series category limit. In the object set categorical charts (such as the [bar chart](/docs/foundry/quiver/card-bar-chart/)), if a series is segmented, categories will be determined based on sorting the unsegmented series. However in the categorical chart from transform table card if a series is segmented, categories will be determined based on sorting the summed segments per category. So the categories shown may differ for the same input data.

## Pivot Table

The [pivot transform table](/docs/foundry/quiver/card-pivot-transform-table/) has a major difference from the object set [pivot table](/docs/foundry/quiver/card-pivot-table/), which is that it shows a dimension for rows/columns that have no value. So if you had a Boolean property that you were pivoting on, you would have three dimensions in the pivot transform table (true, false, no value) while the object set pivot table would only have two dimensions (true or false).

Since the transform table stringifies arrays, the pivot transform table will only have one dimension for each unique property value while the object set pivot table will explode the array so you have one dimension for each unique value in the arrays. For example, if you had an object set with a number array property and two objects with values for that property being `[1, 2, 3]` and `[1, 2, 4]` then in the transform table you would have two dimensions (being `"[1, 2, 3]"` and `"[1, 2, 4]"`) while the object set pivot table would have four dimensions (`1`, `2`, `3`, and `4` each being their own dimension).

The object set pivot table allows you to bucket on struct/vector properties but since those are stringified in the pivot transform table, you will not be able to do the same.
