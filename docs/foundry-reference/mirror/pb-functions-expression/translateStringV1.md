<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/translateStringV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Character-wise translate string

> Supported in: Batch, Faster, Streaming

Replaces individual characters from the input column that are found in the matching with the corresponding character in the replacement string. If the matching string is longer than the replacement string, characters at the end of the matching string will be dropped.

**Expression categories:** String

## Declared arguments

* **Expression:** Expression to translate.<br>*Expression\<AnyType>*
* **Matching string:** String containing characters that match the input string.<br>*Literal\<String>*
* **Replacement string:** String containing characters to replace matching characters.<br>*Literal\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** translate
* **Matching string:** rnlt
* **Replacement string:** 123

**Output:** 1a2s3ae

***

### Example 2: Base case

**Argument values:**

* **Expression:** abc
* **Matching string:** aab
* **Replacement string:** de

**Output:** dc

***

### Example 3: Base case

**Argument values:**

* **Expression:** abc
* **Matching string:** acb
* **Replacement string:** de

**Output:** de

***

### Example 4: Base case

**Argument values:**

* **Expression:** abc
* **Matching string:** ac
* **Replacement string:** df

**Output:** dbf

***

### Example 5: Null case

**Argument values:**

* **Expression:** *null*
* **Matching string:** a
* **Replacement string:** b

**Output:** *null*

***
