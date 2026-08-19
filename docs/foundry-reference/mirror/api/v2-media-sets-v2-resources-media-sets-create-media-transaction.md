<!-- source: https://palantir.com/docs/foundry/api/v2/media-sets-v2-resources/media-sets/create-media-transaction/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Media Transaction

`POST /api/v2/mediasets/{mediaSetRid}/transactions`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Creates a new transaction. Items uploaded to the media set while this transaction is open will not be reflected until the transaction is committed.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-write`.

Scopes: `api:mediasets-write`

## Path parameters

- `mediaSetRid` · string · required
  "The Resource Identifier (RID) of a Media Set in Foundry."

## Query parameters

- `branchName` · string
  "The branch on which to open the transaction. Defaults to `master` for most enrollments."
- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."

## Response

- `TransactionId` · string · required
  "An identifier which represents a transaction on a media set."
