<!-- source: https://palantir.com/docs/foundry/workshop/derived-properties/ · mirrored 2026-08-03 from Palantir Foundry docs -->

# Derived properties in Workshop

[Derived properties](/docs/foundry/ontology/derived-properties/) are properties that are calculated at runtime based on the values of other properties or links on objects. They allow builders to perform complex operations like linked aggregations and operations between columns directly in Workshop. Derived properties are defined at the module level and per object type.

:::callout{theme="neutral"}
Derived properties are supported for [a subset of widgets and features](#limitations). Contact Palantir Support to discuss expanded support.
:::

## Configuration

In the **Overview** tab, select **Derived properties** from the **Capabilities** section. You can also select the object type from the **Object types** section and add a derived property on the next screen.

<img src="./media/derived-properties-panel.png" alt="Derived properties configuration panel in Workshop." width=200>

### Derived property types

* **Linked property/aggregation:** Select a linked object property to display from a 1:1 link or calculate aggregations across a 1:N link. Aggregations may only be calculated on the linked object type's native properties. Statically defined object property filters on the linked object type may optionally be applied.

<img src="./media/derived-properties-linked-aggregation.png" alt="Example linked aggregation derived property type configuration." width=500>

* **Column math:** Combine values from multiple properties on a single object type. Both the object type's native properties and aggregation type derived properties may be used and referenced. Note that other column math type derived properties may not be used.

<img src="./media/derived-properties-column-math.png" alt="Example column math derived property type configuration." width=500>

## Performance considerations

Derived properties are computed on the fly, which may result in longer module computation times for users. This is an important consideration when using derived properties in performance-critical applications and workflows.

## Limitations

### Supported widgets

Derived properties are only supported for a subset of Workshop widgets and features.

Hover over the **Derived properties** information icon for the list of supported widgets.

<img src="./media/derived-properties-panel-info.png" alt="Derived properties configuration panel in Workshop, info button highlighted." width=200>

Contact Palantir Support if you need expanded support.

### Performance

Derived properties are computed in real time, so consider the impact on module loading times in performance-critical applications.

### Saved states

Saved states do not support object sets that reference derived properties.

### Sorting limitations

When sorting object sets that use derived properties, the object set size is limited to 200 rows. For larger object sets that require sorting, consider expressing the derived property logic as a [function-backed column](/docs/foundry/workshop/widgets-object-table/#function-backed-columns) instead, which supports sorting up to 1,000 rows.
