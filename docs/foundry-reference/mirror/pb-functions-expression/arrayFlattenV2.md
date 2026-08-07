<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayFlattenV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array flatten

> Supported in: Batch, Faster, Streaming

Creates a single array from an input nested array by unioning the elements within the first level of nesting.

**Expression categories:** Array

## Declared arguments

* **Expression:** Nested array to flatten.<br>*Expression\<Array\<Array\<T>>>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| \[ \[ 1, 2, 3 ], \[ 4, 5, 6 ] ] | \[ 1, 2, 3, 4, 5, 6 ] |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| \[ \[ \[ 1 ], \[ 2 ] ], \[ \[ 3 ], \[ 4 ] ] ] | \[ \[ 1 ], \[ 2 ], \[ 3 ], \[ 4 ] ] |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| *null* | *null* |
| \[ *null*, \[ 1, 2 ] ] | \[ 1, 2 ] |

***
