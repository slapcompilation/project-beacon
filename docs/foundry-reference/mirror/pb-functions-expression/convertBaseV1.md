<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/convertBaseV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert base

> Supported in: Batch, Streaming

Convert a number (or it string representation) from one base to another.

**Expression categories:** Binary, Cast, Numeric

## Declared arguments

* **Expression:** Column to convert base.<br>*Expression\<Byte | Integer | Long | Short | String>*
* **From base:** Convert from base.<br>*Literal\<Integer>*
* **To base:** Convert to base.<br>*Literal\<Integer>*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** 4A801
* **From base:** 16
* **To base:** 10

**Output:** 305153

***

### Example 2: Base case

**Argument values:**

* **Expression:** 8
* **From base:** 10
* **To base:** 2

**Output:** 1000

***

### Example 3: Null case

**Argument values:**

* **Expression:** `input`
* **From base:** 10
* **To base:** 16

| input | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 4: Edge case

**Description:** When input is made of characters that are outside the base of the given 'from base', only the leading characters up to the first out of base character is considered.

**Argument values:**

* **Expression:** `input`
* **From base:** 2
* **To base:** 10

| input | **Output** |
| ----- | ----- |
| 123 | 1 |
| 213 | 0 |
| 1032 | 2 |

***
