<!-- source: https://palantir.com/docs/foundry/api/v2/media-sets-v2-resources/media-sets/read-media-item/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Read Media Item

`GET /api/v2/mediasets/{mediaSetRid}/items/{mediaItemRid}/content`

Gets the content of a media item.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-read`.

Scopes: `api:mediasets-read`

## Path parameters

- `mediaSetRid` · string · required
  "The Resource Identifier (RID) of a Media Set in Foundry."
- `mediaItemRid` · string · required
  "The Resource Identifier (RID) of an individual Media Item within a Media Set in Foundry."

## Response

- `body` · string · required
  "The content stream."
