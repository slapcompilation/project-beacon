<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/productV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Product

> Supported in: Batch

Calculates the product of all input columns.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** *no description*<br>*Expression\<Numeric>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `factor`

**Given input table:**

| factor |
| ----- |
| 2 |
| 4 |
| 3 |

**Outputs:** 24.0

***

### Example 2: Base case

**Argument values:**

* **Expression:** `factor`

**Given input table:**

| factor |
| ----- |
| 2 |
| *null* |
| 3 |

**Outputs:** 6.0

***
