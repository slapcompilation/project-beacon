<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/datePartV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract date part

> Supported in: Batch, Faster, Streaming

Extracts a part of a date like year or day of week.

**Expression categories:** Datetime

## Declared arguments

* **Expression:** Date to extract from.<br>*Expression\<Date | Timestamp>*
* **Part:** Part of date to extract.<br>*Enum\<Day of month, Day of week, Day of year, Month, Quarter, Week of year, Year>*

**Output type:** *Integer*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** 2022-02-10T10:00:00Z
* **Part:** `DAY_OF_MONTH`

**Output:** 10

***

### Example 2: Base case

**Argument values:**

* **Expression:** 2022-02-10T10:00:00Z
* **Part:** `DAY_OF_WEEK`

**Output:** 4

***

### Example 3: Base case

**Argument values:**

* **Expression:** 2022-02-10T10:00:00Z
* **Part:** `DAY_OF_YEAR`

**Output:** 41

***

### Example 4: Base case

**Argument values:**

* **Expression:** 2022-02-10
* **Part:** `MONTH`

**Output:** 2

***

### Example 5: Base case

**Argument values:**

* **Expression:** 2022-02-10
* **Part:** `QUARTER`

**Output:** 1

***

### Example 6: Base case

**Description:** Weeks of year start on Monday and end on Sunday

**Argument values:**

* **Expression:** 2024-01-14T10:00:00Z
* **Part:** `WEEK_OF_YEAR`

**Output:** 2

***

### Example 7: Base case

**Description:** Weeks of year respect leap weeks as defined by ISO 8601

**Argument values:**

* **Expression:** 2027-01-01T10:00:00Z
* **Part:** `WEEK_OF_YEAR`

**Output:** 53

***

### Example 8: Base case

**Argument values:**

* **Expression:** 2022-02-10
* **Part:** `YEAR`

**Output:** 2022

***

### Example 9: Null case

**Argument values:**

* **Expression:** `date`
* **Part:** `YEAR`

| date | **Output** |
| ----- | ----- |
| *null* | *null* |

***
