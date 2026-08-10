<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayMinV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array minimum

> Supported in: Batch, Faster, Streaming

Returns the minimum value of an array column.

**Expression categories:** Array

## Declared arguments

* **Expression:** Array from which to return the minimum element.<br>*Expression\<Array\<T>>*

**Type variable bounds:** *T accepts ComparableType*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** \[ 1, 2, 3 ]

**Output:** 1

***

### Example 2: Base case

**Argument values:**

* **Expression:** \[ 10, 77, 140 ]

**Output:** 10

***

### Example 3: Base case

**Argument values:**

* **Expression:** \[ false, true ]

**Output:** false

***

### Example 4: Base case

**Argument values:**

* **Expression:** \[ 2024-11-25, 2024-07-23, 2024-05-10 ]

**Output:** 2024-05-10

***

### Example 5: Base case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| \[ foo, bar, baz, qux ] | bar |

***

### Example 6: Base case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| \[ 2025-01-03T00:00:00Z, 2025-04-01T00:00:00Z ] | 2025-01-03T00:00:00Z |

***

### Example 7: Null case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| \[ {<br> **field1**: foo,<br> **field2**: bar,<br>}, {<br> **field1**: baz,<br> **field2**: qux,<br>}, {<br> **field1**: foo,<br> **field2**: baz,<br>} ] | {<br> **field1**: baz,<br> **field2**: qux,<br>} |

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
