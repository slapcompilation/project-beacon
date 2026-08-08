<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/timestampToEpochSecondsV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Timestamp to epoch seconds

> Supported in: Batch, Faster, Streaming

Converts from timestamp in UTC to epoch seconds.

**Expression categories:** Cast, Datetime

## Declared arguments

* **Timestamp:** Timestamp to convert to epoch seconds.<br>*Expression\<Timestamp>*

**Output type:** *Long*

## Examples

### Example 1: Base case

**Argument values:**

* **Timestamp:** 2022-10-01T09:01:13.47Z

**Output:** 1664614873

***

### Example 2: Null case

**Argument values:**

* **Timestamp:** *null*

**Output:** *null*

***
