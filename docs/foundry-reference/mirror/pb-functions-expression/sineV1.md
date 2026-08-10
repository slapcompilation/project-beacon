<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/sineV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Sine

> Supported in: Batch, Faster, Streaming

Takes the sine of an angle.

**Expression categories:** Numeric

## Declared arguments

* **Angle unit:** Angle unit which is either degrees or radians.<br>*Enum\<Degrees, Radians>*
* **Angle value:** Angle value in either radians or degrees.<br>*Expression\<DefiniteNumeric>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Angle unit:** `degrees`
* **Angle value:** `angle`

| angle | **Output** |
| ----- | ----- |
| 0.0 | 0.0 |
| 90.0 | 1.0 |
| 180.0 | 0.0 |

***

### Example 2: Null case

**Argument values:**

* **Angle unit:** `radians`
* **Angle value:** *null*

**Output:** *null*

***
