<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/model-studios/get-model-studio/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Model Studio

`GET /api/v2/models/modelStudios/{modelStudioRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets details about a Model Studio by its RID.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelStudioRid` · string · required
  "The Resource Identifier (RID) of a Model Studio."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ModelStudio` · object · required
  - `rid` · string · required
    "The Resource Identifier (RID) of a Model Studio."
  - `folderRid` · string · required
    "The parent folder containing this Model Studio."
  - `createdTime` · string · required
    "The time at which the resource was created."

## Errors

- `ModelStudioNotFound` (NOT_FOUND) — "The given ModelStudio could not be found."
