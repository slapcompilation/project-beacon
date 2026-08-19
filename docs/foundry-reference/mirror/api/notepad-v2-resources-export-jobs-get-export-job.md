<!-- source: https://palantir.com/docs/foundry/api/notepad-v2-resources/export-jobs/get-export-job/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Export Job

`GET /api/v2/notepad/exportJobs/{exportJobRid}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Loads an ExportJob. This endpoint is used to monitor job progress.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:notepad-export`.

Scopes: `api:notepad-export`

## Path parameters

- `exportJobRid` · string · required
  "The unique identifier for an ExportJob"

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ExportJob` · object · required
  - `rid` · string · required
    "The unique identifier for an ExportJob"
  - `status` · union · required
    "The status of an export job"
    - `running` · object
      "The export job is currently running"
    - `failed` · object
      "The export job failed"
      - `errorMessage` · string · required
        "The error message explaining why the export failed"
      - `errorCode` · string
      - `errorInstanceId` · string
    - `succeeded` · object
      "The export job succeeded"
      - `fileRid` · string · required
        "The File containing the exported content"

## Errors

- `ExportJobNotFound` (NOT_FOUND) — "The given ExportJob could not be found."
