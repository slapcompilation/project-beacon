<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/subtractV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Subtract numbers

> Supported in: Batch, Faster, Streaming

Subtract one number from another number.

**Expression categories:** Numeric

## Declared arguments

* **Left:** Left number.<br>*Expression\<Numeric>*
* **Right:** Right number.<br>*Expression\<Numeric>*

**Output type:** *Numeric*

## Examples

### Example 1: Base case

**Argument values:**

* **Left:** `col_a`
* **Right:** `col_b`

| col\_a | col\_b | **Output** |
| ----- | ----- | ----- |
| 32 | 4 | 28 |
| -5 | -3 | -2 |

***
