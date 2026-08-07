<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/extractMapValuesV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract map values

> Supported in: Batch, Faster, Streaming

Return map values as an array. Note the order of array elements is not deterministic.

**Expression categories:** Map

## Declared arguments

* **Map:** Map expression.<br>*Expression\<Map\<AnyType, V>>*

**Type variable bounds:** *V accepts AnyType*

**Output type:** *Array\<V>*

## Examples

### Example 1: Base case

**Argument values:**

* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> MT-111 -> 2,<br> XB-134 -> 1,<br>} | \[ 1, 2 ] |

***

### Example 2: Null case

**Argument values:**

* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> MT-111 -> 2,<br> XB-134 -> *null*,<br>} | \[ *null*, 2 ] |
| *null* | *null* |

***
