<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/powerOfV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Power of

> Supported in: Batch, Faster, Streaming

Calculates power of expression to exponent. If any of the values is null, returns null.

**Expression categories:** Numeric

## Declared arguments

* **Exponent:** The exponent for the power of.<br>*Expression\<Numeric>*
* **Expression:** The base for the power of.<br>*Expression\<Numeric>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Exponent:** 3
* **Expression:** 10

**Output:** 1000.0

***

### Example 2: Base case

**Argument values:**

* **Exponent:** 3.0
* **Expression:** 10

**Output:** 1000.0

***

### Example 3: Null case

**Description:** Whenever one of the arguments is null, the output will be null.

**Argument values:**

* **Exponent:** *null*
* **Expression:** 10

**Output:** *null*

***

### Example 4: Null case

**Description:** Whenever one of the arguments is null, the output will be null.

**Argument values:**

* **Exponent:** 3
* **Expression:** *null*

**Output:** *null*

***
