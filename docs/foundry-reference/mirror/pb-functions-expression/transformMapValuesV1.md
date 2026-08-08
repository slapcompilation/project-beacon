<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/transformMapValuesV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Transform map values

> Supported in: Batch

Transforms values of a map by applying an expression to every key-value pair.

**Expression categories:** Map

## Declared arguments

* **Expression to apply:** The expression to apply once per key-value pair of the map.<br>*Expression\<V>*
* **Map:** Map expression.<br>*Expression\<Map\<K, AnyType>>*

**Type variable bounds:** *K accepts AnyType\*\*V accepts AnyType*

**Output type:** *Map\<K, V>*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression to apply:** <br>stringBeforeDelimiter(<br> delimiter: -,<br> expression: `value`,<br> ignoreCase: false,<br>)
* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> 1 -> XB-134,<br> 2 -> MT-111,<br>} | {<br> 1 -> XB,<br> 2 -> MT,<br>} |

***

### Example 2: Base case

**Argument values:**

* **Expression to apply:** <br>cast(<br> expression: `value`,<br> type: Integer,<br>)
* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> 1 -> 11,<br> 2 -> 22,<br>} | {<br> 1 -> 11,<br> 2 -> 22,<br>} |

***

### Example 3: Base case

**Argument values:**

* **Expression to apply:** <br>cast(<br> expression: `key`,<br> type: String,<br>)
* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> 1 -> 11,<br> 2 -> 22,<br>} | {<br> 1 -> 1,<br> 2 -> 2,<br>} |

***

### Example 4: Base case

**Argument values:**

* **Expression to apply:** <br>concatStrings(<br> expressions: \[<br>stringBeforeDelimiter(<br> delimiter: -,<br> expression: `key`,<br> ignoreCase: false,<br>), `value`],<br> separator: -,<br>)
* **Map:** `flight_number`

| flight\_number | **Output** |
| ----- | ----- |
| {<br> MT-111 -> BB,<br> XB-134 -> AA,<br>} | {<br> MT-111 -> MT-BB,<br> XB-134 -> XB-AA,<br>} |

***
