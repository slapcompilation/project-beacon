<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/sqrtV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Square root

> Supported in: Batch, Faster, Streaming

Calculates the square root of a column.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** Expression to calculate square root of.<br>*Expression\<Numeric>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** 9.0

**Output:** 3.0

***

### Example 2: Base case

**Argument values:**

* **Expression:** 16.3216

**Output:** 4.04

***

### Example 3: Null case

**Argument values:**

* **Expression:** `value`

| value | **Output** |
| ----- | ----- |
| *null* | *null* |

***
