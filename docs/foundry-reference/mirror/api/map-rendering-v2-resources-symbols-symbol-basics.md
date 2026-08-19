<!-- source: https://palantir.com/docs/foundry/api/map-rendering-v2-resources/symbols/symbol-basics/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Symbol basics

Loads a PNG format icon with the provided ID, resizing it if requested.
This endpoint has the following features that make it more easily usable from browsers:
  - Respects the If-None-Match etag header, returning 304 if the icon is unchanged.
  - Will use a PALANTIR_TOKEN cookie if no authorization header was provided.
  - Returns Cache-Control and Content-Type headers.
