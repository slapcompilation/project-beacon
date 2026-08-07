<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/concatStringsV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Concatenate strings

> Supported in: Batch, Faster, Streaming

Concatenates a list of strings with the specified separator.

**Expression categories:** String

## Declared arguments

* **Expressions:** List of strings to be concatenated.<br>*List\<Expression\<String>>*
* *optional* **Null output if any input is null:** If any of the input values are null, then the output should be null. If false, null values in the input are ignored.<br>*Literal\<Boolean>*
* *optional* **Separator:** Separator to be added between the strings.<br>*Literal\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expressions:** \[hello, world]
* **Null output if any input is null:** *null*
* **Separator:** \_

**Output:** hello\_world

***

### Example 2: Null case

**Argument values:**

* **Expressions:** \[hello, *null*, world, !]
* **Null output if any input is null:** *null*
* **Separator:** --

**Output:** hello--world--!

***

### Example 3: Null case

**Argument values:**

* **Expressions:** \[hello, *null*, world, !]
* **Null output if any input is null:** true
* **Separator:** --

**Output:** *null*

***
