<!-- source: https://palantir.com/docs/foundry/api/v2/notepad-v2-resources/files/content-file/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Content File

`GET /api/v2/notepad/files/{fileRid}/content`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Download file content.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:notepad-export`.

Scopes: `api:notepad-export`

## Path parameters

- `fileRid` · string · required
  "The unique identifier for a File"

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `body` · string · required

## Errors

- `ContentFilePermissionDenied` (PERMISSION_DENIED) — "Could not content the File."
