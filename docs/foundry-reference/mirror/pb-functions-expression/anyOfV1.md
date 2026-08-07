<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/anyOfV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Any of

> Supported in: Batch, Faster

Calculate the boolean 'or' of an aggregate. Nulls are considered false.

**Expression categories:** Aggregate

## Declared arguments

* **Expression:** The column on which to compute 'any'.<br>*Expression\<Boolean>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| true |
| false |
| true |

**Outputs:** true

***

### Example 2: Null case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| false |
| false |
| *null* |

**Outputs:** false

***
