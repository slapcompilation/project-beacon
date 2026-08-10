<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/notAnyV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Not any

> Supported in: Batch, Streaming

Returns true only if all of the specified conditions are false. Nulls are considered false.

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
| true | true | false |
| true | false | false |
| false | true | false |
| false | false | true |

***

### Example 2: Null case

**Argument values:**

* **Conditions:** \[*null*, *null*]

**Output:** true

***

### Example 3: Null case

**Argument values:**

* **Conditions:** \[*null*, true]

**Output:** false

***
