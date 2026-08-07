<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayReverseV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array reverse

> Supported in: Batch, Faster, Streaming

Reverse the order of elements in 'array'.

**Expression categories:** Array

## Declared arguments

* **Expression:** Array to be reversed.<br>*Expression\<Array\<T>>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** \[ 1, 2, 3 ]

**Output:** \[ 3, 2, 1 ]

***

### Example 2: Null case

**Argument values:**

* **Expression:** `array`

| array | **Output** |
| ----- | ----- |
| *null* | *null* |
| \[ 1, *null* ] | \[ *null*, 1 ] |

***
