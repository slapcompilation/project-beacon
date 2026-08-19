<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/marking-categories/get-marking-category/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Marking Category

`GET /api/v2/admin/markingCategories/{markingCategoryId}`

Get the MarkingCategory with the specified id.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `markingCategoryId` · string · required
  "The ID of a marking category. For user-created categories, this will be a UUID. Markings associated with Organizations are placed in a category with ID "Organization"."

## Response

- `MarkingCategory` · object · required
  - `id` · string · required
    "The ID of a marking category. For user-created categories, this will be a UUID. Markings associated with Organizations are placed in a category with ID "Organization"."
  - `name` · string · required
  - `description` · string · required
  - `categoryType` · enum · required
    one of `CONJUNCTIVE`, `DISJUNCTIVE`
  - `markingType` · enum · required
    one of `MANDATORY`, `CBAC`
  - `markings` · list
    - `MarkingId` · string · required
      "The ID of a security marking."
  - `createdTime` · string · required
    "The time at which the resource was created."
  - `createdBy` · string
    "The Foundry user who created this resource"

## Errors

- `GetMarkingCategoryPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the marking category."
- `MarkingCategoryNotFound` (NOT_FOUND) — "The given MarkingCategory could not be found."
