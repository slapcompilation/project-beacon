<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/timestampSubtractV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Timestamp subtract

> Supported in: Batch, Faster, Streaming

Subtract value from timestamp in specified unit.

**Expression categories:** Datetime

## Declared arguments

* **Timestamp:** Timestamp that will be modified.<br>*Expression\<Timestamp>*
* **Unit:** Time unit.<br>*Enum\<Days, Hours, Milliseconds, Minutes, Months, Quarters, Seconds, Weeks, Years>*
* **Value to subtract:** Value that is subtracted from timestamp.<br>*Expression\<Byte | Integer | Long | Short>*

**Output type:** *Timestamp*

## Examples

### Example 1: Base case

**Argument values:**

* **Timestamp:** 2022-02-02T00:00:00Z
* **Unit:** `DAYS`
* **Value to subtract:** 1

**Output:** 2022-02-01T00:00:00Z

***

### Example 2: Base case

**Argument values:**

* **Timestamp:** 2022-02-02T00:00:00Z
* **Unit:** `HOURS`
* **Value to subtract:** 2

**Output:** 2022-02-01T22:00:00Z

***

### Example 3: Base case

**Argument values:**

* **Timestamp:** 2022-02-02T00:00:00Z
* **Unit:** `MILLISECONDS`
* **Value to subtract:** 2

**Output:** 2022-02-01T23:59:59.998Z

***

### Example 4: Base case

**Argument values:**

* **Timestamp:** 2022-02-02T00:00:00Z
* **Unit:** `MINUTES`
* **Value to subtract:** 2

**Output:** 2022-02-01T23:58:00Z

***

### Example 5: Base case

**Argument values:**

* **Timestamp:** 2022-02-01T00:00:00Z
* **Unit:** `MONTHS`
* **Value to subtract:** 2

**Output:** 2021-12-01T00:00:00Z

***

### Example 6: Base case

**Argument values:**

* **Timestamp:** 2022-02-01T00:00:00Z
* **Unit:** `QUARTERS`
* **Value to subtract:** 2

**Output:** 2021-08-01T00:00:00Z

***

### Example 7: Base case

**Argument values:**

* **Timestamp:** 2022-02-02T00:00:00Z
* **Unit:** `SECONDS`
* **Value to subtract:** 5

**Output:** 2022-02-01T23:59:55Z

***

### Example 8: Base case

**Argument values:**

* **Timestamp:** 2022-02-01T00:00:00Z
* **Unit:** `YEARS`
* **Value to subtract:** 2

**Output:** 2020-02-01T00:00:00Z

***

### Example 9: Null case

**Argument values:**

* **Timestamp:** `date`
* **Unit:** `YEARS`
* **Value to subtract:** `value`

| date | value | **Output** |
| ----- | ----- | ----- |
| 2022-02-01T00:00:00Z | *null* | *null* |
| *null* | 2 | *null* |
| *null* | *null* | *null* |

***
