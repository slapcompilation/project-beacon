<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/convertTimeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert between time units

> Supported in: Batch, Faster, Streaming

**Expression categories:** Datetime

## Declared arguments

* **Amount of current unit:** *no description*<br>*Expression\<DefiniteNumeric>*
* **Current unit:** The unit prior to conversion.<br>*Enum\<Days, Hours, Milliseconds, Minutes, Seconds, Weeks>*
* **Target unit:** The desired unit after conversion.<br>*Enum\<Days, Hours, Milliseconds, Minutes, Seconds, Weeks>*

**Output type:** *Double*

## Examples

### Example 1: Base case

**Argument values:**

* **Amount of current unit:** `days`
* **Current unit:** `days`
* **Target unit:** `minutes`

| days | **Output** |
| ----- | ----- |
| 12 | 17280.0 |

***

### Example 2: Null case

**Argument values:**

* **Amount of current unit:** `days`
* **Current unit:** `days`
* **Target unit:** `minutes`

| days | **Output** |
| ----- | ----- |
| *null* | *null* |

***
