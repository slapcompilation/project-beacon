<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/endsWithV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Ends with

> Supported in: Batch, Faster, Streaming

**Expression categories:** Boolean, String

## Declared arguments

* **Expression:** Expression to compare.<br>*Expression\<String>*
* **Ignore case:** Boolean to decide if comparison should be case-sensitive or not.<br>*Literal\<Boolean>*
* **Value:** Value to compare against.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** Hello World
* **Ignore case:** false
* **Value:** world

**Output:** false

***

### Example 2: Base case

**Argument values:**

* **Expression:** Hello World
* **Ignore case:** false
* **Value:** World

**Output:** true

***

### Example 3: Base case

**Argument values:**

* **Expression:** Hello World
* **Ignore case:** true
* **Value:** world

**Output:** true

***

### Example 4: Null case

**Argument values:**

* **Expression:** *null*
* **Ignore case:** false
* **Value:** *null*

**Output:** false

***

### Example 5: Null case

**Argument values:**

* **Expression:** *null*
* **Ignore case:** false
* **Value:** World

**Output:** false

***

### Example 6: Null case

**Argument values:**

* **Expression:** Hello World
* **Ignore case:** false
* **Value:** *null*

**Output:** false

***
