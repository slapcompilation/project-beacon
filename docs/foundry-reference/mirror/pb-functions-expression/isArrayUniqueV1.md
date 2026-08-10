<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isArrayUniqueV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array elements are distinct

> Supported in: Batch, Faster, Streaming

Returns true if the array's elements are distinct, false otherwise. If the array is null, the returned value is false.

**Expression categories:** Array, Boolean

## Declared arguments

* **Expression:** An array that could contain duplicate elements.<br>*Expression\<Array\<ComparableType>>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `part_ids`

| part\_ids | **Output** |
| ----- | ----- |
| \[ ABC-123, DCE-123, EFG-123 ] | true |
| \[ ABC-123, ABC-123, EFG-123 ] | false |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `part_ids`

| part\_ids | **Output** |
| ----- | ----- |
| \[  ] | true |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `part_ids`

| part\_ids | **Output** |
| ----- | ----- |
| \[ ABC-123, *null* ] | true |
| \[ ABC-123, *null*, ABC-123 ] | false |
| \[ *null*, *null* ] | false |

***

### Example 4: Null case

**Argument values:**

* **Expression:** `part_ids`

| part\_ids | **Output** |
| ----- | ----- |
| *null* | false |
| \[ ABC-123, EFG-123 ] | true |

***

### Example 5: Edge case

**Argument values:**

* **Expression:** `part_ids`

| part\_ids | **Output** |
| ----- | ----- |
| \[ \[ ABC-123, EFG-123 ], \[ ABC-123, EFG-123 ] ] | false |
| \[ \[ ABC-123, EFG-123 ], \[ ABC-123, XYZ-123 ] ] | true |
| \[ \[ ABC-123, EFG-123 ], \[ EFG-123, ABC-123 ] ] | true |

***

### Example 6: Edge case

**Argument values:**

* **Expression:** `address`

| address | **Output** |
| ----- | ----- |
| \[ {<br> **city**: New York,<br> **street**: Broadway,<br>}, {<br> **city**: New York,<br> **street**: Broadway,<br>} ] | false |
| \[ {<br> **city**: New York,<br> **street**: Broadway,<br>}, {<br> **city**: Los Angeles,<br> **street**: Hoover Street,<br>} ] | true |

***
