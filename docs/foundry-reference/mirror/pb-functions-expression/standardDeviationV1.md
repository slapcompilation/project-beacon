<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/standardDeviationV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Standard deviation

> Supported in: Batch, Faster

Calculate standard deviation of the values in column.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** The column of on which standard deviation is computed.<br>*Expression\<Numeric>*

**Output type:** *Double*

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

**Outputs:** 0.81649658092773

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

**Outputs:** 0.5

***
