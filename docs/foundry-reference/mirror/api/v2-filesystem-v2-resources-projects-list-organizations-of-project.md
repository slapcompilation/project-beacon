<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/projects/list-organizations-of-project/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Organizations Of Project

`GET /api/v2/filesystem/projects/{projectRid}/organizations`

List of Organizations directly applied to a Project. The number of Organizations on a Project is 
typically small so the `pageSize` and `pageToken` parameters are not required.

## Path parameters

- `projectRid` · string · required
  "The unique resource identifier (RID) of a Project."

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListOrganizationsOfProjectResponse` · object · required
  - `data` · list
    - `OrganizationRid` · string · required
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ProjectNotFound` (NOT_FOUND) — "The given Project could not be found."
