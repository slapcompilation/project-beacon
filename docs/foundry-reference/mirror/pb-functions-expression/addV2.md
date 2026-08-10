<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/addV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Add numbers

> Supported in: Batch, Faster, Streaming

Calculates the sum of all input columns.

**Expression categories:** Numeric

## Declared arguments

* **Expressions:** List of columns to be added.<br>*List\<Expression\<Numeric>>*

**Output type:** *Numeric*

## Examples

### Example 1: Base case

**Argument values:**

* **Expressions:** \[`col_a`, `col_b`]

| col\_a | col\_b | **Output** |
| ----- | ----- | ----- |
| 0 | 1 | 1 |
| 3 | -2 | 1 |

***
