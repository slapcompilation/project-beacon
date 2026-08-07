<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/notV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Not

> Supported in: Batch, Faster, Streaming

Returns the negated boolean value of a boolean expression.

**Expression categories:** Boolean

## Declared arguments

* **Expression:** The boolean value to negate.<br>*Expression\<Boolean>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `boolean`

| boolean | **Output** |
| ----- | ----- |
| true | false |
| false | true |

***

### Example 2: Null case

**Argument values:**

* **Expression:** *null*

**Output:** *null*

***
