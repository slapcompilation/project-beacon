<!-- source: https://palantir.com/docs/foundry/api/admin-v2-resources/markings/replace-marking/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Replace Marking

`PUT /api/v2/admin/markings/{markingId}`

Replace the Marking with the specified id.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Path parameters

- `markingId` · string · required
  "The ID of a security marking."

## Request

- `ReplaceMarkingRequest` · object · required
  - `name` · string · required
  - `description` · string

## Response

- `Marking` · object · required
  "The replaced Marking"
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

## Errors

- `GetMarkingCategoryPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the marking category."
- `MarkingNameInCategoryAlreadyExists` (INVALID_ARGUMENT) — "A marking with the same name already exists in the category."
- `GetMarkingPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to view the marking."
- `MarkingNameIsEmpty` (INVALID_ARGUMENT) — "The marking name is empty."
- `ReplaceMarkingPermissionDenied` (PERMISSION_DENIED) — "Could not replace the Marking."
- `MarkingNotFound` (NOT_FOUND) — "The given Marking could not be found."
