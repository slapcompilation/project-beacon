<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/minV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Min

> Supported in: Batch, Faster, Streaming

Calculate minimum value in column.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** The column of on which min is computed.<br>*Expression\<ComparableType>*

**Output type:** *ComparableType*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 2

***

### Example 2: Null case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| *null* |
| 3 |

**Outputs:** 2

***
