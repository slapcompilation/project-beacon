<!-- source: https://palantir.com/docs/foundry/api/v2/media-sets-v2-resources/media-sets/clear-media-item-at-path/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Clear Media Item At Path

`DELETE /api/v2/mediasets/{mediaSetRid}/items/clearAtPath`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Clears (soft-deletes) the media item at the specified path within a media set, making it and all older
media items at that path un-retrievable.

A branch name, branch RID, or view RID may optionally be specified. If none is specified,
the item will be cleared from the default branch. If more than one is specified, an error is thrown.

For transactional media sets, a transaction ID must be provided. The deletion will not be
visible until the transaction is committed.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:mediasets-write`.

Scopes: `api:mediasets-write`

## Path parameters

- `mediaSetRid` · string · required
  "The RID of the media set."

## Query parameters

- `mediaItemPath` · string · required
  "The path of the media item to clear."
- `branchName` · string
  "Specifies the specific branch by name from which this media item will be cleared. May not be provided if branch rid or view rid are provided."
- `branchRid` · string
  "Specifies the specific branch by rid from which this media item will be cleared. May not be provided if branch name or view rid are provided."
- `viewRid` · string
  "Specifies the specific view by rid from which this media item will be cleared. May not be provided if branch name or branch rid are provided."
- `transactionId` · string
  "The ID of the transaction associated with this request. Required if this is a transactional media set."
- `preview` · boolean
  "A boolean flag that, when set to true, enables the use of beta features in preview mode."
