<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/base64EncodeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Base64 encode

> Supported in: Batch, Faster, Streaming

Base64 encode the given expression.

**Expression categories:** Binary, Cast

## Declared arguments

* **Expression:** String or binary expression to encode.<br>*Expression\<Binary | String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `city`

| city | **Output** |
| ----- | ----- |
| TG9uZG9u | TG9uZG9u |
| Q29wZW5oYWdlbg== | Q29wZW5oYWdlbg== |
| TmV3IFlvcms= | TmV3IFlvcms= |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `city`

| city | **Output** |
| ----- | ----- |
| London | TG9uZG9u |
| Copenhagen | Q29wZW5oYWdlbg== |
| New York | TmV3IFlvcms= |

***

### Example 3: Null case

**Argument values:**

* **Expression:** `city`

| city | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 4: Null case

**Argument values:**

* **Expression:** `city`

| city | **Output** |
| ----- | ----- |
| *null* | *null* |

***
