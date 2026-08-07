<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayElementV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array element

> Supported in: Batch, Faster, Streaming

Returns the element at a given position from the input array. Positions outside of the array will return `null`.

**Expression categories:** Array

## Declared arguments

* **Array:** Array from which to extract element.<br>*Expression\<Array\<T>>*
* **Position:** Position of element to extract from array. First element is at position 1. If position is negative, accesses elements from last to first (example: -1 will return last element).<br>*Expression\<Integer>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Array:** \[ 10, 11, 12 ]
* **Position:** 1

**Output:** 10

***

### Example 2: Null case

**Description:** Output null if position greater than array length.

**Argument values:**

* **Array:** \[ 1, 2, 4 ]
* **Position:** 10

**Output:** *null*

***

### Example 3: Null case

**Description:** Index array from the end using negative index.

**Argument values:**

* **Array:** \[ 1, 2, 4 ]
* **Position:** -1

**Output:** 4

***

### Example 4: Null case

**Argument values:**

* **Array:** `array`
* **Position:** `position`

| array | position | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | *null* | *null* |
| *null* | 1 | *null* |
| *null* | *null* | *null* |

***

### Example 5: Edge case

**Argument values:**

* **Array:** `array`
* **Position:** `position`

| array | position | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | 0 | *null* |

***
