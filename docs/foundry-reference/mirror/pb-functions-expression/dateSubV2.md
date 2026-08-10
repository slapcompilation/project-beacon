<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/dateSubV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Subtract value from date

> Supported in: Batch, Faster, Streaming

Returns the date that is 'value' days/weeks/months/quarter/years before 'start'.

**Expression categories:** Datetime

## Declared arguments

* **Date:** Date to subtract value to.<br>*Expression\<Date>*
* **Unit:** Date unit of the 'value' parameter.<br>*Enum\<Days, Months, Quarters, Weeks, Years>*
* **Value:** Number of days / weeks / quarters / years to subtract.<br>*Expression\<Integer>*

**Output type:** *Date*

## Examples

### Example 1: Base case

**Argument values:**

* **Date:** 2022-04-05
* **Unit:** `DAYS`
* **Value:** 2

**Output:** 2022-04-03

***

### Example 2: Base case

**Argument values:**

* **Date:** 2022-04-05
* **Unit:** `MONTHS`
* **Value:** 2

**Output:** 2022-02-05

***

### Example 3: Base case

**Argument values:**

* **Date:** 2022-04-05
* **Unit:** `QUARTERS`
* **Value:** 2

**Output:** 2021-10-05

***

### Example 4: Base case

**Argument values:**

* **Date:** 2022-04-05
* **Unit:** `YEARS`
* **Value:** 2

**Output:** 2020-04-05

***

### Example 5: Null case

**Argument values:**

* **Date:** `date`
* **Unit:** `YEARS`
* **Value:** `value`

| date | value | **Output** |
| ----- | ----- | ----- |
| 2022-04-05 | *null* | *null* |
| *null* | 2 | *null* |
| *null* | *null* | *null* |

***
