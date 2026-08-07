<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/moduloV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Modulo

> Supported in: Batch, Faster, Streaming

Returns modulus of an expression.

**Expression categories:** Numeric

## Declared arguments

* **Denominator:** The divisor for the modulus operation.<br>*Expression\<DefiniteNumeric>*
* **Numerator:** The value to compute the modulus of.<br>*Expression\<DefiniteNumeric>*

**Output type:** *DefiniteNumeric*

## Examples

### Example 1: Base case

**Argument values:**

* **Denominator:** 4
* **Numerator:** 10.123

**Output:** 2.123

***

### Example 2: Null case

**Argument values:**

* **Denominator:** 2
* **Numerator:** *null*

**Output:** *null*

***
