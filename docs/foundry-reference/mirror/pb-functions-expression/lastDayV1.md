<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/lastDayV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Last day of the week/month/quarter/year

> Supported in: Batch, Faster

Returns the last day of the week/month/quarter/year.

**Expression categories:** Datetime

## Declared arguments

* **Date:** Date to choose the last day of.<br>*Expression\<Date | Timestamp>*
* **Unit:** Date unit used to choose the last day of.<br>*Enum\<Months, Quarters, Weeks, Years>*

**Output type:** *Date*

## Examples

### Example 1: Base case

**Description:** You can get the last day of the month from a date

**Argument values:**

* **Date:** 2022-02-01
* **Unit:** `months`

**Output:** 2022-02-28

***

### Example 2: Base case

**Description:** You can get the last day of the month from a timestamp

**Argument values:**

* **Date:** 2022-02-01T12:00:00Z
* **Unit:** `months`

**Output:** 2022-02-28

***

### Example 3: Base case

**Description:** You can get the last day of the week from a timestamp

**Argument values:**

* **Date:** 2022-02-01T12:00:00Z
* **Unit:** `quarters`

**Output:** 2022-03-31

***

### Example 4: Base case

**Description:** You can get the last day of the week from a timestamp

**Argument values:**

* **Date:** 2022-02-01T12:00:00Z
* **Unit:** `weeks`

**Output:** 2022-02-06

***

### Example 5: Base case

**Description:** You can get the last day of the year from a timestamp

**Argument values:**

* **Date:** 2022-02-01T12:00:00Z
* **Unit:** `years`

**Output:** 2022-12-31

***

### Example 6: Null case

**Description:** Null columns stay null

**Argument values:**

* **Date:** *null*
* **Unit:** `months`

**Output:** *null*

***
