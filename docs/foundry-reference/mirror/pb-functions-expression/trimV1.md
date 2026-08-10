<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/trimV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Trim whitespace

> Supported in: Batch, Faster, Streaming

Trims whitespace at beginning and end of string. Whitespace is defined as characters in any of: 1) Unicode's \p{whitespace} set, 2) Java's String#trim() method, or 3) Java's Character#isWhitespace() method.

**Expression categories:** Data preparation, String

## Declared arguments

* **Expression:** Input string to trim whitespace from.<br>*Expression\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:**    hello world

**Output:** hello world

***

### Example 2: Null case

**Argument values:**

* **Expression:** *null*

**Output:** *null*

***
