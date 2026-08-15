<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/model-studio-trainers/get-model-studio-trainer/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Model Studio Trainer

`GET /api/v2/models/modelStudioTrainers/{modelStudioTrainerTrainerId}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Gets details about a specific trainer by its ID and optional version.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-read`.

Scopes: `api:models-read`

## Path parameters

- `modelStudioTrainerTrainerId` · string · required
  "The Resource Identifier (RID) of a trainer."

## Query parameters

- `version` · string
  "Specific version of the trainer to retrieve. If not specified, returns the latest version."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ModelStudioTrainer` · object · required
  - `trainerId` · string · required
    "The Resource Identifier (RID) of a trainer."
  - `version` · string · required
    "The version of this trainer."
  - `name` · string · required
    "Human-readable name of the trainer."
  - `type` · enum · required
    one of `GENERIC`, `TIME_SERIES`, `TABULAR_REGRESSION`, `TABULAR_CLASSIFICATION`, `LLM_FINETUNING`, `VLM_FINETUNING`
    "The category of machine learning task this trainer is designed to solve."
  - `description` · string · required
    "Description of what this trainer does and its capabilities."
  - `customConfigSchema` · any · required
    "JSON schema defining the custom configuration parameters for this trainer."
  - `inputs` · any · required
    "Input specifications for this trainer."
  - `outputs` · any · required
    "Output specifications for this trainer."
  - `experimental` · boolean · required
    "Whether this trainer is experimental and may have breaking changes."

## Errors

- `TrainerNotFound` (NOT_FOUND) — "The specified trainer does not exist."
- `ModelStudioTrainerNotFound` (NOT_FOUND) — "The given ModelStudioTrainer could not be found."
