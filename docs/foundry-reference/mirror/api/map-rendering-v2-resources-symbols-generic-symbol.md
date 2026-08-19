<!-- source: https://palantir.com/docs/foundry/api/map-rendering-v2-resources/symbols/generic-symbol/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Generic Symbol

`GET /api/v2/mapRendering/symbols/{symbolId}/generic`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:map-read`.

Scopes: `api:map-read`

## Path parameters

- `symbolId` · string · required
  "Unique identifier for a symbol that can be used to fetch the symbol as a PNG using loadGenericSymbol endpoint. The ID is opaque and not meant to be parsed in any way."

## Query parameters

- `size` · integer · required
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `body` · string · required

## Errors

- `GenericSymbolPermissionDenied` (PERMISSION_DENIED) — "Could not generic the Symbol."
