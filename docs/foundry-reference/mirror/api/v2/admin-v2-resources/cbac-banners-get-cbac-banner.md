<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/cbac-banners/get-cbac-banner/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Cbac Banner

`GET /api/v2/admin/cbacBanner`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Returns a classification banner string and colors for the given set of marking IDs.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Query parameters

- `displayType` · enum
  one of `BANNER_LINE`, `PORTION_MARKING`
  "The display type of the banner. Defaults to PORTION_MARKING. BANNER_LINE is the long classification string used in the header of a document; PORTION_MARKING is a short classification string used for individual paragraphs"
- `markingIds` · list
  "The marking IDs for which to generate a banner."
  - `MarkingId` · string · required
    "The ID of a security marking."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `CbacBanner` · object · required
  - `classificationString` · string · required
  - `markings` · list
    - `MarkingId` · string · required
      "The ID of a security marking."
  - `textColor` · string · required
    "The hex value of a color."
  - `backgroundColors` · list
    - `Color` · string · required
      "The hex value of a color."

## Errors

- `GetCbacBannerPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to get the CBAC banner for the markings."
- `CbacUnavailable` (INVALID_ARGUMENT) — "CBAC is not available."
- `UnknownClassificationBannerDisplayType` (INVALID_ARGUMENT) — "The provided classification banner display type is not recognized."
- `CbacBannerNotFound` (NOT_FOUND) — "The given CbacBanner could not be found."
