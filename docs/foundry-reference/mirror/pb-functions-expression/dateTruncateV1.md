<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/dateTruncateV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Truncate date

> Supported in: Batch, Faster

Returns the date rounded down to the nearest day/week/month/quarter/year.

**Expression categories:** Datetime

## Declared arguments

* **Start:** Date to truncate.<br>*Expression\<Date | Timestamp>*
* **Unit:** Date unit used to truncate.<br>*Enum\<Days, Months, Quarters, Weeks (starting Monday), Weeks (starting Sunday), Years>*

**Output type:** *Date*

## Examples

### Example 1: Base case

**Argument values:**

* **Start:** 2022-02-10T10:00:00Z
* **Unit:** `DAYS`

**Output:** 2022-02-10

***

### Example 2: Base case

**Argument values:**

* **Start:** 2022-02-10
* **Unit:** `MONTHS`

**Output:** 2022-02-01

***

### Example 3: Base case

**Argument values:**

* **Start:** 2022-02-10
* **Unit:** `QUARTERS`

**Output:** 2022-01-01

***

### Example 4: Base case

**Argument values:**

* **Start:** `date`
* **Unit:** `WEEKS`

| date | **Output** |
| ----- | ----- |
| 2025-01-18 | 2025-01-13 |
| 2025-01-19 | 2025-01-13 |
| 2025-01-20 | 2025-01-20 |
| 2025-01-21 | 2025-01-20 |
| 2025-01-22 | 2025-01-20 |
| 2025-01-23 | 2025-01-20 |
| 2025-01-24 | 2025-01-20 |
| 2025-01-25 | 2025-01-20 |
| 2025-01-26 | 2025-01-20 |
| 2025-01-27 | 2025-01-27 |

***

### Example 5: Base case

**Argument values:**

* **Start:** `date`
* **Unit:** `WEEKS_STARTING_SUNDAY`

| date | **Output** |
| ----- | ----- |
| 2025-01-18 | 2025-01-12 |
| 2025-01-19 | 2025-01-19 |
| 2025-01-20 | 2025-01-19 |
| 2025-01-21 | 2025-01-19 |
| 2025-01-22 | 2025-01-19 |
| 2025-01-23 | 2025-01-19 |
| 2025-01-24 | 2025-01-19 |
| 2025-01-25 | 2025-01-19 |
| 2025-01-26 | 2025-01-26 |
| *null* | *null* |

***

### Example 6: Base case

**Argument values:**

* **Start:** 2022-02-10
* **Unit:** `YEARS`

**Output:** 2022-01-01

***

### Example 7: Null case

**Argument values:**

* **Start:** *null*
* **Unit:** `YEARS`

**Output:** *null*

***
