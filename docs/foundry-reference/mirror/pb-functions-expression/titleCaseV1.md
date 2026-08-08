<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/titleCaseV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Title case

> Supported in: Batch, Faster, Streaming

Converts the first character of each word to be uppercase and the rest lowercase.

**Expression categories:** String

## Declared arguments

* **Expression:** The string to convert to title case.<br>*Expression\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** hello world

**Output:** Hello World

***

### Example 2: Null case

**Argument values:**

* **Expression:** *null*

**Output:** *null*

***

### Example 3: Edge case

**Argument values:**

* **Expression:** hello-world

**Output:** Hello-world

***
