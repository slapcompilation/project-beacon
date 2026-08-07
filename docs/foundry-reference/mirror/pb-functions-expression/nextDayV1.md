<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/nextDayV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Next day

> Supported in: Batch

Returns the first date which is later than the value of the date column based on the day of week argument.

**Expression categories:** Datetime

## Declared arguments

* **Date:** Date to compute next day from.<br>*Expression\<Date>*
* **Day of the week:** Day of the week.<br>*Enum\<Friday, Monday, Saturday, Sunday, Thursday, Tuesday, Wednesday>*

**Output type:** *Date*

## Examples

### Example 1: Base case

**Description:** Next Thursday after Wednesday February 28, 2024 in leap year (should be Feb 29)

**Argument values:**

* **Date:** 2024-02-28
* **Day of the week:** `THURSDAY`

**Output:** 2024-02-29

***

### Example 2: Base case

**Description:** Next Friday after Thursday February 29, 2024 in leap year (should be Mar 1)

**Argument values:**

* **Date:** 2024-02-29
* **Day of the week:** `FRIDAY`

**Output:** 2024-03-01

***

### Example 3: Base case

**Description:** Next Friday after Wednesday January 10, 2024

**Argument values:**

* **Date:** 2024-01-10
* **Day of the week:** `FRIDAY`

**Output:** 2024-01-12

***

### Example 4: Base case

**Description:** Next Monday after Wednesday January 10, 2024

**Argument values:**

* **Date:** 2024-01-10
* **Day of the week:** `MONDAY`

**Output:** 2024-01-15

***

### Example 5: Base case

**Description:** Next Sunday after Saturday January 13, 2024

**Argument values:**

* **Date:** 2024-01-13
* **Day of the week:** `SUNDAY`

**Output:** 2024-01-14

***

### Example 6: Base case

**Description:** Next Tuesday after Tuesday January 9, 2024 (skips to following week)

**Argument values:**

* **Date:** 2024-01-09
* **Day of the week:** `TUESDAY`

**Output:** 2024-01-16

***

### Example 7: Null case

**Argument values:**

* **Date:** `date`
* **Day of the week:** `MONDAY`

| date | **Output** |
| ----- | ----- |
| *null* | *null* |

***
