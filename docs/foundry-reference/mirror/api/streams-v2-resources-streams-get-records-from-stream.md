<!-- source: https://palantir.com/docs/foundry/api/streams-v2-resources/streams/get-records-from-stream/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Records From Stream

`GET /api/v2/highScale/streams/datasets/{datasetRid}/streams/{streamBranchName}/getRecords`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get a batch of records from a stream for a given partition. Offsets are ordered from [0, inf) but may be sparse (e.g.: 0, 2, 3, 5).
Binary field values are returned as base64-encoded strings. Decode them to retrieve the original bytes.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:streams-read`.

Scopes: `api:streams-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `streamBranchName` · string · required
  "The name of a Branch."

## Query parameters

- `viewRid` · string
  "If provided, this endpoint will only read from the stream corresponding to the specified view RID. If not provided, this endpoint will read from the latest stream on the branch. Providing this value is an advanced configuration, to be used when additional control over the underlying streaming data structures is needed."
- `partitionId` · string · required
  "The ID of the partition to retrieve records from."
- `startOffset` · string
  "The inclusive beginning of the range to be retrieved. Leave empty when reading from the beginning of the partition."
- `limit` · integer · required
  "The total number of records to be retrieved. The response may contain fewer records than requested depending on number of records in the partition and server-defined limits."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `GetRecordsResponse` · list · required
  "A list of records from a stream with their offsets."
  - `RecordWithOffset` · object · required
    "A record retrieved from a stream, including its offset within the partition."
    - `offset` · string · required
      "The offset of the record within the partition."
    - `value` · map
      "The record value as a map of field names to values."

## Errors

- `GetRecordsFromStreamPermissionDenied` (PERMISSION_DENIED) — "Could not getRecords the Stream."
