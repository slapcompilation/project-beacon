<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/lengthV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Length

> Supported in: Batch, Faster, Streaming

Returns the length of each value in a string column or an array column.

**Expression categories:** Array, Numeric

## Declared arguments

* **Expression:** The expression to compute the length of.<br>*Expression\<Array\<AnyType> | Binary | Map\<AnyType, AnyType> | String>*

**Output type:** *Integer*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `string`

| string | **Output** |
| ----- | ----- |
| hello | 5 |
| bye | 3 |

***
