<!-- source: https://palantir.com/docs/foundry/api/media-sets-v2-resources/media-sets/register-media-item/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Register Media Item

`POST /api/v2/mediasets/{mediaSetRid}/items/register`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Registers a media item that currently resides in a federated media store. Registration will validate the item
against the media set's schema and perform initial metadata extraction.
This endpoint is only applicable for federated media sets.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-write`.

Scopes: `api:mediasets-write`

## Path parameters

- `mediaSetRid` · string · required
  "The Resource Identifier (RID) of a Media Set in Foundry."

## Query parameters

- `branchName` · string
  "Specifies the specific branch by name to which this media item will be registered."
- `viewRid` · string
  "Specifies the specific view by rid to which this media item will be registered."
- `transactionId` · string
  "The id of the transaction associated with this request. Required for transactional media sets."
- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Request

- `RegisterMediaItemRequest` · object · required
  "Request to register a media item from a federated store."
  - `physicalItemName` · string · required
    "The relative path within the federated media store where the media item exists."
  - `mediaItemPath` · string
    "A user-specified identifier for a media item within a media set. Paths must be less than 256 characters long. If multiple items are written to the same media set at the same path, then when retrieving by path the media item which was written last is returned."

## Response

- `RegisterMediaItemResponse` · object · required
  "Response after successfully registering a media item."
  - `mediaItemRid` · string · required
    "The Resource Identifier (RID) of an individual Media Item within a Media Set in Foundry."
  - `mediaType` · string · required
    "The [media type](https://www.iana.org/assignments/media-types/media-types.xhtml) of the file or attachment. Examples: `application/json`, `application/pdf`, `application/octet-stream`, `image/jpeg`"
