<!-- source: https://palantir.com/docs/foundry/api/media-sets-v2-resources/media-sets/read-original-media-item/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Read Original Media Item

`GET /api/v2/mediasets/{mediaSetRid}/items/{mediaItemRid}/original`

Gets the content of an original file uploaded to the media item, even if it was transformed on upload due to being an additional input format.


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
