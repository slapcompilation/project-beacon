<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/markings/parse-classifications/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Parse Classifications

`POST /api/v2/admin/markings/parseClassifications`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Parses classification marking strings (e.g. 'S//NF') into their component marking IDs. Strings that cannot be parsed are returned in 'errors' with a human-readable message.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `ParseClassificationsRequest` · object · required
  - `classificationStrings` · list
    "The classification strings to parse, e.g. 'S//NF'. Duplicate entries are ignored. At most 1000 entries are accepted."

## Response

- `ParseClassificationsResponse` · object · required
  - `parsed` · map
    "Map of valid classification strings to their component marking IDs. Strings that could not be parsed are absent from this map and appear in 'errors' instead."
    - `array` · list · required
      - `MarkingId` · string · required
        "The ID of a security marking."
  - `errors` · map
    "Map of classification strings that could not be parsed to a human-readable error message."

## Errors

- `ParseClassificationsPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to parse the given classification strings."
- `CbacUnavailable` (INVALID_ARGUMENT) — "CBAC is not available."
