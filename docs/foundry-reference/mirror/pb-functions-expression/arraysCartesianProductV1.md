<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arraysCartesianProductV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Array cartesian product

> Supported in: Batch, Streaming

Compute the cartesian product of arrays.

**Expression categories:** Array

## Declared arguments

* **Expression:** Column to convert base.<br>*List\<Expression\<Array\<AnyType>>>*

**Output type:** *Array\<Struct>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** \[`first`, `second`]

| first | second | **Output** |
| ----- | ----- | ----- |
| \[ \[ {<br> **s1**: 1,<br>}, {<br> **s1**: 2,<br>} ], \[ {<br> **s1**: 3,<br>} ] ] | \[ \[ {<br> **s2**: 4,<br>}, {<br> **s2**: 5,<br>} ], \[ {<br> **s2**: 6,<br>} ] ] | \[ {<br> **first**: \[ {<br> **s1**: 1,<br>}, {<br> **s1**: 2,<br>} ],<br> \*\*secon... |

***

### Example 2: Base case

**Argument values:**

* **Expression:** \[`first`, `second`]

| first | second | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2 ] | \[ 3, 4 ] | \[ {<br> **first**: 1,<br> **second**: 3,<br>}, {<br> **first**: 1,<br> \**second*... |

***

### Example 3: Base case

**Argument values:**

* **Expression:** \[`first`, `second`, `third`]

| first | second | third | **Output** |
| ----- | ----- | ----- | ----- |
| \[ 1, 2 ] | \[ word, a ] | \[ {<br> **s1**: 1,<br>}, {<br> **s1**: 2,<br>} ] | \[ {<br> **first**: 1,<br> **second**: word,<br> **third**: {<br> **s1**: 1,<br>}... |

***

### Example 4: Null case

**Argument values:**

* **Expression:** \[`first`, `second`]

| first | second | **Output** |
| ----- | ----- | ----- |
| \[ 1, *null* ] | \[ *null*, 4 ] | \[ {<br> **first**: 1,<br> **second**: *null*,<br>}, {<br> **first**: 1,<br> \*\*se... |
| \[ 1, 2 ] | *null* | \[  ] |
| \[  ] | \[  ] | \[  ] |
| *null* | *null* | \[  ] |

***
