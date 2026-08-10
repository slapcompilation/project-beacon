<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/dateSequenceV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Date sequence

> Supported in: Batch, Faster

Creates an array with dates in range from start to end.

**Expression categories:** Datetime

## Declared arguments

* **End date:** The date to end at (inclusive).<br>*Expression\<Date>*
* **Start date:** The date to start from (inclusive).<br>*Expression\<Date>*
* **Step unit:** Unit of the step size.<br>*Enum\<Days, Months, Quarters, Weeks, Years>*
* *optional* **Step size:** The size of the steps between numbers. Defaults to 1.<br>*Expression\<Numeric>*

**Output type:** *Array\<Date>*

## Examples

### Example 1: Base case

**Argument values:**

* **End date:** `last_planned_flight`
* **Start date:** `first_planned_flight`
* **Step unit:** `DAYS`
* **Step size:** *null*

| first\_planned\_flight | last\_planned\_flight | **Output** |
| ----- | ----- | ----- |
| 2023-01-01 | 2023-01-03 | \[ 2023-01-01, 2023-01-02, 2023-01-03 ] |
| 2023-01-31 | 2023-02-02 | \[ 2023-01-31, 2023-02-01, 2023-02-02 ] |
| 2023-02-28 | 2023-03-01 | \[ 2023-02-28, 2023-03-01 ] |

***
