<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/modeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Mode

> Supported in: Batch, Faster

Calculate mode of values in column.

**Expression categories:** Aggregate

## Declared arguments

* **Expression:** The column of on which mode is computed.<br>*Expression\<Any>*

**Type variable bounds:** *Any accepts Binary | Boolean | Byte | Date | Decimal | Double | Float | Integer | Long | Short | String | Timestamp*

**Output type:** *Any*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| a |
| b |
| b |
| b |
| c |
| c |
| d |

**Outputs:** b

***

### Example 2: Base case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| 1 |
| 1 |
| 2 |
| 2 |
| 2 |
| 2 |
| 4 |

**Outputs:** 2

***

### Example 3: Null case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |

**Outputs:** *null*

***

### Example 4: Null case

**Argument values:**

* **Expression:** `values`

**Given input table:**

| values |
| ----- |
| a |
| *null* |
| *null* |
| *null* |
| c |
| c |
| d |

**Outputs:** c

***
