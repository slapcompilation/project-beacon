<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayPositionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array position

> Supported in: Batch, Faster, Streaming

Returns a position/index of the first occurrence of the 'value' in a given array. Returns `null` when value is not found or when any of the arguments are `null`.

**Expression categories:** Array

## Declared arguments

* **Array:** Array from which to return element's position.<br>*Expression\<Array\<T>>*
* **Value:** Value for which to find position in the array.<br>*Expression\<T>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Long*

## Examples

### Example 1: Base case

**Argument values:**

* **Array:** \[ 10, 11, 12 ]
* **Value:** 10

**Output:** 1

***

### Example 2: Null case

**Description:** Output null if element is not found.

**Argument values:**

* **Array:** \[ 1, 2, 4 ]
* **Value:** 10

**Output:** *null*

***

### Example 3: Null case

**Argument values:**

* **Array:** `array`
* **Value:** `value`

| array | value | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | *null* | *null* |
| \[  ] | *null* | *null* |
| *null* | 1 | *null* |
| *null* | *null* | *null* |

***
