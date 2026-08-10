<!-- source: https://palantir.com/docs/foundry/pb-functions-expression/convertLegacyOffsetDateTimeV1/ · mirrored 2026-08-07 from Palantir Foundry docs -->

# Convert legacy OffsetDateTime

> Supported in: Batch

Converts a legacy OffsetDateTime column to a timestamp that can be used in all Foundry pipelines. The timestamp is returned in UTC.

**Expression categories:** Datetime

## Declared arguments

* **Expression:** *no description*<br>*Expression\<Struct\<timestamp:Timestamp, offset:Integer>>*

**Output type:** *Timestamp*
