<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arrayUnionV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array union

> Supported in: Batch, Faster, Streaming

Removes duplicates and unions a list of arrays.

**Expression categories:** Array

## Declared arguments

* **Expressions:** A list of arrays to union.<br>*List\<Expression\<Array\<T>>>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expressions:** \[\[ 1, 2, 3 ], \[ 3, 4 ]]

**Output:** \[ 1, 2, 3, 4 ]

***

### Example 2: Base case

**Argument values:**

* **Expressions:** \[\[ 1, 2, 3 ], \[ 3, 4 ], \[ 4, 5 ]]

**Output:** \[ 1, 2, 3, 4, 5 ]

***

### Example 3: Base case

**Description:** Duplicates are removed.

**Argument values:**

* **Expressions:** \[\[ 1, 1 ], \[ 1 ]]

**Output:** \[ 1 ]

***

### Example 4: Null case

**Argument values:**

* **Expressions:** \[`first_array`, `second_array`]

| first\_array | second\_array | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | *null* | \[ 1, 2, 3 ] |
| *null* | *null* | \[  ] |

***
