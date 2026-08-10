<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arctan2V1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Arctan2

> Supported in: Batch, Faster, Streaming

Returns the angle θ between the ray from the origin to the point (x, y) and the positive x-axis, confined to −π<θ<=π.

**Expression categories:** Numeric

## Declared arguments

* **Angle unit:** Output angle unit which is either degrees or radians.<br>*Enum\<Degrees, Radians>*
* **X:** X coordinate value.<br>*Expression\<Double | Float>*
* **Y:** Y coordinate value.<br>*Expression\<Double | Float>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Angle unit:** `degrees`
* **X:** `x`
* **Y:** `y`

| y | x | **Output** |
| ----- | ----- | ----- |
| 0.0 | 0.0 | 0.0 |
| 1.0 | 0.0 | 90.0 |
| 0.0 | -1.0 | 180.0 |
| -1.0 | 0.0 | -90.0 |

***

### Example 2: Null case

**Argument values:**

* **Angle unit:** `radians`
* **X:** *null*
* **Y:** 0.0

**Output:** *null*

***
