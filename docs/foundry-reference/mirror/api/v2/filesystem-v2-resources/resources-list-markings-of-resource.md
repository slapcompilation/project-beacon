<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/resources/list-markings-of-resource/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Markings Of Resource

`GET /api/v2/filesystem/resources/{resourceRid}/markings`

List of Markings directly applied to a resource. The number of Markings on a resource is typically small 
so the `pageSize` and `pageToken` parameters are not required.

## Path parameters

- `resourceRid` · string · required
  "The unique resource identifier (RID) of a resource."

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListMarkingsOfResourceResponse` · object · required
  - `data` · list
    - `MarkingId` · string · required
      "The ID of a security marking."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
