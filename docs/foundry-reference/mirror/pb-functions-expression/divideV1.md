<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/divideV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Divide numbers

> Supported in: Batch, Faster, Streaming

Divide one number by another number.

**Expression categories:** Numeric

## Declared arguments

* **Left:** Numerator.<br>*Expression\<Numeric>*
* **Right:** Denominator.<br>*Expression\<Numeric>*

**Output type:** *Decimal | Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Left:** `col_a`
* **Right:** `col_b`

| col\_a | col\_b | **Output** |
| ----- | ----- | ----- |
| 4 | 2 | 2.0 |
| 11 | 2 | 5.5 |

***
