<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/base64DecodeToStringV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Base 64 decode to string

> Supported in: Batch, Faster, Streaming

Base64 decode the given expression. Uses utf-8 encoding for binary.

**Expression categories:** Binary, Cast, String

## Declared arguments

* **Expression:** String or binary expression to decode from base64.<br>*Expression\<Binary | String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `encoded`

| encoded | **Output** |
| ----- | ----- |
| Wm05dg== | foo |
| WW1GeQ== | bar |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `encoded`

| encoded | **Output** |
| ----- | ----- |
| Zm9v | foo |
| YmFy | bar |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `encoded`

| encoded | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 4: Null case

**Argument values:**

* **Expression:** `encoded`

| encoded | **Output** |
| ----- | ----- |
| *null* | *null* |

***
