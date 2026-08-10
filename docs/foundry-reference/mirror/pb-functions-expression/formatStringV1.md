<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/formatStringV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Format string

> Supported in: Batch, Streaming

Formats string printf style.

**Expression categories:** String

## Declared arguments

* **Format arguments:** List of args to insert into format string.<br>*List\<Expression\<Boolean | Byte | Date | Decimal | Double | Float | Integer | Long | Short | String | Timestamp>>*
* **Format string:** String to be formatted.<br>*Literal\<String>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Format arguments:** \[`argument1`, `argument2`]
* **Format string:** Hello %s, my name is %s

| argument1 | argument2 | **Output** |
| ----- | ----- | ----- |
| Alice | Bob | Hello Alice, my name is Bob |
| Jane | John | Hello Jane, my name is John |

***

### Example 2: Base case

**Description:** Formats an integer.

**Argument values:**

* **Format arguments:** \[4]
* **Format string:** number = %d

**Output:** number = 4

***

### Example 3: Base case

**Description:** Formats a double with a sign and 4 decimal places.

**Argument values:**

* **Format arguments:** \[2.718281828459045]
* **Format string:** e = %+.4f

**Output:** e = +2.7183

***

### Example 4: Null case

**Argument values:**

* **Format arguments:** \[`argument1`, `argument2`]
* **Format string:** Hello %s, my name is %s

| argument1 | argument2 | **Output** |
| ----- | ----- | ----- |
| *null* | Bob | Hello null, my name is Bob |
| Alice | *null* | Hello Alice, my name is null |
| *null* | *null* | Hello null, my name is null |

***
