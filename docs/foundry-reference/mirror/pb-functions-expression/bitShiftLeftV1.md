<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/bitShiftLeftV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Bit shift left

> Supported in: Batch, Streaming

Shift the given value a number of bits left.

**Expression categories:** Binary

## Declared arguments

* **Expression:** The value to shift left.<br>*Expression\<E>*
* **Number of bits:** The number of bits to shift left by.<br>*Literal\<Integer>*

**Type variable bounds:** *E accepts Byte | Integer | Long | Short*

**Output type:** *E*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** 1
* **Number of bits:** 1

**Output:** 2

***

### Example 2: Base case

**Argument values:**

* **Expression:** 12345678910
* **Number of bits:** 5

**Output:** 395061725120

***

### Example 3: Null case

**Argument values:**

* **Expression:** `number`
* **Number of bits:** 1

| number | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 4: Edge case

**Argument values:**

* **Expression:** -2147483648
* **Number of bits:** 100

**Output:** 0

***

### Example 5: Edge case

**Argument values:**

* **Expression:** 2147483647
* **Number of bits:** 10

**Output:** -1024

***

### Example 6: Edge case

**Argument values:**

* **Expression:** 1
* **Number of bits:** -10

**Output:** 4194304

***
