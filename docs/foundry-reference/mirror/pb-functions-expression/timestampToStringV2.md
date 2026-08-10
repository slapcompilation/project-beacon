<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/timestampToStringV2/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Format timestamp as string

> Supported in: Batch, Faster, Streaming

Returns the timestamp as a formatted string (ISO8601 by default).

**Expression categories:** Cast, Datetime, String

## Declared arguments

* **Timestamp:** The timestamp to convert to a string.<br>*Expression\<Timestamp>*
* *optional* **Format:** The format to use, defaults to ISO8601 with a zone offset.<br>*Literal\<String>*
* *optional* **Time zone:** Defaults to UTC.<br>*TimeZone*

**Output type:** *String*

## Examples

### Example 1: Base case

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z
* **Format:** yyyy-MM-dd
* **Time zone:** *null*

**Output:** 2022-10-01

***

### Example 2: Base case

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z
* **Format:** yyyy-MM-dd-HH-mm-ss
* **Time zone:** BST

**Output:** 2022-10-01-15-00-00

***

### Example 3: Base case

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z
* **Format:** yyyy-MM-dd-hh-mm-ssXXX
* **Time zone:** CET

**Output:** 2022-10-01-11-00-00+02:00

***

### Example 4: Base case

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z
* **Format:** yyyy-MM-dd-HH-mm-ss
* **Time zone:** EST

**Output:** 2022-10-01-04-00-00

***

### Example 5: Base case

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z
* **Format:** yyyy-MM-dd-hh-mm-ssXXX
* **Time zone:** Europe/London

**Output:** 2022-10-01-10-00-00+01:00

***

### Example 6: Base case

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z
* **Format:** yyyy-MM-dd-HH-mm-ss
* **Time zone:** Etc/UTC

**Output:** 2022-10-01-09-00-00

***

### Example 7: Null case

**Argument values:**

* **Timestamp:** *null*
* **Format:** yyyy-MM-dd
* **Time zone:** UTC

**Output:** *null*

***

### Example 8: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm XXXX
* **Time zone:** EST

**Output:** 10-00 -0500

***

### Example 9: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm X
* **Time zone:** EST

**Output:** 10-00 -05

***

### Example 10: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm X
* **Time zone:** *null*

**Output:** 15-00 Z

***

### Example 11: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm O
* **Time zone:** EST

**Output:** 10-00 GMT-5

***

### Example 12: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm-ss-SS
* **Time zone:** *null*

**Output:** 15-00-01-00

***

### Example 13: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm v
* **Time zone:** EST

**Output:** 10-00 -05:00

***

### Example 14: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm z
* **Time zone:** EST

**Output:** 10-00 -05:00

***

### Example 15: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z
* **Format:** hh-mm-a
* **Time zone:** *null*

**Output:** 09-00-AM

***

### Example 16: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z
* **Format:** KK-mm-a
* **Time zone:** *null*

**Output:** 09-00-AM

***

### Example 17: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:00Z
* **Format:** kk-mm-a
* **Time zone:** *null*

**Output:** 15-00-PM

***

### Example 18: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:00Z
* **Format:** HH-mm-a
* **Time zone:** *null*

**Output:** 15-00-PM

***

### Example 19: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm xxxx
* **Time zone:** EST

**Output:** 10-00 -0500

***

### Example 20: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm x
* **Time zone:** EST

**Output:** 10-00 -05

***

### Example 21: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm x
* **Time zone:** *null*

**Output:** 15-00 +00

***

### Example 22: Edge case

**Argument values:**

* **Timestamp:** 2022-10-01T15:00:01Z
* **Format:** HH-mm Z
* **Time zone:** EST

**Output:** 10-00 -0500

***
