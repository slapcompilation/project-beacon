<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/extractMapKeysV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract map keys

> Supported in: Batch, Faster, Streaming

Return map keys as an array. Note the order of array elements is not deterministic.

**Expression categories:** Map

## Declared arguments

* **Map:** Map expression.<br>*Expression\<Map\<K, AnyType>>*

**Type variable bounds:** *K accepts AnyType*

**Output type:** *Array\<K>*

## Examples

### Example 1: Base case

**Argument values:**

* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> MT-111 -> 2,<br> XB-134 -> 1,<br>} | \[ XB-134, MT-111 ] |

***

### Example 2: Null case

**Argument values:**

* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| *null* | *null* |

***
