<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arctanV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Arctan

> Supported in: Batch, Faster, Streaming

Inverse tangent function.

**Expression categories:** Numeric

## Declared arguments

* **Angle unit:** Output angle unit which is either degrees or radians.<br>*Enum\<Degrees, Radians>*
* **Value:** The value to compute arctan on.<br>*Expression\<Double | Float>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Angle unit:** `degrees`
* **Value:** `angle`

| angle | **Output** |
| ----- | ----- |
| -1.0 | -45.0 |
| 0.0 | 0.0 |
| 1.0 | 45.0 |

***

### Example 2: Null case

**Argument values:**

* **Angle unit:** `radians`
* **Value:** *null*

**Output:** *null*

***
