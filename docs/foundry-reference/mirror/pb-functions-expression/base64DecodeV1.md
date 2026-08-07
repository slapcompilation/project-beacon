<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/base64DecodeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Base64 decode

> Supported in: Batch, Faster, Streaming

Base64 decode the given expression.

**Expression categories:** Binary, Cast

## Declared arguments

* **Expression:** Expression to base64 decode.<br>*Expression\<String>*

**Output type:** *Binary*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `city_base64`

| city\_base64 | **Output** |
| ----- | ----- |
| TG9uZG9u | TG9uZG9u |
| Q29wZW5oYWdlbg== | Q29wZW5oYWdlbg== |
| TmV3IFlvcms= | TmV3IFlvcms= |

***
