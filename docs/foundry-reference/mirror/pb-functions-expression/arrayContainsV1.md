<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayContainsV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array contains

> Supported in: Batch, Faster, Streaming

Returns true if the array contains the value.

**Expression categories:** Array, Boolean

## Declared arguments

* **Array:** The array to search within.<br>*Expression\<Array\<ComparableType>>*
* **Value:** The value to search for within the array.<br>*Expression\<ComparableType>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Array:** `part_ids`
* **Value:** BRR-123

| part\_ids | **Output** |
| ----- | ----- |
| \[ AWE-112, BRR-123 ] | true |
| \[ AWE-222, ABC-543 ] | false |

***

### Example 2: Base case

**Description:** Comparisons between different numeric types is allowed.

**Argument values:**

* **Array:** `ids`
* **Value:** 1

| ids | **Output** |
| ----- | ----- |
| \[ 1, 2 ] | true |
| \[ 2, 3 ] | false |

***

### Example 3: Null case

**Argument values:**

* **Array:** `array`
* **Value:** `value`

| array | value | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | *null* | false |
| *null* | 1 | false |
| *null* | *null* | false |
| \[ 1, 2, 3, *null* ] | *null* | true |

***

### Example 4: Edge case

**Description:** Float types should be cast to integers when checking for equality.

**Argument values:**

* **Array:** `ids`
* **Value:** 1.0

| ids | **Output** |
| ----- | ----- |
| \[ 1, 2 ] | true |

***

### Example 5: Edge case

**Description:** Float types should not be rounded when checking for equality.

**Argument values:**

* **Array:** `ids`
* **Value:** 1.2

| ids | **Output** |
| ----- | ----- |
| \[ 1, 2 ] | false |

***
