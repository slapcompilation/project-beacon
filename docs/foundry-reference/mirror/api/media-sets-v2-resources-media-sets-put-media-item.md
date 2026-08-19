<!-- source: https://palantir.com/docs/foundry/api/media-sets-v2-resources/media-sets/put-media-item/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Put Media Item

`POST /api/v2/mediasets/{mediaSetRid}/items`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Uploads a media item to an existing media set.
The body of the request must contain the binary content of the file and the `Content-Type` header must be `application/octet-stream`.
A branch name, or branch rid, or view rid may optionally be specified.  If none is specified, the item will be uploaded to the default branch. If more than one is specified, an error is thrown.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-write`.

Scopes: `api:mediasets-write`

## Path parameters

- `mediaSetRid` · string · required
  "The Resource Identifier (RID) of a Media Set in Foundry."

## Query parameters

- `mediaItemPath` · string
  "An identifier for a media item within a media set. Necessary if the backing media set requires paths."
- `branchName` · string
  "Specifies the specific branch by name to which this media item will be uploaded. May not be provided if branch rid or view rid are provided."
- `branchRid` · string
  "Specifies the specific branch by rid to which this media item will be uploaded. May not be provided if branch name or view rid are provided."
- `viewRid` · string
  "Specifies the specific view by rid to which this media item will be uploaded. May not be provided if branch name or branch rid are provided."
- `transactionId` · string
  "The id of the transaction associated with this request.  Required if this is a transactional media set."
- `mediaItemRid` · string
  "An optional RID to use for the media item to create. If omitted, the server will automatically generate a RID. In most cases, the server-generated RID should be preferred; only specify a custom RID if your workflow strictly requires deterministic or client-controlled identifiers. The RID must be in the format of `ri.mio.<instance>.media-item.<UUID>`, where `<instance>` is the same as the instance part of the media set RID, and `<UUID>` is a UUID. An `InvalidMediaItemRid` error will be thrown if the RID is not in the expected format. A `MediaItemRidAlreadyExists` error will be thrown if the media set already contains a media item with the same RID."
- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Request

- `body` · string · required

## Response

- `PutMediaItemResponse` · object · required
  - `mediaItemRid` · string · required
    "The Resource Identifier (RID) of an individual Media Item within a Media Set in Foundry."
  - `mediaSetViewRid` · string · required
    "The Resource Identifier (RID) of a single View of a Media Set. A Media Set View is an independent collection of Media Items."
