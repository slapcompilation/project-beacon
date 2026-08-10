<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayRemoveV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array remove

> Supported in: Batch, Faster, Streaming

Returns an array after removing all provided 'value' from the given array.

**Expression categories:** Array

## Declared arguments

* **Array:** Array from which to remove provided 'value'.<br>*Expression\<Array\<T>>*
* **Value:** Value to be removed from array.<br>*Expression\<T>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Array:** \[ 1, 2, 3 ]
* **Value:** 1

**Output:** \[ 2, 3 ]

***

### Example 2: Base case

**Description:** Remove all instances of the value.

**Argument values:**

* **Array:** \[ 1, 2, 2 ]
* **Value:** 2

**Output:** \[ 1 ]

***

### Example 3: Base case

**Description:** Return the whole array if the value is not found.

**Argument values:**

* **Array:** \[ 1, 2, 3 ]
* **Value:** 10

**Output:** \[ 1, 2, 3 ]

***

### Example 4: Null case

**Argument values:**

* **Array:** `array`
* **Value:** `value`

| array | value | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, *null*, 3 ] | *null* | \[ 1, 2, 3 ] |
| \[ 1, 2, 3 ] | *null* | \[ 1, 2, 3 ] |
| *null* | 1 | *null* |
| *null* | *null* | *null* |

***
