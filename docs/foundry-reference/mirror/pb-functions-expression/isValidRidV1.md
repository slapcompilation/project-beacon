<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isValidRidV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is valid rid

> Supported in: Batch, Faster, Streaming

Returns true if the input is a valid Foundry resource identifier.

**Expression categories:** Boolean

## Declared arguments

* **Expression:** String representing a resource identifier.<br>*Expression\<String>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `rid`

| rid | **Output** |
| ----- | ----- |
| ri.foundry.main.dataset.e9008fee-a32a-449d-8ab4-d6d65a3b4ecc | true |
| ri.foundry.main.transaction.00000049-8fbb-6a15-bd27-9f2c9ae9a47b | true |
| ri.foundry.malformed | false |
| not a rid | false |

***
