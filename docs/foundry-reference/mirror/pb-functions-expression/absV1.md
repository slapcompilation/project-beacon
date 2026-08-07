<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/absV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Absolute value

> Supported in: Batch, Faster, Streaming

Returns the absolute value.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** Compute absolute value of this expression.<br>*Expression\<T>*

**Type variable bounds:** *T accepts Numeric*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `numeric_column`

| numeric\_column | **Output** |
| ----- | ----- |
| 0.0 | 0.0 |
| 1.1 | 1.1 |
| -1.1 | 1.1 |

***

### Example 2: Null case

**Argument values:**

* **Expression:** `numeric_column`

| numeric\_column | **Output** |
| ----- | ----- |
| *null* | *null* |

***
