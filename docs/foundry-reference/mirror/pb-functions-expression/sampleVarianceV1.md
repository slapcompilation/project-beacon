<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/sampleVarianceV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Sample variance

> Supported in: Batch, Streaming

Calculate the sample variance of values in column.

**Expression categories:** Aggregate

## Declared arguments

* **Expression:** Calculate the sample variance of this expression.<br>*Expression\<Numeric>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 2 |
| 2 |
| 3 |

**Outputs:** 0.33333333333

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
