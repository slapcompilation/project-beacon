<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/stringToTimestampV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert a string to timestamp

> Supported in: Batch, Faster, Streaming

Returns the timestamp given a formatted string in accordance to the Java DateTimeFormatter. The default formats are `yyyy-MM-dd'T'HH:mm:ss.SSSXXX` and `yyyy-MM-dd`. The formats are run in order, the first matching format will be returned.

**Expression categories:** Cast, Datetime

## Declared arguments

* **String:** String column to convert to timestamp.<br>*Expression\<String>*
* *optional* **Formats:** Format defaults to ISO8601 `yyyy-MM-dd'T'HH:mm:ss.SSSXXX` and `yyyy-MM-dd`.<br>*List\<Literal\<String>>*
* *optional* **Time zone:** Used to parse formats that do not include a timezone. If the format also includes a zone, this parameter will override it - see examples for details.<br>*TimeZone*

**Output type:** *Timestamp*

## Examples

### Example 1: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd'T'HH\:mm:ss.SSSSSSX]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2020-04-28T01:30:02.005110Z | 2020-04-28T01:30:02.00511Z |

***

### Example 2: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** *null*
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2020-04-28T01:30:02.005Z | 2020-04-28T01:30:02.005Z |

***

### Example 3: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** *null*
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2020-04-28 | 2020-04-28T00:00:00Z |

***

### Example 4: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[dd-yyyy-MM HH\:mm:ss, yyyy-MM-dd]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 28-2020-04 10:09:00 | 2020-04-28T10:09:00Z |
| 2020-04-28 | 2020-04-28T00:00:00Z |

***

### Example 5: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-DDD HH\:mm:ss]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-334 10:09:00 | 2022-11-30T10:09:00Z |

***

### Example 6: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[dd MMMM yyyy HH\:mm:ss]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 30 November 2022 10:09:00 | 2022-11-30T10:09:00Z |

***

### Example 7: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd h\:mm:ss a]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-30 1:30:00 PM | 2022-11-30T13:30:00Z |

***

### Example 8: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd HH\:m:ss]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-30 13:9:00 | 2022-11-30T13:09:00Z |

***

### Example 9: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[dd-MMM-yyyy HH\:mm:ss]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 30-Nov-2022 10:09:00 | 2022-11-30T10:09:00Z |

***

### Example 10: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-DDD]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-334 | 2022-11-30T00:00:00Z |

***

### Example 11: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd HH\:mm:s]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-30 13:09:0 | 2022-11-30T13:09:00Z |

***

### Example 12: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yy-MM-dd HH\:mm:ss]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 22-11-30 10:09:00 | 2022-11-30T10:09:00Z |

***

### Example 13: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[dd-MMM-yyyy HH\:mm:ss]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 01-Nov-2023 10:09:00 | 2023-11-01T10:09:00Z |

***

### Example 14: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[dd-MMM-yyyy HH\:mm:ss]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 01-NOV-2023 10:09:00 | 2023-11-01T10:09:00Z |

***

### Example 15: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd HH\:mm:ss z]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-30 10:09:00 PST | 2022-11-30T18:09:00Z |

***

### Example 16: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd'T'HH\:mm:ss.SSS;z]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-29T09:50:04.187;EST | 2022-11-29T14:50:04.187Z |

***

### Example 17: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd'T'HH\:mm:ss.SSSXXX]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-29T09:50:04.187-05:00 | 2022-11-29T14:50:04.187Z |

***

### Example 18: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[dd-yyyy-MM HH\:mm:ss]
* **Time zone:** Australia/Sydney

| timestamp | **Output** |
| ----- | ----- |
| 28-2020-04 04:12:00 | 2020-04-28T04:12:00+10:00 |

***

### Example 19: Base case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[dd-yyyy-MM HH\:mm:ss]
* **Time zone:** +10

| timestamp | **Output** |
| ----- | ----- |
| 28-2020-04 04:12:00 | 2020-04-28T04:12:00+10:00 |

***

### Example 20: Null case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[dd-yyyy-MM HH\:mm:ss, yyyy-MM-dd]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 202021-04-28 | *null* |

***

### Example 21: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd'T'HH\:mm:ss.SSS;v]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-29T09:50:04.187;Australia/Sydney | 2022-11-28T22:50:04.187Z |

***

### Example 22: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd'T'HH\:mm:ss.SSS;ZZZ]
* **Time zone:** Australia/Sydney

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-29T09:50:04.187;-0500 | 2022-11-29T03:50:04.187Z |

***

### Example 23: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd'T'HH\:mm:ss.SSS;z]
* **Time zone:** Australia/Sydney

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-29T09:50:04.187;EST | 2022-11-28T22:50:04.187Z |

***

### Example 24: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd hh\:mm:ss a]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-30 10:09:00 AM | 2022-11-30T10:09:00Z |

***

### Example 25: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd hh\:mm:ss a]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-30 10:09:00 PM | 2022-11-30T22:09:00Z |

***

### Example 26: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyyDDD]
* **Time zone:** UTC

| timestamp | **Output** |
| ----- | ----- |
| 2023010 | 2023-01-10T00:00:00Z |

***

### Example 27: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyyDDD]
* **Time zone:** EST

| timestamp | **Output** |
| ----- | ----- |
| 2023010 | 2023-01-10T05:00:00Z |

***

### Example 28: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyyDDD]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2023010 | 2023-01-10T00:00:00Z |

***

### Example 29: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyyMMddHHmmss]
* **Time zone:** UTC

| timestamp | **Output** |
| ----- | ----- |
| 20230110000000 | 2023-01-10T00:00:00Z |

***

### Example 30: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyyMMddHHmmss]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 20230110000000 | 2023-01-10T00:00:00Z |

***

### Example 31: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd'T'HH\:mm:ss.SSSXXX;z]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2022-11-29T09:50:04.187Z;EST | 2022-11-29T09:50:04.187Z |

***

### Example 32: Edge case

**Argument values:**

* **String:** `timestamp`
* **Formats:** \[yyyy-MM-dd'T'HH\:mm:ss.SSSSSSX]
* **Time zone:** *null*

| timestamp | **Output** |
| ----- | ----- |
| 2020-04-28T01:30:02.005112Z | 2020-04-28T01:30:02.005112Z |

***
