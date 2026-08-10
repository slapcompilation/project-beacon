<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isValidMimeTypeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is valid MIME type

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid MIME type.

**Expression categories:** Boolean, Other

## Declared arguments

* **Expression:** String representing a MIME type.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `mimeType`

| mimeType | **Output** |
| ----- | ----- |
| application/pdf | true |
| not a MIME type | false |

***
