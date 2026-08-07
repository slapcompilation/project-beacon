<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/epochSecondsToTimestampV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Epoch seconds to timestamp

> Supported in: Batch, Faster, Streaming

Converts from epoch seconds to timestamp in UTC.

**Expression categories:** Cast, Datetime

## Declared arguments

* **Expression:** Converts from epoch seconds to timestamp in UTC.<br>*Expression\<Double | Integer | Long | String>*

**Output type:** *Timestamp*

## Examples

### Example 1: Base case

**Description:** You can convert epoch timestamps to the timestamp type

**Argument values:**

* **Expression:** 1673964111

**Output:** 2023-01-17T14:01:51Z

***

### Example 2: Base case

**Description:** You can convert epoch timestamps as doubles to the timestamp type

**Argument values:**

* **Expression:** 1673964111.005

**Output:** 2023-01-17T14:01:51.005Z

***

### Example 3: Base case

**Description:** Random strings are read as null

**Argument values:**

* **Expression:** foobar

**Output:** *null*

***

### Example 4: Base case

**Description:** You can convert epoch timestamps as strings to the timestamp type

**Argument values:**

* **Expression:** 1673964111

**Output:** 2023-01-17T14:01:51Z

***

### Example 5: Null case

**Description:** Null columns remain null

**Argument values:**

* **Expression:** `input`

| input | **Output** |
| ----- | ----- |
| *null* | *null* |

***

### Example 6: Null case

**Description:** Null string columns remain null

**Argument values:**

* **Expression:** `input`

| input | **Output** |
| ----- | ----- |
| *null* | *null* |

***
