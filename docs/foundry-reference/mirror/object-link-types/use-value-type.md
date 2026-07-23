<!-- source: https://palantir.com/docs/foundry/object-link-types/use-value-type/ · mirrored 2026-07-23 from Palantir Foundry docs -->

# Use value types

Once you have [created a value type](/docs/foundry/object-link-types/create-value-type/), you can use it in as a data type across Foundry. Value types can be supported for the use cases listed below.

* Assigning a value type to an object type property.
* Assigning a value type to a shared property.
* Assigning a value type to a Pipeline Builder pipeline property as a logical type using the `logical type cast` expression and selecting the value type on the property when you write to the objects target.

To assign a value type to a property, select the value type from the dropdown menu during property configuration.

<img src="./media/value-type-use.png" alt="Constraint update warning" width="500" />

:::callout{theme="warning"}
If you apply a value type to an object property that contains property values that fail validation, that object type will fail to index. You can view such index failures in the object type health status in Ontology Manager, where you can correct your data or update your value type to fix the issue.
:::
