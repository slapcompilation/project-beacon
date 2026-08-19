<!-- source: https://palantir.com/docs/foundry/api/models-v2-resources/model-studios/launch-model-studio/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Launch Model Studio

`POST /api/v2/models/modelStudios/{modelStudioRid}/launch`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Launches a new training run for the Model Studio using the latest configuration version.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-write`.

Scopes: `api:models-write`

## Path parameters

- `modelStudioRid` · string · required
  "The Resource Identifier (RID) of a Model Studio."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ModelStudioRun` · object · required
  - `runId` · string · required
    "A unique identifier for this run, derived from the studio, config, and build."
  - `buildRid` · string · required
    "The RID of the build associated with this run."
  - `jobRid` · string · required
    "The RID of the job associated with this run."
  - `configVersion` · integer · required
    "The configuration version used for this run."
  - `startedBy` · string · required
    "The user who started this run."
  - `startedTime` · string · required
    "When this run was started."
  - `buildStatus` · enum
    one of `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`
    "Status of the build."
  - `resolvedOutputs` · map
    "Map of alias to resolved output details (e.g., for models, contains the version RID and experiment)."
    - `OutputAlias` · string · required
      "A string alias used to identify outputs in a Model Studio configuration."
    - `ModelStudioRunOutput` · union · required
      "Resolved output details for a Model Studio run."
      - `model` · object
        "Resolved model output details for a Model Studio run."
        - `modelRid` · string · required
          "The RID of the model."
        - `modelVersionRid` · string · required
          "The RID of the model version created by this run."
        - `experimentRid` · string
          "The RID of the experiment associated with this run, if any."

## Errors

- `ModelStudioNotFound` (NOT_FOUND) — "The requested Model Studio was not found."
- `LaunchModelStudioPermissionDenied` (PERMISSION_DENIED) — "Could not launch the ModelStudio."
