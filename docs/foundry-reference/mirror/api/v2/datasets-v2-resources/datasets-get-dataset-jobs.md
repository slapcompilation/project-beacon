<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/datasets/get-dataset-jobs/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Dataset Jobs

`POST /api/v2/datasets/{datasetRid}/jobs`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Get the RIDs of the Jobs for the given dataset. By default, returned Jobs are sorted in descending order by the Job start time.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."

## Query parameters

- `branchName` · string
  "The name of the Branch. If none is provided, the default Branch name - `master` for most enrollments - will be used."
- `pageSize` · integer
  "Max number of results to return. A limit of 1000 on if no limit is supplied in the search request"
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."
- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `GetDatasetJobsRequest` · object · required
  - `where` · union
    "Query for getting jobs on given dataset."
    - `or` · object
      - `items` · list
        - `GetDatasetJobsQuery` · union · required
          "Query for getting jobs on given dataset."
    - `and` · object
      - `items` · list
        - `GetDatasetJobsQuery` · union · required
          "Query for getting jobs on given dataset."
    - `timeFilter` · object
      - `field` · enum · required
        one of `SUBMITTED_TIME`, `FINISHED_TIME`
      - `comparisonType` · enum · required
        one of `GTE`, `LT`
      - `value` · string · required
  - `orderBy` · list
    - `GetDatasetJobsSort` · object · required
      - `sortType` · enum · required
        one of `BY_STARTED_TIME`, `BY_FINISHED_TIME`
      - `sortDirection` · enum · required
        one of `ASCENDING`, `DESCENDING`

## Response

- `GetJobResponse` · object · required
  - `data` · list
    - `JobDetails` · object · required
      - `jobRid` · string · required
        "The RID of a Job."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `GetDatasetJobsPermissionDenied` (PERMISSION_DENIED) — "Could not jobs the Dataset."
