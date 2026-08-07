<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/epochMillisToDateV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Epoch milliseconds to date

> Supported in: Batch, Faster, Streaming

Converts from epoch milliseconds to date, UTC.

**Expression categories:** Cast, Datetime

## Declared arguments

* **Expression:** Epoch milliseconds expressions.<br>*Expression\<Double | Long>*

**Output type:** *Date*

## Examples

### Example 1: Base case

**Description:** You can convert epoch timestamps in milliseconds to the date type

**Argument values:**

* **Expression:** 1673964111000

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
