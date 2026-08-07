<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/arraySumV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Sum of array elements

> Supported in: Batch, Faster, Streaming

Sums the elements contained within the array.

**Expression categories:** Array

## Declared arguments

* **Expression:** An array of numeric types to be summed.<br>*Expression\<Array\<T>>*
* *optional* **Treat null as zero:** If true, nulls inside the array are treated as zero, and arrays containing null can be summed. If false, the presence of a null makes the entire array null.<br>*Literal\<Boolean>*

**Type variable bounds:** *T accepts DefiniteNumeric*

**Output type:** *T*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** \[ 1, 2, 3 ]
* **Treat null as zero:** true

**Output:** 6

***

### Example 2: Null case

**Argument values:**

* **Expression:** \[ 1, 2, 3, *null* ]
* **Treat null as zero:** false

**Output:** *null*

***

### Example 3: Null case

**Argument values:**

* **Expression:** \[ 1, 2, 3, *null* ]
* **Treat null as zero:** true

**Output:** 6

***

### Example 4: Null case

**Argument values:**

* **Expression:** `array`
* **Treat null as zero:** true

| array | **Output** |
| ----- | ----- |
| *null* | *null* |

***
