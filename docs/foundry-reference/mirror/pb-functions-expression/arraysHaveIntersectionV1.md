<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arraysHaveIntersectionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Arrays have intersection

> Supported in: Batch, Faster, Streaming

Checks if given arrays have at least one shared element.

**Expression categories:** Array, Boolean

## Declared arguments

* **Expressions:** List of arrays to check.<br>*List\<Expression\<Array\<T>>>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expressions:** \[\[ 1, 2, 3 ], \[ 3, 4 ]]

**Output:** true

***

### Example 2: Base case

**Argument values:**

* **Expressions:** \[\[ 1, 2 ], \[ 3, 4 ]]

**Output:** false

***

### Example 3: Base case

**Argument values:**

* **Expressions:** \[\[ 1, 2, 3 ], \[ 3, 4 ], \[ 2, 3 ]]

**Output:** true

***

### Example 4: Null case

**Argument values:**

* **Expressions:** \[`first_array`, `second_array`]

| first\_array | second\_array | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | *null* | false |
| *null* | *null* | false |

***
