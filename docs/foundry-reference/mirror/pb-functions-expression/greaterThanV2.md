<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/greaterThanV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Greater than

> Supported in: Batch, Faster, Streaming

Returns true if left is greater than right.

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
| 1 | 1 | false |
| 0 | 1 | false |

***

### Example 2: Base case

**Argument values:**

* **Left:** `a`
* **Right:** `b`

| a | b | **Output** |
| ----- | ----- | ----- |
| 1 | 0.5 | true |
| 1 | 1.0 | false |

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

### Example 4: Null case

**Argument values:**

* **Left:** `left`
* **Right:** `right`

| left | right | **Output** |
| ----- | ----- | ----- |
| *null* | b | *null* |
| b | *null* | *null* |
| *null* | *null* | *null* |

***
