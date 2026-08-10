<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/maxV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Max

> Supported in: Batch, Faster, Streaming

Calculate maximum value in column.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** The column of on which max is computed.<br>*Expression\<ComparableType>*

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

**Outputs:** 4

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

**Outputs:** 3

***
