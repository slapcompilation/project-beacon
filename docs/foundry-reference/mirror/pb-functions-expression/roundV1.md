<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/roundV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Round number

> Supported in: Batch, Faster, Streaming

Round number to 'scale' decimal places.

**Expression categories:** Numeric

## Declared arguments

* **Column:** The column to apply round on.<br>*Expression\<Decimal | Double | Float>*
* *optional* **Scale:** Decimal points to round to, defaults as 0.<br>*Literal\<Integer>*

**Output type:** *Decimal | Double | Float*

## Examples

### Example 1: Base case

**Argument values:**

* **Column:** 10.123
* **Scale:** 2

**Output:** 10.12

***

### Example 2: Base case

**Argument values:**

* **Column:** 10.123
* **Scale:** *null*

**Output:** 10.0

***

### Example 3: Base case

**Argument values:**

* **Column:** `number`
* **Scale:** 2

| number | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 4: Base case

**Argument values:**

* **Column:** `number`
* **Scale:** 0

| number | **Output** |
| ----- | ----- |
| 32352366881234567890123456789012345678 | 32352366881234567890123456789012345678 |

***

### Example 5: Base case

**Argument values:**

* **Column:** `number`
* **Scale:** -38

| number | **Output** |
| ----- | ----- |
| 10000000000000000000000000000000000078 | 0 |

***

### Example 6: Base case

**Argument values:**

* **Column:** `number`
* **Scale:** -1

| number | **Output** |
| ----- | ----- |
| 10000000000000000000000000000000000078 | 10000000000000000000000000000000000080 |

***
