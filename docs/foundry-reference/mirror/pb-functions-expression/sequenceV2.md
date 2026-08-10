<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/sequenceV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Sequence

> Supported in: Batch, Faster, Streaming

Creates an array with numbers in range from start to end.

**Expression categories:** Array

## Declared arguments

* **End:** The number to end at (inclusive).<br>*Expression\<T>*
* **Start:** The number to start from (inclusive).<br>*Expression\<T>*
* *optional* **Step size:** The size of the steps between numbers.<br>*Expression\<T>*

**Type variable bounds:** *T accepts Byte | Integer | Long | Short*

**Output type:** *Array\<T>*

## Examples

### Example 1: Base case

**Description:** Byte base case.

**Argument values:**

* **End:** 10
* **Start:** 0
* **Step size:** 1

**Output:** \[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]

***

### Example 2: Base case

**Description:** Integer base case.

**Argument values:**

* **End:** 10
* **Start:** 0
* **Step size:** 1

**Output:** \[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]

***

### Example 3: Base case

**Description:** Long base case.

**Argument values:**

* **End:** 10
* **Start:** 0
* **Step size:** 1

**Output:** \[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]

***

### Example 4: Base case

**Description:** Sequences increase by 1 unless otherwise specified.

**Argument values:**

* **End:** 10
* **Start:** 0
* **Step size:** *null*

**Output:** \[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]

***

### Example 5: Base case

**Description:** Short base case.

**Argument values:**

* **End:** 10
* **Start:** 0
* **Step size:** 1

**Output:** \[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]

***

### Example 6: Base case

**Description:** You can specify a custom step amount

**Argument values:**

* **End:** 10
* **Start:** 0
* **Step size:** 2

**Output:** \[ 0, 2, 4, 6, 8, 10 ]

***

### Example 7: Base case

**Description:** Steps can be negative

**Argument values:**

* **End:** 0
* **Start:** 10
* **Step size:** -1

**Output:** \[ 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0 ]

***

### Example 8: Edge case

**Description:** Invalid sequences become null

**Argument values:**

* **End:** 0
* **Start:** 10
* **Step size:** 2

**Output:** *null*

***
