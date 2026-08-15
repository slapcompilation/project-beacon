<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/markings/list-markings/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Markings

`GET /api/v2/admin/markings`

Maximum page size 100.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Query parameters

- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListMarkingsResponse` · object · required
  - `data` · list
    - `Marking` · object · required
      - `id` · string · required
        "The ID of a security marking."
      - `categoryId` · string · required
        "The ID of a marking category. For user-created categories, this will be a UUID. Markings associated with Organizations are placed in a category with ID "Organization"."
      - `name` · string · required
      - `description` · string
      - `organization` · string
        "If this marking is associated with an Organization, its RID will be populated here."
      - `createdTime` · string · required
        "The time at which the resource was created."
      - `createdBy` · string
        "The Foundry user who created this resource"
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `InvalidPageSize` (INVALID_ARGUMENT) — "The provided page size was zero or negative. Page sizes must be greater than zero."
