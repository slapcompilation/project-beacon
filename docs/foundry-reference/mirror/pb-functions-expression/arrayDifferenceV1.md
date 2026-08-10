<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayDifferenceV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array difference

> Supported in: Batch, Faster, Streaming

Returns all unique elements in the `left` array that are not in the `right` array.

**Expression categories:** Array

## Declared arguments

* **Left array:** *no description*<br>*Expression\<Array\<T>>*
* **Right array:** *no description*<br>*Expression\<Array\<T>>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Left array:** \[ 1, 2, 3 ]
* **Right array:** \[ 2, 3, 4 ]

**Output:** \[ 1 ]

***

### Example 2: Null case

**Argument values:**

* **Left array:** `first_array`
* **Right array:** `second_array`

| first\_array | second\_array | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | *null* | \[ 1, 2, 3 ] |
| *null* | \[ 1, 2, 3 ] | *null* |
| *null* | *null* | *null* |

***

### Example 3: Edge case

**Description:** Duplicates in the left array will be removed.

**Argument values:**

* **Left array:** \[ 1, 1, 2, 3 ]
* **Right array:** \[ 2, 3, 4 ]

**Output:** \[ 1 ]

***
