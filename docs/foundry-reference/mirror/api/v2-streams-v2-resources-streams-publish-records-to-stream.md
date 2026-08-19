<!-- source: https://palantir.com/docs/foundry/api/v2/streams-v2-resources/streams/publish-records-to-stream/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Publish Records To Stream

`POST /api/v2/highScale/streams/datasets/{datasetRid}/streams/{streamBranchName}/publishRecords`

Publish a batch of records to the stream. The records will be validated against the stream's schema, and
the batch will be rejected if one or more of the records are invalid.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:streams-write`.

Scopes: `api:streams-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `streamBranchName` · string · required
  "The name of a Branch."

## Request

- `PublishRecordsToStreamRequest` · object · required
  - `records` · list
    "The records to publish to the stream"
    - `Record` · map · required
      "A record to be published to a stream."
  - `viewRid` · string
    "If provided, this endpoint will only write to the stream corresponding to the specified view RID. If not provided, this endpoint will write to the latest stream on the branch. Providing this value is an advanced configuration, to be used when additional control over the underlying streaming data structures is needed."

## Errors

- `PublishRecordsToStreamPermissionDenied` (PERMISSION_DENIED) — "Could not publishRecords the Stream."
