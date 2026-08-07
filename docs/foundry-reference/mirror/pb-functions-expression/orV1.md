<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/orV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Or

> Supported in: Batch, Faster, Streaming

Returns true if any of the specified conditions are true. Nulls are considered false.

**Expression categories:** Boolean

## Declared arguments

* **Conditions:** List of conditions from which the output is calculated.<br>*List\<Expression\<Boolean>>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Conditions:** \[`left_boolean`, `right_boolean`]

| left\_boolean | right\_boolean | **Output** |
| ----- | ----- | ----- |
| true | true | true |
| true | false | true |
| false | true | true |
| false | false | false |

***

### Example 2: Null case

**Argument values:**

* **Conditions:** \[*null*, true]

**Output:** true

***
