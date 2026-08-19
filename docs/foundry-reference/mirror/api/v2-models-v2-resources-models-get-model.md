<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/models/get-model/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Model

`GET /api/v2/models/{modelRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Retrieves a Model by its Resource Identifier (RID).

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelRid` · string · required
  "The Resource Identifier (RID) of a Model."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `Model` · object · required
  - `rid` · string · required
    "The Resource Identifier (RID) of a Model."

## Errors

- `ModelNotFound` (NOT_FOUND) — "The given Model could not be found."
