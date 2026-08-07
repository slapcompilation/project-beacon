<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayContainsNullV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array contains null

> Supported in: Batch, Faster, Streaming

Returns true if the `array` contains null.

**Expression categories:** Array, Boolean

## Declared arguments

* **Expression:** An array that could contain null values.<br>*Expression\<Array\<ComparableType>>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `part_ids`

| part\_ids | **Output** |
| ----- | ----- |
| \[ AWE-112, BRR-123, *null* ] | true |
| \[ AWE-222, ABC-543 ] | false |

***

### Example 2: Null case

**Argument values:**

* **Expression:** `part_ids`

| part\_ids | **Output** |
| ----- | ----- |
| *null* | false |
| \[ AWE-222, ABC-543 ] | false |

***

### Example 3: Edge case

**Argument values:**

* **Expression:** `part_ids`

| part\_ids | **Output** |
| ----- | ----- |
| \[  ] | false |

***
