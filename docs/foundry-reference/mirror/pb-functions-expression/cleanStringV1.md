<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/cleanStringV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Clean string

> Supported in: Batch, Faster, Streaming

Applies the set of clean actions on the expression.

**Expression categories:** Data preparation, String

## Declared arguments

* **Clean actions:** Set of actions to be applied.<br>*Set\<Enum\<Normalize whitespace, Nullify empty, Trim>>*
* **Expression:** String to be cleaned.<br>*Expression\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Clean actions:** {`normalize`}
* **Expression:** hello     world

**Output:** hello world

***

### Example 2: Base case

**Argument values:**

* **Clean actions:** {`nullify_empty`}
* **Expression:** *empty string*

**Output:** *null*

***

### Example 3: Base case

**Argument values:**

* **Clean actions:** {`trim`}
* **Expression:**   hello world

**Output:** hello world

***

### Example 4: Null case

**Argument values:**

* **Clean actions:** {`trim`}
* **Expression:** *null*

**Output:** *null*

***
