<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/explodeMapV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Explode map

> Supported in: Batch, Streaming

Explode map into a row per key, value pair.

**Expression categories:** Map

## Declared arguments

* **Expression:** The map to explode.<br>*Expression\<Map\<TKey, TValue>>*

**Type variable bounds:** *TKey accepts AnyType\*\*TValue accepts AnyType*

**Output type:** *Struct\<Optional\[key]:TKey, Optional\[value]:TValue>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `map`

**Given input table:**

| map |
| ----- |
| {<br> 1 -> val1,<br> 2 -> val2,<br>} |
| {<br> 3 -> val3,<br> 4 -> val4,<br>} |

**Expected output table:** | map |
| ----- |
| {<br> key -> 1,<br> value -> val1,<br>} |
| {<br> key -> 2,<br> value -> val2,<br>} |
| {<br> key -> 3,<br> value -> val3,<br>} |
| {<br> key -> 4,<br> value -> val4,<br>} |

***

### Example 2: Edge case

**Argument values:**

* **Expression:** `map`

**Given input table:**

| map |
| ----- |
| {<br> k1 -> q1,<br>} |
| {<br><br>} |

**Expected output table:** | map |
| ----- |
| {<br> key -> k1,<br> value -> q1,<br>} |

***

### Example 3: Edge case

**Argument values:**

* **Expression:** `map`

**Given input table:**

| map |
| ----- |
| *null* |

**Expected output table:** | map |
| ----- |

***
