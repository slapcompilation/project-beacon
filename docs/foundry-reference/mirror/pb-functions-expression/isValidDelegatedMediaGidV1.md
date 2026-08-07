<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isValidDelegatedMediaGidV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is valid delegated media gid

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid gotham delegated media gid. Check gotham's delegated media rtfm for more details.

**Expression categories:** Boolean

## Declared arguments

* **Expression:** String to check is a valid gotham delegated media.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** hello

**Output:** false

***

### Example 2: Base case

**Argument values:**

* **Expression:** ri.gotham-delegated-media.12345678-1234-1234-1234-123456789012.testaudiotype.testlocator

**Output:** true

***

### Example 3: Null case

**Argument values:**

* **Expression:** *null*

**Output:** *null*

***
