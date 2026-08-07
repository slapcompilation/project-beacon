<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/approxMedianV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Approximate median

> Supported in: Batch

Computes approximate median of values in the column.

**Expression categories:** Aggregate

## Declared arguments

* **Expression:** The column on which to compute the approximate median.<br>*Expression\<Numeric>*

**Output type:** *Numeric*

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

**Outputs:** 3

***

### Example 2: Null case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 3 |
| 4 |
| *null* |

**Outputs:** 3

***
