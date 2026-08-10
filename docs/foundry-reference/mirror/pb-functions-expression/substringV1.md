<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/substringV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Substring

> Supported in: Batch, Faster, Streaming

Extract substring.

**Expression categories:** Numeric

## Declared arguments

* **Expression:** Expression to extract substring from.<br>*Expression\<String>*
* **Start:** The index to start substring from (inclusive). Negative numbers start from end of string. This is 1-indexed.<br>*Expression\<Integer>*
* *optional* **Length:** The length of the substring to extract. If not provided the remainder of the string is extracted.<br>*Expression\<Integer>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `string`
* **Start:** `start`
* **Length:** `length`

| string | start | length | **Output** |
| ----- | ----- | ----- | ----- |
| hello, world | 1 | 5 | hello |
| hello, world | 8 | 5 | world |
| hello, world | -5 | 5 | world |

***

### Example 2: Base case

**Description:** When no length is provided, the substring runs to end of string.

**Argument values:**

* **Expression:** `string`
* **Start:** `start`
* **Length:** *null*

| string | start | **Output** |
| ----- | ----- | ----- |
| hello, world | 1 | hello, world |
| hello, world | 8 | world |
| hello, world | -5 | world |

***

### Example 3: Null case

**Description:** In case of nulls, the output is always null.

**Argument values:**

* **Expression:** `string`
* **Start:** `start`
* **Length:** `length`

| string | start | length | **Output** |
| ----- | ----- | ----- | ----- |
| *null* | 1 | 5 | *null* |
| hello, world | *null* | 5 | *null* |
| hello, world | 1 | *null* | *null* |
| *null* | *null* | *null* | *null* |

***

### Example 4: Edge case

**Description:** When length is longer than remaining sub string, the output is the sub string until the end of the string.

**Argument values:**

* **Expression:** `string`
* **Start:** `start`
* **Length:** `length`

| string | start | length | **Output** |
| ----- | ----- | ----- | ----- |
| hello, world | -5 | 10 | world |
| hello, world | 1 | 20 | hello, world |
| hello, world | 12 | 5 | d |
| hello, world | 13 | 5 | *empty string* |
| hello, world | 20 | 5 | *empty string* |
| hello, world | 12 | -5 | *empty string* |

***
