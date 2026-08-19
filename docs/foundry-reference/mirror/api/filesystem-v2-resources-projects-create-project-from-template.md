<!-- source: https://palantir.com/docs/foundry/api/filesystem-v2-resources/projects/create-project-from-template/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Project From Template

`POST /api/v2/filesystem/projects/createFromTemplate`

Creates a project from a project template.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Request

- `CreateProjectFromTemplateRequest` · object · required
  - `templateRid` · string · required
    "The unique resource identifier (RID) of a project template."
  - `variableValues` · map
    - `ProjectTemplateVariableId` · string · required
      "An identifier for a variable used in a project template."
    - `ProjectTemplateVariableValue` · string · required
      "The value assigned to a variable used in a project template."
  - `defaultRoles` · list
    - `RoleId` · string · required
      "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."
  - `organizationRids` · list
    - `OrganizationRid` · string · required
  - `projectDescription` · string

## Response

- `Project` · object · required
  - `rid` · string · required
    "The unique resource identifier (RID) of a Project."
  - `displayName` · string · required
    "The display name of the Project. Must be unique and cannot contain a /"
  - `description` · string
    "The description associated with the Project."
  - `documentation` · string
    "The documentation associated with the Project."
  - `path` · string · required
    "The full path to the resource, including the resource name itself"
  - `createdBy` · string · required
    "The Foundry user who created this resource"
  - `updatedBy` · string · required
    "The Foundry user who last updated this resource"
  - `createdTime` · string · required
    "The time at which the resource was created."
  - `updatedTime` · string · required
    "The time at which the resource was most recently updated."
  - `trashStatus` · enum · required
    one of `DIRECTLY_TRASHED`, `ANCESTOR_TRASHED`, `NOT_TRASHED`
    "The trash status of the Project."
  - `spaceRid` · string · required
    "The Space Resource Identifier (RID) that the Project lives in."
  - `resourceLevelRoleGrantsAllowed` · boolean · required
    "Whether role grants are allowed on individual resources within the Project."

## Errors

- `ProjectTemplateNotFound` (NOT_FOUND) — "The project template RID referenced cannot be found."
- `DefaultRolesNotInSpaceRoleSet` (INVALID_ARGUMENT) — "The requested default roles are not in the role set of the space for the project template."
- `NotAuthorizedToApplyOrganization` (INVALID_ARGUMENT) — "The user is not authorized to apply at least one of the organization markings required to create the project from template."
- `InvalidOrganizationHierarchy` (INVALID_ARGUMENT) — "Organizations on a project must also exist on the parent space. This error is thrown if the configuration 
of a project's organizations (on creation or subsequently) results in the project being marked with either 
no organizations in a marked space, or with an organization that is not present on the parent space."
- `CreateProjectNoOwnerLikeRoleGrant` (INVALID_ARGUMENT) — "The create project request would create a project with no principal being granted an owner-like role. As a result, there would be no user with administrative privileges over the project. A role is defined to be owner-like if it has the `compass:edit-project` operation. In the common case of the default role-set, this is just the `compass:manage` role."
- `CreateGroupPermissionDenied` (PERMISSION_DENIED) — "The user is not authorized to create the group in the organization required to create the project from template."
- `AddGroupToParentGroupPermissionDenied` (PERMISSION_DENIED) — "The user is not authorized to add a a group to the parent group required to create the project from template."
- `TemplateGroupNameConflict` (CONFLICT) — "Creating the project from template would attempt to create new groups with names conflicting either with other new groups, or existing groups."
- `TemplateMarkingNameConflict` (CONFLICT) — "Creating the project from template would attempt to create new markings with names conflicting either with other new markings, or existing markings."
- `InvalidPrincipalIdsForGroupTemplate` (INVALID_ARGUMENT) — "The template requested for project creation contains principal IDs that do not exist."
- `InvalidDescription` (INVALID_ARGUMENT) — "Either the user has not passed a value for a template with unset project description, or has passed a value for a template with fixed project description."
- `InvalidOrganizations` (INVALID_ARGUMENT) — "Either the user has not passed organizations for a template with suggested organizations, or has passed organization for a template with fixed organizations."
- `MissingVariableValue` (INVALID_ARGUMENT) — "A variable defined on the template requested for project creation does not have a value set in the request."
- `InvalidVariable` (INVALID_ARGUMENT) — "A variable referenced in the request to create project from template is not defined on the template."
- `InvalidVariableEnumOption` (INVALID_ARGUMENT) — "The value passed in the request to create project from template for an enum type variable is not a valid option."
- `OrganizationsNotFound` (NOT_FOUND) — "At least one organization RID could not be found."
- `InvalidDefaultRoles` (INVALID_ARGUMENT) — "Either the user has not passed default roles for a template with suggested default roles, or has passed default roles for a template with fixed default roles."
- `CreateProjectFromTemplatePermissionDenied` (PERMISSION_DENIED) — "Could not createFromTemplate the Project."
- `ProjectNotFound` (NOT_FOUND) — "The given Project could not be found."
