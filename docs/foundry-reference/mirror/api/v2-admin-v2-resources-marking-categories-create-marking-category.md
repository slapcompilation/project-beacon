<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/marking-categories/create-marking-category/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Marking Category

`POST /api/v2/admin/markingCategories`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Creates a new MarkingCategory.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `CreateMarkingCategoryRequest` · object · required
  - `initialPermissions` · object · required
    "The initial permissions for the Marking Category. This can be changed later through MarkingCategoryPermission operations. The provided permissions must include at least one ADMINISTER role assignment. WARNING: If you do not list your own principal ID or the ID of a Group that you are a member of as an ADMINISTER, you will create a Marking Category that you cannot administer."
    - `organizationRids` · list
      "Users must be members of at least one of the Organizations in this list to view Markings in the category, regardless of their assigned roles."
      - `OrganizationRid` · string · required
    - `roles` · list
      - `MarkingCategoryRoleAssignment` · object · required
        - `role` · enum · required
          one of `ADMINISTER`, `VIEW`
          "Represents the operations that a user can perform with regards to a Marking Category. * ADMINISTER: The user can update a Marking Category's metadata and permissions * VIEW: The user can view the Marking Category and the Markings within it. NOTE: Permissions to administer or view a Marking Category do not confer any permissions to administer or view data protected by the Markings within that category."
        - `principalId` · string · required
          "The ID of a Foundry Group or User."
    - `isPublic` · boolean · required
      "If true, all users who are members of at least one of the Organizations from organizationRids can view the Markings in the category. If false, only users who are explicitly granted the VIEW role can view the Markings in the category."
  - `name` · string · required
  - `description` · string · required

## Response

- `MarkingCategory` · object · required
  "The created MarkingCategory"
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

- `CreateMarkingCategoryMissingInitialAdminRole` (INVALID_ARGUMENT) — "At least one ADMINISTER role assignment must be provided when creating a marking category."
- `CreateMarkingCategoryMissingOrganization` (INVALID_ARGUMENT) — "At least one organization must be provided when creating a marking category."
- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `CreateMarkingCategoryPermissionDenied` (PERMISSION_DENIED) — "Could not create the MarkingCategory."
