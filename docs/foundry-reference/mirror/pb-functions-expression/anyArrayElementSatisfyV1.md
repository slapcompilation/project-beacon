<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/anyArrayElementSatisfyV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Any array element satisfy

> Supported in: Batch, Streaming

Return true if the expression is true for any element in the array.

**Expression categories:** Array

## Declared arguments

* **Array:** Array expression.<br>*Expression\<Array\<AnyType>>*
* **Boolean condition:** The expression to apply once per element of the array.<br>*Expression\<Boolean>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Array:** `miles`
* **Boolean condition:** <br>lessThan(<br> left: `element`,<br> right: `base_line`,<br>)

| miles | base\_line | **Output** |
| ----- | ----- | ----- |
| \[ 12300, 100150 ] | 20000 | true |

***

### Example 2: Base case

**Argument values:**

* **Array:** `miles`
* **Boolean condition:** <br>isNull(<br> expression: `element`,<br>)

| miles | **Output** |
| ----- | ----- |
| \[ 12300, *null* ] | true |
| \[ 12300, 12000 ] | false |

***

### Example 3: Base case

**Argument values:**

* **Array:** `boolean_array`
* **Boolean condition:** `element`

| boolean\_array | **Output** |
| ----- | ----- |
| \[ true, false ] | true |
| \[ false, false ] | false |
| \[ true, true ] | true |

***

### Example 4: Null case

**Description:** Null arrays will return null outputs.

**Argument values:**

* **Array:** `miles`
* **Boolean condition:** <br>isNull(<br> expression: `element`,<br>)

| miles | **Output** |
| ----- | ----- |
| *null* | *null* |

***
