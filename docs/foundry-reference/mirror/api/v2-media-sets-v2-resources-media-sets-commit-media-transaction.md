<!-- source: https://palantir.com/docs/foundry/api/v2/media-sets-v2-resources/media-sets/commit-media-transaction/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Commit Media Transaction

`POST /api/v2/mediasets/{mediaSetRid}/transactions/{transactionId}/commit`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Commits an open transaction. On success, items uploaded to the media set during this transaction will become available.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-write`.

Scopes: `api:mediasets-write`

## Path parameters

- `mediaSetRid` · string · required
  "The Resource Identifier (RID) of a Media Set in Foundry."
- `transactionId` · string · required
  "An identifier which represents a transaction on a media set."

## Query parameters

- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."
