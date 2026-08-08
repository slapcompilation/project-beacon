<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/transformArrayElementV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Transform array element

> Supported in: Batch, Streaming

Maps each element of an array using an expression. Note, array index starts at 1.

**Expression categories:** Array

## Declared arguments

* **Array:** Input array containing elements to apply the expression over.<br>*Expression\<Array\<AnyType>>*
* **Expression to apply:** The expression to apply once per element of the array.<br>*Expression\<T>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Array:** `flight_number`
* **Expression to apply:** <br>stringBeforeDelimiter(<br> delimiter: -,<br> expression: `element`,<br> ignoreCase: false,<br>)

| flight\_number | **Output** |
| ----- | ----- |
| \[ XB-134, MT-111 ] | \[ XB, MT ] |

***

### Example 2: Base case

**Argument values:**

* **Array:** `miles`
* **Expression to apply:** <br>add(<br> expressions: \[`previous_miles`, `element`],<br>)

| miles | previous\_miles | **Output** |
| ----- | ----- | ----- |
| \[ 12300, 12342 ] | 10000 | \[ 22300, 22342 ] |

***

### Example 3: Base case

**Description:** Add the index to the array element. Note the index starts at 1.

**Argument values:**

* **Array:** `array`
* **Expression to apply:** <br>add(<br> expressions: \[`elementIndex`, `element`],<br>)

| array | **Output** |
| ----- | ----- |
| \[ 1, 1, 1 ] | \[ 2, 3, 4 ] |

***

### Example 4: Base case

**Argument values:**

* **Array:** `miles`
* **Expression to apply:** <br>cast(<br> expression: `element`,<br> type: String,<br>)

| miles | **Output** |
| ----- | ----- |
| \[ 12300, 12342 ] | \[ 12300, 12342 ] |

***

### Example 5: Base case

**Description:** Getting the struct element from an array of structs.

**Argument values:**

* **Array:** `raw_data`
* **Expression to apply:** <br>getStructField(<br> locator: miles,<br> struct: `element`,<br>)

| raw\_data | **Output** |
| ----- | ----- |
| \[ {<br> **miles**: 22300,<br> **tail\_number**: XB-112,<br>}, {<br> **miles**: 22342,<br> **tail\_number**: XB-112,<br>} ] | \[ 22300, 22342 ] |

***

### Example 6: Base case

**Description:** Getting the struct element from an array of structs.

**Argument values:**

* **Array:** `raw_data`
* **Expression to apply:** <br>transformMapKeys(<br> expression: <br>uppercase(<br> expression: `key`,<br>),<br> map: `element`,<br>)

| raw\_data | **Output** |
| ----- | ----- |
| \[ {<br> miles -> 22300,<br> tail\_number -> XB-112,<br>}, {<br> miles -> 22342L,<br> tail\_number -> XB-112,<br>} ] | \[ {<br> MILES -> 22300,<br> TAIL\_NUMBER -> XB-112,<br>}, {<br> MILES -> 22342L,<br> TAIL\_NUMBER -> XB-112,<br>} ] |

***
