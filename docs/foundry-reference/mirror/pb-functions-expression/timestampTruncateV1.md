<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/timestampTruncateV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Truncate timestamp

> Supported in: Batch, Faster

Returns the timestamp truncated to the specified unit.

**Expression categories:** Datetime

## Declared arguments

* **Start:** *no description*<br>*Expression\<Timestamp>*
* **Unit:** Time unit used to truncate.<br>*Enum\<Days, Hours, Milliseconds, Minutes, Months, Quarters, Seconds, Weeks, Years>*

**Output type:** *Timestamp*

## Examples

### Example 1: Base case

**Argument values:**

* **Start:** 2022-02-01T10:10:10.002Z
* **Unit:** `DAYS`

**Output:** 2022-02-01T00:00:00Z

***

### Example 2: Base case

**Argument values:**

* **Start:** 2022-02-01T10:10:10.002Z
* **Unit:** `HOURS`

**Output:** 2022-02-01T10:00:00Z

***

### Example 3: Base case

**Argument values:**

* **Start:** 2022-02-01T10:10:10.0022Z
* **Unit:** `MILLISECONDS`

**Output:** 2022-02-01T10:10:10.002Z

***

### Example 4: Base case

**Argument values:**

* **Start:** 2022-02-01T10:10:10.002Z
* **Unit:** `MINUTES`

**Output:** 2022-02-01T10:10:00Z

***

### Example 5: Base case

**Argument values:**

* **Start:** 2022-02-01T10:10:10.002Z
* **Unit:** `MONTHS`

**Output:** 2022-02-01T00:00:00Z

***

### Example 6: Base case

**Argument values:**

* **Start:** 2022-02-01T10:10:10.002Z
* **Unit:** `QUARTERS`

**Output:** 2022-01-01T00:00:00Z

***

### Example 7: Base case

**Argument values:**

* **Start:** 2022-02-01T10:10:10.0022Z
* **Unit:** `SECONDS`

**Output:** 2022-02-01T10:10:10Z

***

### Example 8: Base case

**Argument values:**

* **Start:** 2022-02-01T10:10:10.002Z
* **Unit:** `YEARS`

**Output:** 2022-01-01T00:00:00Z

***

### Example 9: Null case

**Argument values:**

* **Start:** *null*
* **Unit:** `YEARS`

**Output:** *null*

***
