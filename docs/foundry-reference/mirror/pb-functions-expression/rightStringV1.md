<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/rightStringV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Right of string

> Supported in: Batch, Faster, Streaming

Extract right hand side of a string based on index.

**Expression categories:** String

## Declared arguments

* **Expression:** *no description*<br>*Expression\<String>*
* **Length:** The number of characters to take from the right of the string.<br>*Expression\<Integer>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** Hello world!
* **Length:** 6

**Output:** world!

***

### Example 2: Null case

**Argument values:**

* **Expression:** `String`
* **Length:** `Length`

| String | Length | **Output** |
| ----- | ----- | ----- |
| *null* | 1 | *null* |
| Hello world! | *null* | *null* |
| *null* | *null* | *null* |

***

### Example 3: Edge case

**Description:** Length greater than the string length will return the full string.

**Argument values:**

* **Expression:** Hello world!
* **Length:** 15

**Output:** Hello world!

***
