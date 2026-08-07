<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/greaterThanOrEqualsV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Greater than or equals

> Supported in: Batch, Faster, Streaming

Returns true if left is greater than or equal to right.

**Expression categories:** Boolean

## Declared arguments

* **Left:** Left expression.<br>*Expression\<ComparableType>*
* **Right:** Right expression.<br>*Expression\<ComparableType>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Left:** `a`
* **Right:** `b`

| a | b | **Output** |
| ----- | ----- | ----- |
| 1 | 0 | true |
| 1 | 1 | true |
| 0 | 1 | false |

***

### Example 2: Base case

**Argument values:**

* **Left:** `a`
* **Right:** `b`

| a | b | **Output** |
| ----- | ----- | ----- |
| 1 | 0.5 | true |
| 1 | 1.0 | true |

***

### Example 3: Base case

**Argument values:**

* **Left:** `a`
* **Right:** `b`

| a | b | **Output** |
| ----- | ----- | ----- |
| b | a | true |
| abcd | abc | true |
| aa | b | false |

***

### Example 4: Base case

**Argument values:**

* **Left:** `a`
* **Right:** `b`

| a | b | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | *null* |
| 1 | *null* | *null* |
| *null* | 1.0 | *null* |

***
