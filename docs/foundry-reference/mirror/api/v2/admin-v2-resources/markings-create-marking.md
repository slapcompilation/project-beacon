<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/markings/create-marking/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Create Marking

`POST /api/v2/admin/markings`

Creates a new Marking.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-write`.

Scopes: `api:admin-write`

## Request

- `CreateMarkingRequest` · object · required
  - `initialRoleAssignments` · list
    "The initial roles that will be assigned when the Marking is created. At least one ADMINISTER role must be provided. This can be changed later through the MarkingRoleAssignment operations. WARNING: If you do not include your own principal ID or the ID of a Group that you are a member of, you will create a Marking that you cannot administer."
    - `MarkingRoleUpdate` · object · required
      - `role` · enum · required
        one of `ADMINISTER`, `DECLASSIFY`, `USE`
        "Represents the operations that a user can perform with regards to a Marking. * ADMINISTER: The user can add and remove members from the Marking, update Marking Role Assignments, and change Marking metadata. * DECLASSIFY: The user can remove the Marking from resources in the platform and stop the propagation of the Marking during a transform. * USE: The user can apply the marking to resources in the platform."
      - `principalId` · string · required
        "The ID of a Foundry Group or User."
  - `initialMembers` · list
    "Users and Groups that will be able to view resources protected by this Marking. This can be changed later through the MarkingMember operations."
    - `PrincipalId` · string · required
      "The ID of a Foundry Group or User."
  - `name` · string · required
  - `description` · string
  - `categoryId` · string · required
    "The ID of a marking category. For user-created categories, this will be a UUID. Markings associated with Organizations are placed in a category with ID "Organization"."

## Response

- `Marking` · object · required
  "The created Marking"
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
- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `CreateMarkingMissingInitialAdminRole` (INVALID_ARGUMENT) — "At least one ADMINISTER role assignment must be provided when creating a marking."
- `MarkingNameInCategoryAlreadyExists` (INVALID_ARGUMENT) — "A marking with the same name already exists in the category."
- `MarkingNameIsEmpty` (INVALID_ARGUMENT) — "The marking name is empty."
- `CreateMarkingPermissionDenied` (PERMISSION_DENIED) — "Could not create the Marking."
- `MarkingCategoryNotFound` (NOT_FOUND) — "The given MarkingCategory could not be found."
