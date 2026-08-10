<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/ceilV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Ceil

> Supported in: Batch, Faster, Streaming

Returns ceil of a given fractional value.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** Fractional input value.<br>*Expression\<Decimal | Double | Float>*

**Output type:** *Decimal | Long*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** 10.123

**Output:** 11

***

### Example 2: Null case

**Argument values:**

* **Expression:** `number`

| number | **Output** |
| ----- | ----- |
| *null* | *null* |

***
