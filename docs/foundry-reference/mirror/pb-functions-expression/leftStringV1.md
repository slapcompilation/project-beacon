<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/leftStringV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Left of string

> Supported in: Batch, Faster, Streaming

Extract left hand side of a string based on index.

**Expression categories:** String

## Declared arguments

* **Expression:** String input expression.<br>*Expression\<String>*
* **Length:** The number of characters to take from the left of the string.<br>*Expression\<Integer>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** Hello world!
* **Length:** 5

**Output:** Hello

***

### Example 2: Null case

**Argument values:**

* **Expression:** `string`
* **Length:** `length`

| string | length | **Output** |
| ----- | ----- | ----- |
| Hello world! | -10 | *empty string* |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `string`
* **Length:** `length`

| string | length | **Output** |
| ----- | ----- | ----- |
| *null* | 1 | *null* |
| Hello world! | *null* | *null* |
| *null* | *null* | *null* |

***

### Example 4: Edge case

**Description:** Length greater than the string length will return the full string.

**Argument values:**

* **Expression:** Hello world!
* **Length:** 15

**Output:** Hello world!

***
