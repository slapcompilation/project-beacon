<!-- source: https://palantir.com/docs/foundry/api/v2/media-sets-v2-resources/media-sets/get-media-set/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Media Set

`GET /api/v2/mediasets/{mediaSetRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets information about the media set.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-read`.

Scopes: `api:mediasets-read`

## Path parameters

- `mediaSetRid` · string · required
  "The Resource Identifier (RID) of a Media Set in Foundry."

## Query parameters

- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Response

- `GetMediaSetResponse` · object · required
  "Information about a media set."
  - `rid` · string · required
    "The Resource Identifier (RID) of a Media Set in Foundry."
  - `mediaSchema` · enum · required
    one of `AUDIO`, `CAD`, `DICOM`, `DOCUMENT`, `IMAGERY`, `MODEL_3D`, `MULTIMODAL`, `SPREADSHEET`, `STREAMING_VIDEO`, `TILED_RASTER`, `VIDEO`, `EMAIL`
    "The schema type of a media set, indicating what type of media items it can contain."
  - `defaultBranchName` · string · required
    "A name for a media set branch. Valid branch names must be (a) non-empty, (b) less than 256 characters, and (c) not a valid ResourceIdentifier."
  - `transactionPolicy` · union · required
    "The transaction policy for a media set, determining how writes are handled."
    - `batchTransactions` · object
      "All writes must be part of a transaction. Transactions are branch-scoped and created by calling create transaction. Writes are not visible until commit transaction is called."
    - `noTransactions` · object
      "Writes are not part of a transaction and are immediately visible. Calls to create transaction or commit transaction will error."
  - `pathsRequired` · boolean · required
    "Whether media items in this media set require paths."
