<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/equalsV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Equals

> Supported in: Batch, Faster, Streaming

Returns true if left and right are equal.

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
| 1 | 1 | true |
| 1 | 0 | false |

***

### Example 2: Base case

**Argument values:**

* **Left:** `a`
* **Right:** `b`

| a | b | **Output** |
| ----- | ----- | ----- |
| 1.0 | 1 | true |
| 1.0 | 0 | false |

***

### Example 3: Base case

**Argument values:**

* **Left:** `departure`
* **Right:** `destination`

| departure | destination | **Output** |
| ----- | ----- | ----- |
| Heathrow | Heathrow | true |
| Heathrow | Gatwick | false |

***

### Example 4: Null case

**Argument values:**

* **Left:** `departure`
* **Right:** `destination`

| departure | destination | **Output** |
| ----- | ----- | ----- |
| *null* | *null* | true |
| *null* | Heathrow | false |

***
