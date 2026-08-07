<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/mapFromArraysV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Create map from arrays

> Supported in: Batch, Faster, Streaming

Returns a map using key-value pairs from the zipped arrays. Null values are not allowed as keys and will cause a runtime error.

**Expression categories:** Array, Map

## Declared arguments

* **Array of keys:** Array used as keys for the output map.<br>*Expression\<Array\<K>>*
* **Array of values:** Array used as values for the output map.<br>*Expression\<Array\<V>>*

**Type variable bounds:** *K accepts AnyType\*\*V accepts AnyType*

**Output type:** *Map\<K, V>*

## Examples

### Example 1: Base case

**Argument values:**

* **Array of keys:** \[ 1, 2, 3 ]
* **Array of values:** \[ 4, 5, 6 ]

**Output:** {<br> 1 -> 4,<br> 2 -> 5,<br> 3 -> 6,<br>}

***

### Example 2: Base case

**Description:** Duplicates in the left array will be removed, keeping the last seen key-value pair.

**Argument values:**

* **Array of keys:** \[ 1, 1, 2, 3 ]
* **Array of values:** \[ 4, 5, 6, 7 ]

**Output:** {<br> 1 -> 5,<br> 2 -> 6,<br> 3 -> 7,<br>}

***

### Example 3: Null case

**Description:** If there are more values than keys, the output is null

**Argument values:**

* **Array of keys:** \[ 1, 2 ]
* **Array of values:** \[ 5, 6, 7, 9 ]

**Output:** *null*

***

### Example 4: Null case

**Description:** If there are more keys than values, the output is null

**Argument values:**

* **Array of keys:** \[ 1, 2, 3, 4 ]
* **Array of values:** \[ 5, 6, 7 ]

**Output:** *null*

***

### Example 5: Null case

**Argument values:**

* **Array of keys:** `first_array`
* **Array of values:** `second_array`

| first\_array | second\_array | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | *null* | *null* |
| *null* | \[ 1, 2, 3 ] | *null* |
| *null* | *null* | *null* |

***

### Example 6: Null case

**Description:** Should return null when any key is null

**Argument values:**

* **Array of keys:** \[ *null*, 2, 3 ]
* **Array of values:** \[ 4, 5, 6 ]

**Output:** *null*

***

### Example 7: Null case

**Description:** Should allow null as a value

**Argument values:**

* **Array of keys:** \[ 1, 2, 3 ]
* **Array of values:** \[ 4, *null*, 6 ]

**Output:** {<br> 1 -> 4,<br> 2 -> *null*,<br> 3 -> 6,<br>}

***

### Example 8: Edge case

**Description:** Allows arrays as keys

**Argument values:**

* **Array of keys:** \[ \[ 1, 2 ], \[ 3, 4 ] ]
* **Array of values:** \[ 5, 6 ]

**Output:** {<br> \[ 1, 2 ] -> 5,<br> \[ 3, 4 ] -> 6,<br>}

***

### Example 9: Edge case

**Description:** Allows arrays as values

**Argument values:**

* **Array of keys:** \[ 1, 2 ]
* **Array of values:** \[ \[ 3, 4 ], \[ 5, 6 ] ]

**Output:** {<br> 1 -> \[ 3, 4 ],<br> 2 -> \[ 5, 6 ],<br>}

***
