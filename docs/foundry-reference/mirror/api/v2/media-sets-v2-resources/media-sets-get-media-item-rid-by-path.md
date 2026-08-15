<!-- source: https://palantir.com/docs/foundry/api/v2/media-sets-v2-resources/media-sets/get-media-item-rid-by-path/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Media Item Rid By Path

`GET /api/v2/mediasets/{mediaSetRid}/items/getRidByPath`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Returns the media item RID for the media item with the specified path.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-read`.

Scopes: `api:mediasets-read`

## Path parameters

- `mediaSetRid` · string · required
  "The RID of the media set."

## Query parameters

- `mediaItemPath` · string · required
  "The path of the media item."
- `branchName` · string
  "Specifies the specific branch by name in which to search for this media item. May not be provided if branch rid or view rid are provided."
- `branchRid` · string
  "Specifies the specific branch by rid in which to search for this media item. May not be provided if branch name or view rid are provided."
- `viewRid` · string
  "Specifies the specific view by rid in which to search for this media item. May not be provided if branch name or branch rid are provided."
- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Response

- `GetMediaItemRidByPathResponse` · object · required
  - `mediaItemRid` · string
    "The Resource Identifier (RID) of an individual Media Item within a Media Set in Foundry."
