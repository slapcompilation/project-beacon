<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/gzipDecompressV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Gzip decompress

> Supported in: Batch, Faster, Streaming

Decompresses gzip-compressed binary into a string.

**Expression categories:** File

## Declared arguments

* **Expression:** *no description*<br>*Expression\<Binary>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `gzip`

| gzip | **Output** |
| ----- | ----- |
| H4sIAAAAAAAA//NIzcnJ11Eozy/KSVEEAObG5usNAAAA | Hello, world! |

***
