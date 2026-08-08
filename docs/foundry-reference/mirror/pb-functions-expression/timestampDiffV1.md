<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/timestampDiffV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Timestamp difference

> Supported in: Batch, Faster, Streaming

Returns the difference between two timestamps in the given time unit.

**Expression categories:** Datetime

## Declared arguments

* **End:** The end date or time to subtract from.<br>*Expression\<Date | Timestamp>*
* **Start:** The start date or time to be subtracted.<br>*Expression\<Date | Timestamp>*
* **Unit:** Time unit.<br>*Enum\<Days, Hours, Milliseconds, Minutes, Months, Quarters, Seconds, Weeks, Years>*

**Output type:** *Long*

## Examples

### Example 1: Base case

**Argument values:**

* **End:** 2022-10-01T10:00:00Z
* **Start:** 2022-10-01T09:00:00Z
* **Unit:** `HOURS`

**Output:** 1

***

### Example 2: Null case

**Argument values:**

* **End:** `End`
* **Start:** `Start`
* **Unit:** `HOURS`

| Start | End | **Output** |
| ----- | ----- | ----- |
| *null* | 2020-01-01 | *null* |
| 2020-01-01 | *null* | *null* |
| *null* | *null* | *null* |

***
