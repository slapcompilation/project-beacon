<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayMaxV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array maximum

> Supported in: Batch, Faster, Streaming

Returns the maximum value of an array column.

**Expression categories:** Array

## Declared arguments

* **Expression:** Array from which to return the maximum element.<br>*Expression\<Array\<T>>*

**Type variable bounds:** *T accepts ComparableType*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** \[ 1, 2, 3 ]

**Output:** 3

***

### Example 2: Base case

**Argument values:**

* **Expression:** \[ 10, 77, 140 ]

**Output:** 140

***

### Example 3: Base case

**Argument values:**

* **Expression:** \[ false, true ]

**Output:** true

***

### Example 4: Base case

**Argument values:**

* **Expression:** \[ 2024-11-25, 2024-07-23, 2024-05-10 ]

**Output:** 2024-11-25

***

### Example 5: Base case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| \[ foo, bar, baz, qux ] | qux |

***

### Example 6: Null case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| \[ {<br> **field1**: foo,<br> **field2**: bar,<br>}, {<br> **field1**: baz,<br> **field2**: qux,<br>}, {<br> **field1**: foo,<br> **field2**: baz,<br>} ] | {<br> **field1**: foo,<br> **field2**: baz,<br>} |

***

### Example 7: Null case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| \[ 2025-01-03T00:00:00Z, 2025-04-01T00:00:00Z ] | 2025-04-01T00:00:00Z |

***

### Example 8: Null case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| \[  ] | *null* |

***

### Example 9: Null case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| *null* | *null* |
| \[ 1, *null* ] | 1 |

***
