<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arraysZipV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Arrays zip

> Supported in: Batch, Faster, Streaming

Zips a list of given arrays into a merged array of structs in which the n-th struct contains all n-th values of input arrays.

**Expression categories:** Array

## Declared arguments

* **Expressions:** A list of arrays to zip.<br>*List\<Expression\<Array\<AnyType>>>*

**Output type:** *Array\<Struct>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expressions:** \[`first_array`, `second_array`]

| first\_array | second\_array | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | \[ 4, 5, 6 ] | \[ {<br> **first\_array**: 1,<br> **second\_array**: 4,<br>}, {<br> **first\_array**: 2,<... |

***

### Example 2: Null case

**Argument values:**

* **Expressions:** \[`first_array`, `second_array`]

| first\_array | second\_array | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | *null* | \[ {<br> **first\_array**: 1,<br> **second\_array**: *null*,<br>}, {<br> **first\_array**... |
| *null* | *null* | \[  ] |
| \[  ] | \[  ] | \[  ] |

***

### Example 3: Edge case

**Description:** Longest length array is used.

**Argument values:**

* **Expressions:** \[`first_array`, `second_array`]

| first\_array | second\_array | **Output** |
| ----- | ----- | ----- |
| \[ 1, 2, 3 ] | \[ 4, 5 ] | \[ {<br> **first\_array**: 1,<br> **second\_array**: 4,<br>}, {<br> **first\_array**: 2,<... |

***
