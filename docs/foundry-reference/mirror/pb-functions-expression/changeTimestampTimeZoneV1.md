<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/changeTimestampTimeZoneV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Change timestamp time zone

> Supported in: Batch, Faster

Changes the time zone of a timestamp.

**Expression categories:** Datetime

## Declared arguments

* **Output time zone:** Target time zone.<br>*TimeZone*
* **Timestamp:** Timestamp column.<br>*Expression\<Timestamp>*
* *optional* **Input time zone:** Time zone that the current timestamp is recorded in.<br>*Expression\<String>*

**Output type:** *Timestamp*

## Examples

### Example 1: Base case

**Argument values:**

* **Output time zone:** America/Chicago
* **Timestamp:** 2020-04-28T05:09:00Z
* **Input time zone:** US/Eastern

**Output:** 2020-04-28T04:09:00Z

***

### Example 2: Base case

**Argument values:**

* **Output time zone:** Australia/Sydney
* **Timestamp:** `timestamp`
* **Input time zone:** `time_zone`

| timestamp | time\_zone | **Output** |
| ----- | ----- | ----- |
| 2020-04-28T10:09:00Z | US/Eastern | 2020-04-29T00:09:00Z |
| 2020-04-28T10:09:00Z | UTC | 2020-04-28T20:09:00Z |

***

### Example 3: Null case

**Argument values:**

* **Output time zone:** US/Eastern
* **Timestamp:** 2020-04-28T10:09:00Z
* **Input time zone:** *null*

**Output:** 2020-04-28T06:09:00Z

***

### Example 4: Null case

**Argument values:**

* **Output time zone:** Australia/Sydney
* **Timestamp:** `timestamp`
* **Input time zone:** `time_zone`

| timestamp | time\_zone | **Output** |
| ----- | ----- | ----- |
| *null* | US/Eastern | *null* |
| *null* | *null* | *null* |
| 2020-04-28T10:09:00Z | *null* | 2020-04-28T20:09:00Z |

***

### Example 5: Edge case

**Argument values:**

* **Output time zone:** UTC
* **Timestamp:** 2025-11-02T01:01:14Z
* **Input time zone:** America/Halifax

**Output:** 2025-11-02T04:01:14Z

***
