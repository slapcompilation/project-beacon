<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isNaNV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is NaN

> Supported in: Batch, Faster, Streaming

Returns true if the input is nan, false otherwise.

**Expression categories:** Boolean

## Declared arguments

* **Expression:** The expression checks is the numerical expression is nan.<br>*Expression\<Double | Float>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** NaN

**Output:** true

***

### Example 2: Base case

**Argument values:**

* **Expression:** 12.57

**Output:** false

***

### Example 3: Null case

**Argument values:**

* **Expression:** *null*

**Output:** false

***

### Example 4: Edge case

**Argument values:**

* **Expression:** `numbers`

| numbers | **Output** |
| ----- | ----- |
| NaN | true |

***
