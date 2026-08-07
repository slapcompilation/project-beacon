<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/explodeArrayWithPositionV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Explode array with position

> Supported in: Batch, Streaming

Explode array into a row per value as a struct containing the element's relative position in the array and the element itself.

**Expression categories:** Array

## Declared arguments

* **Array:** Array of values to explode.<br>*Expression\<Array\<T>>*
* *optional* **Keep empty / null arrays:** If true, empty arrays and nulls will be kept as nulls in the output, otherwise they will be filtered.<br>*Literal\<Boolean>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *Struct\<Optional\[position]:Integer, Optional\[element]:T>*

## Examples

### Example 1: Base case

**Argument values:**

* **Array:** `array`
* **Keep empty / null arrays:** *null*

**Given input table:**

| array |
| ----- |
| \[ one, two, three ] |
| \[ four, five ] |

**Expected output table:** | array |
| ----- |
| {<br> element -> one,<br> position -> 1,<br>} |
| {<br> element -> two,<br> position -> 2,<br>} |
| {<br> element -> three,<br> position -> 3,<br>} |
| {<br> element -> four,<br> position -> 1,<br>} |
| {<br> element -> five,<br> position -> 2,<br>} |

***

### Example 2: Edge case

**Argument values:**

* **Array:** `array`
* **Keep empty / null arrays:** false

**Given input table:**

| array |
| ----- |
| \[ one, two, three ] |
| \[  ] |
| \[ four, five ] |
| \[  ] |

**Expected output table:** | array |
| ----- |
| {<br> element -> one,<br> position -> 1,<br>} |
| {<br> element -> two,<br> position -> 2,<br>} |
| {<br> element -> three,<br> position -> 3,<br>} |
| {<br> element -> four,<br> position -> 1,<br>} |
| {<br> element -> five,<br> position -> 2,<br>} |

***

### Example 3: Edge case

**Argument values:**

* **Array:** `array`
* **Keep empty / null arrays:** true

**Given input table:**

| array |
| ----- |
| \[ one, two, three ] |
| \[  ] |
| \[ four, five ] |
| \[  ] |

**Expected output table:** | array |
| ----- |
| {<br> element -> one,<br> position -> 1,<br>} |
| {<br> element -> two,<br> position -> 2,<br>} |
| {<br> element -> three,<br> position -> 3,<br>} |
| {<br> element -> *null*,<br> position -> *null*,<br>} |
| {<br> element -> four,<br> position -> 1,<br>} |
| {<br> element -> five,<br> position -> 2,<br>} |
| {<br> element -> *null*,<br> position -> *null*,<br>} |

***
