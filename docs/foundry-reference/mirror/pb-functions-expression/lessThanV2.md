<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/lessThanV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Less than

> Supported in: Batch, Faster, Streaming

Returns true if left is less than right.

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
| \[ {<br> **field1**: a,<br> **field2**: aa,<br>} ] | \[ {<br> **field1**: b,<br> **field2**: bb,<br>} ] | true |

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
