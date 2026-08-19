<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/markings/get-markings-batch/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Markings Batch

`POST /api/v2/admin/markings/getBatch`

Execute multiple get requests on Marking.

The maximum batch size for this endpoint is 500.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Request

- `body` · list · required
  - `GetMarkingsBatchRequestElement` · object · required
    - `markingId` · string · required
      "The ID of a security marking."

## Response

- `GetMarkingsBatchResponse` · object · required
  - `data` · map
    - `MarkingId` · string · required
      "The ID of a security marking."
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
