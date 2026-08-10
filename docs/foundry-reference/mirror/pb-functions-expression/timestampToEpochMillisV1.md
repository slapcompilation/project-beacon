<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/timestampToEpochMillisV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Timestamp to epoch millis

> Supported in: Batch, Faster, Streaming

Converts from timestamp in UTC to epoch milliseconds.

**Expression categories:** Cast, Datetime

## Declared arguments

* **Timestamp:** Timestamp to convert to epoch milliseconds.<br>*Expression\<Timestamp>*

**Output type:** *Long*

## Examples

### Example 1: Base case

**Argument values:**

* **Timestamp:** 2022-10-01T09:00:00Z

**Output:** 1664614800000

***

### Example 2: Null case

**Argument values:**

* **Timestamp:** *null*

**Output:** *null*

***
