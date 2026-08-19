<!-- source: https://palantir.com/docs/foundry/api/notepad-v2-resources/generation-jobs/get-generation-job/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Generation Job

`GET /api/v2/notepad/templates/{templateRid}/generationJobs/{generationJobRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Load an existing GenerationJob. This is used to monitor job progress.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:notepad-write`.

Scopes: `api:notepad-write`

## Path parameters

- `templateRid` · string · required
  "The unique identifier for a Template"
- `generationJobRid` · string · required
  "The unique identifier for a GenerationJob"

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `GenerationJob` · object · required
  - `rid` · string · required
    "The unique identifier for a GenerationJob"
  - `status` · union · required
    "The status of a GenerationJob"
    - `running` · object
      "The generation job is currently running"
    - `failed` · object
      "The generation job failed"
      - `errorMessage` · string · required
        "The error message explaining why template generation failed"
    - `succeeded` · object
      "The generation job succeeded"

## Errors

- `GenerationJobNotFound` (NOT_FOUND) — "The given GenerationJob could not be found."
