<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/convertAngleV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert between angle units

> Supported in: Batch, Faster, Streaming

**Expression categories:** Geospatial, Numeric

## Declared arguments

* **Amount of current unit:** *no description*<br>*Expression\<DefiniteNumeric>*
* **Current unit:** The unit prior to conversion.<br>*Enum\<Degrees, Minutes, Radians, Seconds>*
* **Target unit:** The desired unit after conversion.<br>*Enum\<Degrees, Minutes, Radians, Seconds>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Amount of current unit:** `degrees`
* **Current unit:** `degrees`
* **Target unit:** `radians`

| degrees | **Output** |
| ----- | ----- |
| 180 | 3.141592653589793 |

***

### Example 2: Base case

**Argument values:**

* **Amount of current unit:** `radians`
* **Current unit:** `radians`
* **Target unit:** `degrees`

| radians | **Output** |
| ----- | ----- |
| 3.141592653589793 | 180.0 |

***

### Example 3: Null case

**Argument values:**

* **Amount of current unit:** `radians`
* **Current unit:** `radians`
* **Target unit:** `degrees`

| radians | **Output** |
| ----- | ----- |
| *null* | *null* |

***
