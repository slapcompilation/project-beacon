<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/multiplyV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Multiply numbers

> Supported in: Batch, Faster, Streaming

Calculates the product of all input columns.

**Expression categories:** Numeric

## Declared arguments

* **Expressions:** List of columns to be multiplied.<br>*List\<Expression\<Numeric>>*

**Output type:** *Numeric*

## Examples

### Example 1: Base case

**Argument values:**

* **Expressions:** \[`col_a`, `col_b`, `col_c`]

| col\_a | col\_b | col\_c | **Output** |
| ----- | ----- | ----- | ----- |
| 10 | 2 | 3 | 60 |

***

### Example 2: Null case

**Argument values:**

* **Expressions:** \[`col_a`, `col_b`]

| col\_a | col\_b | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | *null* |

***

### Example 3: Null case

**Argument values:**

* **Expressions:** \[`col_a`, `col_b`]

| col\_a | col\_b | **Output** |
| ----- | ----- | ----- |
| 1 | *null* | *null* |

***

### Example 4: Null case

**Argument values:**

* **Expressions:** \[`col_a`, `col_b`]

| col\_a | col\_b | **Output** |
| ----- | ----- | ----- |
| *null* | 1 | *null* |

***
