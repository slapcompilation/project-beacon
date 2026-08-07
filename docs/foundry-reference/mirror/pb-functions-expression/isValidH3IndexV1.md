<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isValidH3IndexV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is valid H3 index

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid H3 index string.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** *no description*<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `h3`

| h3 | **Output** |
| ----- | ----- |
| 862a1072fffffff | true |
| not an h3 value | false |

***
