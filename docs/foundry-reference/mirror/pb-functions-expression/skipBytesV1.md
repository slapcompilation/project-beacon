<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/skipBytesV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Skip bytes

> Supported in: Batch, Faster, Streaming

Skip a given number of bytes in a binary column.

**Expression categories:** Binary

## Declared arguments

* **Bytes:** *no description*<br>*Expression\<Binary>*
* **Number of bytes to skip:** *no description*<br>*Expression\<Integer>*

**Output type:** *Binary*

## Examples

### Example 1: Base case

**Argument values:**

* **Bytes:** aGk=
* **Number of bytes to skip:** 1

**Output:** aQ==

***

### Example 2: Null case

**Argument values:**

* **Bytes:** *null*
* **Number of bytes to skip:** 1

**Output:** *null*

***

### Example 3: Null case

**Argument values:**

* **Bytes:** aGk=
* **Number of bytes to skip:** *null*

**Output:** *null*

***

### Example 4: Edge case

**Argument values:**

* **Bytes:** aGk=
* **Number of bytes to skip:** 100

**Output:** *null*

***
