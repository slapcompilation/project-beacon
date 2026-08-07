<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/isEmptyStructV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Is empty struct

> Supported in: Batch, Streaming

Returns true if the input is an empty struct, with recursive checking of inner arrays and structs.

**Expression categories:** Boolean

## Declared arguments

* **Expression:** Compute whether this struct is empty or has non-null fields.<br>*Expression\<Struct>*

**Output type:** *Boolean*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **id**: *null*,<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | true |
| {<br> **airline**: {<br> **id**: NA,<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | false |

***

### Example 2: Base case

**Argument values:**

* **Expression:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **ids**: *null*,<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | true |
| {<br> **airline**: {<br> **ids**: \[ *null* ],<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | true |
| {<br> **airline**: {<br> **ids**: \[ foo, bar ],<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | false |
| {<br> **airline**: {<br> **ids**: \[ foo, *null* ],<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | false |

***

### Example 3: Base case

**Argument values:**

* **Expression:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **name**: *null*,<br>},<br> **ids**: *null*,<br> **tail\_no**: *null*,<br>} | true |

***

### Example 4: Base case

**Argument values:**

* **Expression:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **ids**: {<br> foo -> *null*,<br>},<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | true |
| {<br> **airline**: {<br> **ids**: {<br> foo -> bar,<br>},<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | false |
| {<br> **airline**: {<br> **ids**: {<br> foo -> bar,<br> foo1 -> *null*,<br>},<br> **name**: *null*,<br>},<br> **tail\_no**: *null*,<br>} | false |

***

### Example 5: Base case

**Argument values:**

* **Expression:** `struct`

| struct | **Output** |
| ----- | ----- |
| {<br> **airline**: {<br> **ids**: \[ {<br> **airline**: {<br> **ids**: \[ *null* ]... | true |
| {<br> **airline**: {<br> **ids**: \[ {<br> **airline**: {<br> **ids**: \[ foo, bar... | false |

***
