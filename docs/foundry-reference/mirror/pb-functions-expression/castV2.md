<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/castV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Cast

> Supported in: Batch, Faster, Streaming

Cast expression to given type.

**Expression categories:** Cast, Popular

## Declared arguments

* **Expression:** Expression to cast.<br>*Expression\<AnyType>*
* **Type:** Type to cast to.<br>*Type\<C>*

**Type variable bounds:** *C accepts AnyType*

**Output type:** *C*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** Array\<String>

| a | **Output** |
| ----- | ----- |
| \[ 12.3, 20.1 ] | \[ 12.3, 20.1 ] |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| \[ {<br> **date**: 2020-01-01,<br> **foo**: false,<br> **time**: 2020-10-01T00:00:01Z,<br>} ] | \[{false, 2020-10-01 00:00:01, 2020-01-01}] |

***

### Example 3: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** Array\<Float>

| a | **Output** |
| ----- | ----- |
| \[ 12.3, 20.1 ] | \[ 12.3, 20.1 ] |

***

### Example 4: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| \[ true, false ] | \[true, false] |

***

### Example 5: Base case

**Description:** Casting string to long

**Argument values:**

* **Expression:** 1234
* **Type:** Long

**Output:** 1234

***

### Example 6: Base case

**Description:** Casting long to string

**Argument values:**

* **Expression:** 1234
* **Type:** String

**Output:** 1234

***

### Example 7: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| true | true |
| false | false |
| *null* | *null* |

***

### Example 8: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** Date

| a | **Output** |
| ----- | ----- |
| 2020-01-01 | 2020-01-01 |
| *null* | *null* |

***

### Example 9: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| {<br> 1 -> true,<br> 2 -> false,<br>} | {1 -> true, 2 -> false} |

***

### Example 10: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| \[ \[ true, false ], \[ true ] ] | \[\[true, false], \[true]] |

***

### Example 11: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| {<br> foo -> {<br> 1 -> true,<br> 2 -> false,<br>},<br>} | {foo -> {1 -> true, 2 -> false}} |

***

### Example 12: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| {<br> **a**: {<br> **bar**: false,<br> **foo**: 1,<br>},<br>} | {{1, false}} |

***

### Example 13: Base case

**Description:** Casting string to decimal

**Argument values:**

* **Expression:** 1234
* **Type:** Decimal(4, 0)

**Output:** 1234

***

### Example 14: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** Integer

| a | **Output** |
| ----- | ----- |
| 1 | 1 |
| 1.0 | *null* |
| *null* | *null* |

***

### Example 15: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** Long

| a | **Output** |
| ----- | ----- |
| 1 | 1 |
| 1.0 | *null* |
| *null* | *null* |

***

### Example 16: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| {<br> **bar**: *null*,<br> **foo**: 1,<br>} | {1, null} |

***

### Example 17: Base case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| {<br> **bar**: false,<br> **foo**: 1,<br>} | {1, false} |

***

### Example 18: Null case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| \[ true, *null* ] | \[true, null] |
| *null* | *null* |

***

### Example 19: Null case

**Argument values:**

* **Expression:** `a`
* **Type:** String

| a | **Output** |
| ----- | ----- |
| {<br> 1 -> *null*,<br> 2 -> false,<br>} | {1 -> null, 2 -> false} |

***

### Example 20: Null case

**Argument values:**

* **Expression:** `a`
* **Type:** Date

| a | **Output** |
| ----- | ----- |
| *null* | *null* |

***
