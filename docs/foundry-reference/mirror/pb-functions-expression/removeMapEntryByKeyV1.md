<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/removeMapEntryByKeyV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Remove map entry by key

> Supported in: Batch, Streaming

Removes a map entry by the given key.

**Expression categories:** Map

## Declared arguments

* **Key:** Key of the entry to remove.<br>*Expression\<K>*
* **Map:** Map expression.<br>*Expression\<Map\<K, V>>*

**Type variable bounds:** *K accepts AnyType\*\*V accepts AnyType*

**Output type:** *Map\<K, V>*

## Examples

### Example 1: Base case

**Argument values:**

* **Key:** k
* **Map:** `map_col`

| map\_col | **Output** |
| ----- | ----- |
| {<br> a -> 1,<br> k -> 2,<br>} | {<br> a -> 1,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Key:** j
* **Map:** `map_col`

| map\_col | **Output** |
| ----- | ----- |
| {<br> a -> 1,<br> k -> 2,<br>} | {<br> a -> 1,<br> k -> 2,<br>} |

***

### Example 3: Null case

**Argument values:**

* **Key:** k
* **Map:** `map_col`

| map\_col | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 4: Null case

**Argument values:**

* **Key:** *null*
* **Map:** `map_col`

| map\_col | **Output** |
| ----- | ----- |
| {<br> a -> foo,<br>} | {<br> a -> foo,<br>} |

***
