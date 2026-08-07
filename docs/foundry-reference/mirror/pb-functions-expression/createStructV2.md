<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/createStructV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create struct column

> Supported in: Batch, Faster, Streaming

Combines multiple columns into a single structured column.

**Expression categories:** Struct

## Declared arguments

* **Struct elements:** List of columns used to create struct.<br>*List\<Expression\<AnyType>>*

**Output type:** *Struct*

## Examples

### Example 1: Base case

**Argument values:**

* **Struct elements:** \[`tail_number`, `id`]

| tail\_number | id | **Output** |
| ----- | ----- | ----- |
| MT-112 | 1 | {<br> **id**: 1,<br> **tail\_number**: MT-112,<br>} |
| XB-123 | 2 | {<br> **id**: 2,<br> **tail\_number**: XB-123,<br>} |
| PA-654 | 3 | {<br> **id**: 3,<br> **tail\_number**: PA-654,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Struct elements:** \[`tail_number`, `id`]

| tail\_number | id | **Output** |
| ----- | ----- | ----- |
| *null* | 1 | {<br> **id**: 1,<br> **tail\_number**: *null*,<br>} |
| XB-123 | *null* | {<br> **id**: *null*,<br> **tail\_number**: XB-123,<br>} |
| *null* | *null* | {<br> **id**: *null*,<br> **tail\_number**: *null*,<br>} |

***
