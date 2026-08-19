<!-- source: https://palantir.com/docs/foundry/api/media-sets-v2-resources/media-sets/get-media-item-reference/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Media Item Reference

`GET /api/v2/mediasets/{mediaSetRid}/items/{mediaItemRid}/reference`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets the [media reference](/docs/foundry/data-integration/media-sets/#media-references) for this media item.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-read`.

Scopes: `api:mediasets-read`

## Path parameters

- `mediaSetRid` · string · required
  "The RID of the media set."
- `mediaItemRid` · string · required
  "The RID of the media item."

## Query parameters

- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Response

- `MediaReference` · object · required
  "The representation of a media reference."
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
