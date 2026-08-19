<!-- source: https://palantir.com/docs/foundry/api/media-sets-v2-resources/media-sets/get-media-item-info/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Media Item Info

`GET /api/v2/mediasets/{mediaSetRid}/items/{mediaItemRid}`

Gets information about the media item.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-read`.

Scopes: `api:mediasets-read`

## Path parameters

- `mediaSetRid` · string · required
  "The RID of the media set."
- `mediaItemRid` · string · required
  "The RID of the media item."

## Response

- `GetMediaItemInfoResponse` · object · required
  - `viewRid` · string · required
    "The Resource Identifier (RID) of a single View of a Media Set. A Media Set View is an independent collection of Media Items."
  - `path` · string
    "A user-specified identifier for a media item within a media set. Paths must be less than 256 characters long. If multiple items are written to the same media set at the same path, then when retrieving by path the media item which was written last is returned."
  - `logicalTimestamp` · string · required
    "A number representing a logical ordering to be used for transactions, etc. This can be interpreted as a timestamp in microseconds, but may differ slightly from system clock time due to clock drift and slight adjustments for the sake of ordering. Only positive timestamps (representing times after epoch) are supported."
  - `attribution` · object
    - `creatorId` · string · required
      "A Foundry User ID."
    - `creationTimestamp` · string · required
      "The timestamp when the media item was created, in ISO 8601 timestamp format."
  - `originallyUploadedFileMimeType` · string
    "The [media type](https://www.iana.org/assignments/media-types/media-types.xhtml) of the file or attachment. Examples: `application/json`, `application/pdf`, `application/octet-stream`, `image/jpeg`"
  - `mimeType` · string
    "The [media type](https://www.iana.org/assignments/media-types/media-types.xhtml) of the file or attachment. Examples: `application/json`, `application/pdf`, `application/octet-stream`, `image/jpeg`"
  - `sizeBytes` · integer
    "The size of the media item in bytes."
