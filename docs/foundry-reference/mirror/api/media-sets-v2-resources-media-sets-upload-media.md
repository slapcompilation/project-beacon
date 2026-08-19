<!-- source: https://palantir.com/docs/foundry/api/media-sets-v2-resources/media-sets/upload-media/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Upload Media

`PUT /api/v2/mediasets/media/upload`

Uploads a temporary media item. If the media item isn't persisted within 1 hour, the item will be deleted. 

If multiple resources are attributed to, usage will be attributed to the first one in the list.

The body of the request must contain the binary content of the file and the `Content-Type` header must be `application/octet-stream`.
Third-party applications using this endpoint via OAuth2 must request the following operation scopes: `api:ontologies-read api:ontologies-write`.

Scopes: `api:ontologies-read`, `api:ontologies-write`

## Query parameters

- `filename` · string · required
  "A user-defined label for a media item within a media set. Required if the backing media set requires paths. Uploading multiple files to the same path will result in only the most recent file being associated with the path."
- `mediaItemRid` · string
  "An optional RID to use for the media item to create. If omitted, the server will automatically generate a RID. In most cases, the server-generated RID should be preferred; only specify a custom RID if your workflow strictly requires deterministic or client-controlled identifiers. The RID must be in the format of `ri.mio.<instance>.media-item.<UUID>`, where `<instance>` is the same as the instance part of the media set RID, and `<UUID>` is a UUID. An `InvalidMediaItemRid` error will be thrown if the RID is not in the expected format. A `MediaItemRidAlreadyExists` error will be thrown if the media set already contains a media item with the same RID."

## Request

- `body` · string · required

## Response

- `MediaReference` · object · required
  "The media reference for the uploaded media."
  - `mimeType` · string · required
    "The [media type](https://www.iana.org/assignments/media-types/media-types.xhtml) of the file or attachment. Examples: `application/json`, `application/pdf`, `application/octet-stream`, `image/jpeg`"
  - `reference` · union · required
    "A union of the types supported by media reference properties."
    - `mediaSetViewItem` · object
      - `mediaSetViewItem` · object · required
        - `mediaSetRid` · string · required
          "The Resource Identifier (RID) of a Media Set in Foundry."
        - `mediaSetViewRid` · string · required
          "The Resource Identifier (RID) of a single View of a Media Set. A Media Set View is an independent collection of Media Items."
        - `mediaItemRid` · string · required
          "The Resource Identifier (RID) of an individual Media Item within a Media Set in Foundry."
        - `token` · string
          "A token that grants access to read specific media items."
