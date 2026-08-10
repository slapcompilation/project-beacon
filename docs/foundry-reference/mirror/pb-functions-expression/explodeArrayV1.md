<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/explodeArrayV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Explode array

> Supported in: Batch, Faster, Streaming

Explode array into a row per value.

**Expression categories:** Array

## Declared arguments

* **Expression:** The array to explode.<br>*Expression\<Array\<T>>*
* *optional* **Keep empty / null arrays:** If true, empty arrays and nulls will be kept as nulls in the output, otherwise they will be filtered.<br>*Literal\<Boolean>*

**Type variable bounds:** *T accepts AnyType*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `array`
* **Keep empty / null arrays:** false

**Given input table:**

| array |
| ----- |
| \[ 1, 2 ] |

**Expected output table:** | array |
| ----- |
| 1 |
| 2 |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `array`
* **Keep empty / null arrays:** false

**Given input table:**

| array |
| ----- |
| \[ 1, 2 ] |
| \[  ] |

**Expected output table:** | array |
| ----- |
| 1 |
| 2 |

***

### Example 3: Base case

**Argument values:**

* **Expression:** `array`
* **Keep empty / null arrays:** true

**Given input table:**

| array |
| ----- |
| \[ 1, 2 ] |
| \[  ] |

**Expected output table:** | array |
| ----- |
| 1 |
| 2 |
| *null* |

***

### Example 4: Base case

**Argument values:**

* **Expression:** `array`
* **Keep empty / null arrays:** true

**Given input table:**

| array |
| ----- |
| \[ 1, 2 ] |
| \[ *null* ] |

**Expected output table:** | array |
| ----- |
| 1 |
| 2 |
| *null* |

***
