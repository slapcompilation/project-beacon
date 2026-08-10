<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayRepeatV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array repeat

> Supported in: Batch, Faster, Streaming

Returns an array with the contents of `array` concatenated `value` times.

**Expression categories:** Array

## Declared arguments

* **Array:** Array to be repeated.<br>*Expression\<Array\<T>>*
* **Value:** Number of times to concatenate 'array'.<br>*Expression\<Integer>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Array:** \[ 1, 2 ]
* **Value:** 2

**Output:** \[ 1, 2, 1, 2 ]

***

### Example 2: Null case

**Argument values:**

* **Array:** `array`
* **Value:** `value`

| array | value | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | *null* | *null* |
| *null* | 1 | *null* |
| *null* | *null* | *null* |

***
