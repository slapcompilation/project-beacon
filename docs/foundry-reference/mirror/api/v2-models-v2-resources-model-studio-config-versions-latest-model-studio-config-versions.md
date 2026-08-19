<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/model-studio-config-versions/latest-model-studio-config-versions/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Latest Model Studio Config Versions

`GET /api/v2/models/modelStudios/{modelStudioRid}/configVersions/latest`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets the latest configuration version for a Model Studio.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelStudioRid` · string · required
  "The Resource Identifier (RID) of a Model Studio."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ModelStudioConfigVersion` · object · required
  - `name` · string · required
    "Human readable name of the configuration version and experiment."
  - `version` · integer · required
    "The version number of this configuration."
  - `trainerId` · string · required
    "The identifier of the trainer to use for this configuration."
  - `trainer` · object · required
    "The trainer and version used for this configuration."
    - `trainerId` · string · required
      "The Resource Identifier (RID) of a trainer."
    - `version` · string · required
  - `workerConfig` · object · required
    "The worker configuration including inputs, outputs, and custom settings."
    - `customConfig` · map
      "Custom configuration matching the trainer's JSON schema."
    - `inputs` · map
      "Input configurations keyed by alias."
      - `InputAlias` · string · required
        "A string alias used to identify inputs in a Model Studio configuration."
      - `ModelStudioInput` · union · required
        "Input specification for a Model Studio configuration."
        - `dataset` · object
          "Dataset input configuration."
          - `rid` · string · required
            "The RID of the input dataset."
          - `columnMapping` · map
            "Mapping of column type spec IDs to column names."
            - `ColumnTypeSpecId` · string · required
              "An identifier for a column type specification."
            - `array` · list · required
              - `ColumnName` · string · required
                "The name of a column in a dataset."
          - `ignoreColumns` · list
            "Columns to ignore from the dataset."
            - `ColumnName` · string · required
              "The name of a column in a dataset."
          - `selectColumns` · list
            "Columns to select from the dataset. If empty, all columns not in ignoreColumns will be used."
            - `ColumnName` · string · required
              "The name of a column in a dataset."
    - `outputs` · map
      "Output configurations keyed by alias."
      - `OutputAlias` · string · required
        "A string alias used to identify outputs in a Model Studio configuration."
      - `ModelStudioOutput` · union · required
        "Output specification for a Model Studio configuration."
        - `model` · object
          "Model output configuration."
          - `modelRid` · string · required
            "The RID of the output model."
  - `resources` · object · required
    "The compute resources allocated for training runs."
    - `memory` · string · required
      "Memory allocation (e.g., "4G")."
    - `cpu` · string · required
      "CPU allocation (e.g., "2")."
    - `gpu` · enum
      one of `A100`, `A10G`, `A16`, `H100`, `H200`, `L4`, `L40S`, `T4`, `V100`
      "GPU allocation (must be available in the project's resource queue)."
  - `changelog` · string
    "Changelog describing changes in this version."
  - `createdBy` · string · required
    "The Foundry user who created this resource"
  - `createdTime` · string · required
    "The time at which the resource was created."

## Errors

- `ModelStudioNotFound` (NOT_FOUND) — "The requested Model Studio was not found."
- `LatestModelStudioConfigVersionsPermissionDenied` (PERMISSION_DENIED) — "Could not latest the ModelStudioConfigVersion."
