<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/sentenceCaseV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Sentence case

> Supported in: Batch, Faster, Streaming

Converts the first character of the first word to be uppercase.

**Expression categories:** String

## Declared arguments

* **Expression:** String expression to apply sentence case to.<br>*Expression\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** hello world

**Output:** Hello world

***

### Example 2: Base case

**Argument values:**

* **Expression:** this is a test. another test? yes, another test!

**Output:** This is a test. Another test? Yes, another test!

***

### Example 3: Base case

**Argument values:**

* **Expression:** *empty string*

**Output:** *empty string*

***

### Example 4: Base case

**Argument values:**

* **Expression:** hello world! how are you? have a nice day.

**Output:** Hello world! How are you? Have a nice day.

***

### Example 5: Base case

**Argument values:**

* **Expression:** hELLO WORLD

**Output:** HELLO WORLD

***

### Example 6: Base case

**Argument values:**

* **Expression:** how many people? 100 people!

**Output:** How many people? 100 people!

***

### Example 7: Base case

**Argument values:**

* **Expression:** no punctuation

**Output:** No punctuation

***

### Example 8: Null case

**Argument values:**

* **Expression:** *null*

**Output:** *null*

***
