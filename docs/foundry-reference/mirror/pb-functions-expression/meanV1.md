<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/meanV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Mean

> Supported in: Batch, Faster, Streaming

Calculate mean of values in column.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** The column of on which mean is computed.<br>*Expression\<Numeric>*

**Output type:** *Decimal | Double*

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

**Outputs:** 3.0

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

**Outputs:** 2.5

***
