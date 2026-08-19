<!-- source: https://palantir.com/docs/foundry/api/v2/streams-v2-resources/streams/publish-binary-record-to-stream/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Publish Binary Record To Stream

`POST /api/v2/highScale/streams/datasets/{datasetRid}/streams/{streamBranchName}/publishBinaryRecord`

Publish a single binary record to the stream. The stream's schema must be a single binary field.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:streams-write`.

Scopes: `api:streams-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `streamBranchName` · string · required
  "The name of a Branch."

## Query parameters

- `viewRid` · string
  "If provided, this endpoint will only write to the stream corresponding to the specified view RID. If not provided, this endpoint will write to the latest stream on the branch. Providing this value is an advanced configuration, to be used when additional control over the underlying streaming data structures is needed."

## Request

- `body` · string · required
  "The binary record to publish to the stream"

## Errors

- `PublishBinaryRecordToStreamPermissionDenied` (PERMISSION_DENIED) — "Could not publishBinaryRecord the Stream."
