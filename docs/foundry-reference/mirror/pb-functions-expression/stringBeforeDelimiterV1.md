<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/stringBeforeDelimiterV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# String before delimiter

> Supported in: Batch, Faster, Streaming

Extract the string before the first delimiter. Return the full string if no matches are found.

**Expression categories:** String

## Declared arguments

* **Delimiter:** Regex expression of delimiter.<br>*Regex*
* **Expression:** *no description*<br>*Expression\<String>*
* **Ignore case:** *no description*<br>*Literal\<Boolean>*

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

**Output:** ...

***

### Example 3: Base case

**Argument values:**

* **Delimiter:** hello
* **Expression:** ... Hello world
* **Ignore case:** true

**Output:** ...

***

### Example 4: Null case

**Argument values:**

* **Delimiter:** Hello
* **Expression:** *null*
* **Ignore case:** false

**Output:** *null*

***
