<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/datasets/get-dataset-health-checks/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Dataset Health Checks

`GET /api/v2/datasets/{datasetRid}/getHealthChecks`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the RIDs of the Data Health Checks that are configured for the given Dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scopes: `api:data-health-read api:datasets-read`.

Scopes: `api:data-health-read`, `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."

## Query parameters

- `branchName` · string
  "The name of the Branch. If none is provided, the default Branch name - `master` for most enrollments - will be used."
- `preview` · boolean
  "Enables the use of preview functionality."

## Response

- `ListHealthChecksResponse` · object · required
  - `data` · list
    - `CheckRid` · string · required
      "The unique resource identifier (RID) of a Data Health Check."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `GetDatasetHealthChecksPermissionDenied` (PERMISSION_DENIED) — "Could not getHealthChecks the Dataset."
