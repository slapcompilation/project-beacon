<!-- source: https://palantir.com/docs/foundry/api/v2/streams-v2-resources/streams/get-end-offsets-for-stream/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get End Offsets For Stream

`GET /api/v2/highScale/streams/datasets/{datasetRid}/streams/{streamBranchName}/getEndOffsets`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the end offsets for all partitions of a stream. The end offset is the offset of the next record that will be written to the partition.


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
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `GetEndOffsetsResponse` · map · required
  "The end offsets for each partition of a stream."
  - `PartitionId` · string · required
    "The identifier for a partition of a Foundry stream."

## Errors

- `GetEndOffsetsForStreamPermissionDenied` (PERMISSION_DENIED) — "Could not getEndOffsets the Stream."
