<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isValidGeohashV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is valid Geohash

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid Geohash input string.

**Expression categories:** Geospatial

## Declared arguments

* **Expression:** Geohash to check.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `geohash`

| geohash | **Output** |
| ----- | ----- |
| sk4d | true |
| dt9zy9cg36j7 | true |
| not a Geohash string | false |
| *null* | false |

***
