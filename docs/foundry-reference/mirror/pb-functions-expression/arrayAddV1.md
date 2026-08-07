<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayAddV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array add

> Supported in: Batch, Faster, Streaming

Adds a value to the array at a specified index.

**Expression categories:** Array

## Declared arguments

* **Array:** The array to add an element to.<br>*Expression\<Array\<T>>*
* **Index:** Position where the new element should be inserted into the array. First element is at position 1.<br>*Expression\<Integer>*
* **Value:** The element to add to the array.<br>*Expression\<T>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Array:** `numbers`
* **Index:** 1
* **Value:** 1

| numbers | **Output** |
| ----- | ----- |
| \[ 3, 5 ] | \[ 1, 3, 5 ] |
| \[ 2 ] | \[ 1, 2 ] |
| \[  ] | \[ 1 ] |

***

### Example 2: Null case

**Argument values:**

* **Array:** `numbers`
* **Index:** `index`
* **Value:** `value`

| numbers | value | index | **Output** |
| ----- | ----- | ----- | ----- |
| *null* | 1 | 1 | *null* |
| \[ 1 ] | *null* | 1 | \[ *null*, 1 ] |
| \[ 1 ] | 1 | *null* | \[ 1 ] |

***

### Example 3: Edge case

**Description:** Index values greater than the list length append to the array.

**Argument values:**

* **Array:** `numbers`
* **Index:** `index`
* **Value:** `value`

| numbers | value | index | **Output** |
| ----- | ----- | ----- | ----- |
| \[ 1, 2 ] | 3 | 3 | \[ 1, 2, 3 ] |
| \[ 1 ] | 2 | 3 | \[ 1, *null*, 2 ] |
| \[  ] | 1 | 3 | \[ *null*, *null*, 1 ] |
| \[ 3, 5 ] | 1 | 10 | \[ 3, 5, *null*, *null*, *null*, *null*, *null*, *null*, *null*, 1 ] |

***

### Example 4: Edge case

**Description:** Negative values for the index count back from the end of the array.

**Argument values:**

* **Array:** `numbers`
* **Index:** `index`
* **Value:** `value`

| numbers | value | index | **Output** |
| ----- | ----- | ----- | ----- |
| \[ 1, 3 ] | 2 | -1 | \[ 1, 2, 3 ] |
| \[ 2, 3 ] | 1 | -2 | \[ 1, 2, 3 ] |
| \[ 2, 3 ] | 1 | -3 | \[ 1, *null*, 2, 3 ] |
| \[ 2 ] | 1 | -1 | \[ 1, 2 ] |
| \[ 2 ] | 1 | -2 | \[ 1, *null*, 2 ] |
| \[ 2 ] | 1 | -3 | \[ 1, *null*, *null*, 2 ] |
| \[  ] | 1 | -1 | \[ 1, *null* ] |
| \[  ] | 1 | -2 | \[ 1, *null*, *null* ] |
| \[  ] | 1 | -3 | \[ 1, *null*, *null*, *null* ] |

***
