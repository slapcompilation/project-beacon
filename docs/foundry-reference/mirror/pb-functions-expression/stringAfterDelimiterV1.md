<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/stringAfterDelimiterV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# String after delimiter

> Supported in: Batch, Faster, Streaming

Extract the string after the first delimiter. Return full string if no matches are found.

**Expression categories:** String

## Declared arguments

* **Delimiter:** Regex expression of delimiter.<br>*Regex*
* **Expression:** Input to perform regex operation on.<br>*Expression\<String>*
* **Ignore case:** Should the regex ignore case.<br>*Literal\<Boolean>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Delimiter:** hello
* **Expression:** ... Hello world
* **Ignore case:** false

**Output:** ... Hello world

***

### Example 2: Base case

**Argument values:**

* **Delimiter:** Hello
* **Expression:** ... Hello world
* **Ignore case:** false

**Output:** world

***

### Example 3: Base case

**Argument values:**

* **Delimiter:** hello
* **Expression:** ... Hello world
* **Ignore case:** true

**Output:** world

***

### Example 4: Null case

**Argument values:**

* **Delimiter:** Hello
* **Expression:** *null*
* **Ignore case:** false

**Output:** *null*

***

### Example 5: Edge case

**Argument values:**

* **Delimiter:** Hello
* **Expression:** ... Hello Hello world
* **Ignore case:** false

**Output:** Hello world

***
