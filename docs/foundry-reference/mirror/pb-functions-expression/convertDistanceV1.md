<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/convertDistanceV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert between distance units

> Supported in: Batch, Faster, Streaming

**Expression categories:** Numeric

## Declared arguments

* **Amount of current unit:** *no description*<br>*Expression\<DefiniteNumeric>*
* **Current unit:** The unit prior to conversion.<br>*Enum\<Centimeter, Data mile, Decameter, Decimeter, Foot, Hectometer, Inch, Kilometer, Meter, Mile, and more ...>*
* **Target unit:** The desired unit after conversion.<br>*Enum\<Centimeter, Data mile, Decameter, Decimeter, Foot, Hectometer, Inch, Kilometer, Meter, Mile, and more ...>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Amount of current unit:** `kilometers`
* **Current unit:** `kilometer`
* **Target unit:** `meter`

| kilometers | **Output** |
| ----- | ----- |
| 1 | 1000.0 |

***

### Example 2: Null case

**Argument values:**

* **Amount of current unit:** `kilometers`
* **Current unit:** `kilometer`
* **Target unit:** `meter`

| kilometers | **Output** |
| ----- | ----- |
| *null* | *null* |

***
