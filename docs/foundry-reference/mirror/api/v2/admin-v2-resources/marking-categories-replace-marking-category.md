<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/marking-categories/replace-marking-category/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Replace Marking Category

`PUT /api/v2/admin/markingCategories/{markingCategoryId}`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Replace the MarkingCategory with the specified id.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `markingCategoryId` · string · required
  "The ID of a marking category. For user-created categories, this will be a UUID. Markings associated with Organizations are placed in a category with ID "Organization"."

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `ReplaceMarkingCategoryRequest` · object · required
  - `name` · string · required
  - `description` · string · required

## Response

- `MarkingCategory` · object · required
  "The replaced MarkingCategory"
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
- `ReplaceMarkingCategoryPermissionDenied` (PERMISSION_DENIED) — "Could not replace the MarkingCategory."
- `MarkingCategoryNotFound` (NOT_FOUND) — "The given MarkingCategory could not be found."
