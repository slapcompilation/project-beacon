<!-- source: https://palantir.com/docs/foundry/api/v2/data-health-v2-resources/checks/delete-check/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Delete Check

`DELETE /api/v2/dataHealth/checks/{checkRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Delete the Check with the specified rid.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:data-health-write`.

Scopes: `api:data-health-write`

## Path parameters

- `checkRid` · string · required
  "The unique resource identifier (RID) of a Data Health Check."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Errors

- `DeleteCheckPermissionDenied` (PERMISSION_DENIED) — "Could not delete the Check."
- `CheckNotFound` (NOT_FOUND) — "The given Check could not be found."
