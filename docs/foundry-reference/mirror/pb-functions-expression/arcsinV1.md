<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arcsinV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Arcsin

> Supported in: Batch, Faster, Streaming

Inverse sine function.

**Expression categories:** Numeric

## Declared arguments

* **Angle unit:** Output angle unit which is either degrees or radians.<br>*Enum\<Degrees, Radians>*
* **Value:** The value to compute arcsin on.<br>*Expression\<Double | Float>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Angle unit:** `radians`
* **Value:** 0.0

**Output:** 0.0

***

### Example 2: Null case

**Argument values:**

* **Angle unit:** `radians`
* **Value:** *null*

**Output:** *null*

***
