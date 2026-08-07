<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/lessThanOrEqualsV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Less than or equals

> Supported in: Batch, Faster, Streaming

Returns true if left is less than or equal to right.

**Expression categories:** Boolean

## Declared arguments

* **Left:** Left expression.<br>*Expression\<ComparableType>*
* **Right:** Right expression.<br>*Expression\<ComparableType>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Left:** `left`
* **Right:** `right`

| left | right | **Output** |
| ----- | ----- | ----- |
| 1.0 | 10 | true |
| 10.0 | 1 | false |

***

### Example 2: Base case

**Argument values:**

* **Left:** `left`
* **Right:** `right`

| left | right | **Output** |
| ----- | ----- | ----- |
| a | b | true |
| b | a | false |

***

### Example 3: Null case

**Argument values:**

* **Left:** `left`
* **Right:** `right`

| left | right | **Output** |
| ----- | ----- | ----- |
| *null* | b | *null* |
| b | *null* | *null* |
| *null* | *null* | *null* |

***
