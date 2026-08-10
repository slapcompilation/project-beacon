<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/timestampFromUtcV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert timestamp from UTC

> Supported in: Batch, Faster, Streaming

Converts a timestamp from UTC to a given time zone.

**Expression categories:** Datetime

## Declared arguments

* **Time zone:** Target time zone. Will take daylight savings into account for cities, but not for three digit codes.<br>*TimeZone*
* **Timestamp:** Timestamp column.<br>*Expression\<Timestamp>*

**Output type:** *Timestamp*

## Examples

### Example 1: Base case

**Argument values:**

* **Time zone:** Australia/Sydney
* **Timestamp:** 2020-04-28T10:09:00Z

**Output:** 2020-04-28T20:09:00Z

***

### Example 2: Base case

**Argument values:**

* **Time zone:** EST
* **Timestamp:** 2020-04-28T10:09:00Z

**Output:** 2020-04-28T05:09:00Z

***

### Example 3: Base case

**Argument values:**

* **Time zone:** America/Denver
* **Timestamp:** 2020-04-28T10:09:00Z

**Output:** 2020-04-28T04:09:00Z

***

### Example 4: Base case

**Argument values:**

* **Time zone:** America/Denver
* **Timestamp:** 2020-02-09T10:09:00Z

**Output:** 2020-02-09T03:09:00Z

***

### Example 5: Base case

**Argument values:**

* **Time zone:** UTC
* **Timestamp:** 2020-04-28T10:09:00Z

**Output:** 2020-04-28T10:09:00Z

***

### Example 6: Base case

**Argument values:**

* **Time zone:** EST
* **Timestamp:** 2020-01-28T10:09:00Z

**Output:** 2020-01-28T05:09:00Z

***

### Example 7: Null case

**Argument values:**

* **Time zone:** UTC
* **Timestamp:** *null*

**Output:** *null*

***
