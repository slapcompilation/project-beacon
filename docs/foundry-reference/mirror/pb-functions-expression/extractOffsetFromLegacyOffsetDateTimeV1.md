<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/extractOffsetFromLegacyOffsetDateTimeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Extract offset from legacy OffsetDateTime

> Supported in: Batch

Extracts the offset from a legacy OffsetDateTime column. This is the offset in seconds of the origin timezone of the timestamp from UTC timezone.

**Expression categories:** Datetime

## Declared arguments

* **Expression:** The legacy OffsetDateTime column.<br>*Expression\<Struct\<timestamp:Timestamp, offset:Integer>>*

**Output type:** *Integer*

## Examples

### Example 1: Base case

**Argument values:**

* **Expression:** `col_a`

| col\_a | **Output** |
| ----- | ----- |
| {<br> **offset**: 0,<br> **timestamp**: 2024-09-09T09:00:00.001Z,<br>} | 0 |
| {<br> **offset**: 19800,<br> **timestamp**: 2024-09-09T09:00:00.001Z,<br>} | 19800 |
| {<br> **offset**: -3600,<br> **timestamp**: 2024-09-09T09:00:00.001Z,<br>} | -3600 |

***

### Example 2: Null case

**Argument values:**

* **Expression:** `col_a`

| col\_a | **Output** |
| ----- | ----- |
| *null* | *null* |
| {<br> **offset**: 19800,<br> **timestamp**: *null*,<br>} | 19800 |
| {<br> **offset**: *null*,<br> **timestamp**: 2024-09-09T09:00:00.001Z,<br>} | 0 |

***
