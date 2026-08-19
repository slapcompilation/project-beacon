<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/datasets/get-dataset-schedules/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Dataset Schedules

`GET /api/v2/datasets/{datasetRid}/getSchedules`

Get the RIDs of the Schedules that target the given Dataset.

Note: It may take up to an hour for recent changes to schedules to be reflected in this response,
especially for schedules managed by Marketplace. This operation will return outdated results in the
meantime.


Third-party applications using this endpoint via OAuth2 must request the following operation scopes: `api:orchestration-read api:datasets-read`.

Scopes: `api:orchestration-read`, `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."

## Query parameters

- `branchName` · string
  "The name of the Branch. If none is provided, the default Branch name - `master` for most enrollments - will be used."
- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListSchedulesResponse` · object · required
  - `data` · list
    - `ScheduleRid` · string · required
      "The RID of a Schedule."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `GetDatasetSchedulesPermissionDenied` (PERMISSION_DENIED) — "Could not getSchedules the Dataset."
