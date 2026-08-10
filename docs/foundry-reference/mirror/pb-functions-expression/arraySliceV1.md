<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arraySliceV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Slice array

> Supported in: Batch, Faster, Streaming

Returns the array sliced from the first position to the second position. First position must be 1 or higher. If second position is longer than the array, the entire rest of the array will be returned.

**Expression categories:** Array

## Declared arguments

* **Expression:** Array to slice.<br>*Expression\<Array\<T>>*
* **Slice begins:** Array index start at 1, or from the end if start is negative. If this value is zero, expression will throw an error.<br>*Expression\<Integer>*
* **Slice length:** The length of the slice. If the slice length goes beyond the end of the array, the entire rest of the array will be returned.<br>*Expression\<Integer>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `array`
* **Slice begins:** `sliceBegins`
* **Slice length:** `sliceLength`

| array | sliceBegins | sliceLength | **Output** |
| ----- | ----- | ----- | ----- |
| \[ hello, world, out, there ] | 1 | 2 | \[ hello, world ] |
| \[ hello, world, out, there ] | 2 | 2 | \[ world, out ] |
| \[ hello, world, out, there ] | 1 | 0 | \[  ] |
| \[ hello, world, out, there ] | 2 | 10 | \[ world, out, there ] |
| \[ hello, world, out, there ] | -1 | 2 | \[ there ] |

***

### Example 2: Null case

**Argument values:**

* **Expression:** `array`
* **Slice begins:** `sliceBegins`
* **Slice length:** `sliceLength`

| array | sliceBegins | sliceLength | **Output** |
| ----- | ----- | ----- | ----- |
| \[ hello, world, out, there ] | 0 | 1 | *null* |
| \[ hello, world, out, there ] | 0 | 0 | *null* |
| \[ hello, world, out, there ] | 1 | -1 | *null* |
| \[  ] | 1 | 2 | \[  ] |
| \[ *null*, *null* ] | 1 | 1 | \[ *null* ] |

***
