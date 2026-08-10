<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/epochSecondsToDateV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Epoch seconds to date

> Supported in: Batch, Faster, Streaming

Converts from epoch seconds to date in UTC.

**Expression categories:** Cast, Datetime

## Declared arguments

* **Expression:** Epoch seconds expressions.<br>*Expression\<Double | Integer | Long>*

**Output type:** *Date*

## Examples

### Example 1: Base case

**Description:** You can convert epoch timestamps to the date type

**Argument values:**

* **Expression:** 1673964111

**Output:** 2023-01-17

***

### Example 2: Null case

**Description:** Null columns remain null

**Argument values:**

* **Expression:** `input`

| input | **Output** |
| ----- | ----- |
| *null* | *null* |

***
