<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/floorV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Floor

> Supported in: Batch, Faster, Streaming

Returns floor of a given fractional value.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** The value to floor.<br>*Expression\<Decimal | Double | Float>*

**Output type:** *Decimal | Long*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** 10.123

**Output:** 10

***

### Example 2: Null case

**Argument values:**

* **Expression:** `number`

| number | **Output** |
| ----- | ----- |
| *null* | *null* |

***
