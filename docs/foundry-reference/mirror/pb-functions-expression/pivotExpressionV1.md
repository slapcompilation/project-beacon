<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/pivotExpressionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Pivot

> Supported in: Streaming

Apply an aggregate expression in a pivot context. The aggregation will run as a set of separate aggregations scoped to each distinct value of the pivot expression. The output is a map from pivot value to aggregate expression value.

**Expression categories:** Aggregate

## Declared arguments

* **Aggregate expression:** The aggregate expression to apply.<br>*Expression\<V>*
* **Pivot expression:** The pivot expression to apply.<br>*Expression\<K>*

**Type variable bounds:** *K accepts ComparableType\*\*V accepts AnyType*

**Output type:** *Map\<K, V>*

## Examples

### Example 1: Base case

**Argument values:**

* **Aggregate expression:** <br>sum(<br> expression: `value`,<br>)
* **Pivot expression:** `pivot`

**Given input table:**

| pivot | value |
| ----- | ----- |
| a | 1 |
| b | 2 |
| a | 3 |

**Outputs:** {<br> a -> 4,<br> b -> 2,<br>}

***

### Example 2: Base case

**Argument values:**

* **Aggregate expression:** <br>sum(<br> expression: `value`,<br>)
* **Pivot expression:** <br>cleanString(<br> cleanActions: {`trim`},<br> expression: `pivot`,<br>)

**Given input table:**

| pivot | value |
| ----- | ----- |
|  a    | 1 |
| b  | 2 |
|    a | 3 |

**Outputs:** {<br> a -> 4,<br> b -> 2,<br>}

***
