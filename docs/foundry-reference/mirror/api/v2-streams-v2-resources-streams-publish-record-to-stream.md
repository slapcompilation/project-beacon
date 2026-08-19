<!-- source: https://palantir.com/docs/foundry/api/v2/streams-v2-resources/streams/publish-record-to-stream/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Publish Record To Stream

`POST /api/v2/highScale/streams/datasets/{datasetRid}/streams/{streamBranchName}/publishRecord`

Publish a single record to the stream. The record will be validated against the stream's schema, and
rejected if it is invalid.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:streams-write`.

Scopes: `api:streams-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `streamBranchName` · string · required
  "The name of a Branch."

## Request

- `PublishRecordToStreamRequest` · object · required
  - `record` · map
    "The record to publish to the stream"
  - `viewRid` · string
    "If provided, this endpoint will only write to the stream corresponding to the specified view RID. If not provided, this endpoint will write the latest stream on the branch. Providing this value is an advanced configuration, to be used when additional control over the underlying streaming data structures is needed."

## Errors

- `PublishRecordToStreamPermissionDenied` (PERMISSION_DENIED) — "Could not publishRecord the Stream."
