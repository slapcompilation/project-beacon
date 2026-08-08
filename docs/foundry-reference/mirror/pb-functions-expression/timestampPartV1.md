<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/timestampPartV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract timestamp part

> Supported in: Batch, Faster, Streaming

Extracts a part of a timestamp like year or day of week.

**Expression categories:** Datetime

## Declared arguments

* **Expression:** Timestamp to extract from.<br>*Expression\<Timestamp>*
* **Part:** Part of timestamp to extract.<br>*Enum\<Day of month, Day of week, Day of year, Hour of day, Millisecond of second, Minutes of hour, Month, Quarter, Second of minute, Week of year, and more ...>*

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

* **Expression:** 2022-02-10T10:00:00Z
* **Part:** `HOUR_OF_DAY`

**Output:** 10

***

### Example 5: Base case

**Argument values:**

* **Expression:** 2022-02-10T10:00:00.002Z
* **Part:** `MILLISECOND_OF_SECOND`

**Output:** 2

***

### Example 6: Base case

**Argument values:**

* **Expression:** 2022-02-10T10:00:00Z
* **Part:** `MONTH`

**Output:** 2

***

### Example 7: Base case

**Argument values:**

* **Expression:** 2022-02-10T10:00:00Z
* **Part:** `QUARTER`

**Output:** 1

***

### Example 8: Base case

**Argument values:**

* **Expression:** 2022-02-10T10:00:10Z
* **Part:** `SECOND_OF_MINUTE`

**Output:** 10

***

### Example 9: Base case

**Argument values:**

* **Expression:** 2022-02-10T10:00:00Z
* **Part:** `YEAR`

**Output:** 2022

***

### Example 10: Null case

**Argument values:**

* **Expression:** `date`
* **Part:** `YEAR`

| date | **Output** |
| ----- | ----- |
| *null* | *null* |

***
