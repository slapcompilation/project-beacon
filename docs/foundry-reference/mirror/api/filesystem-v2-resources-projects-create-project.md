<!-- source: https://palantir.com/docs/foundry/api/filesystem-v2-resources/projects/create-project/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Project

`POST /api/v2/filesystem/projects/create`

Creates a new Project.

Note that third-party applications using this endpoint via OAuth2 cannot be associated with an
Ontology SDK as this will reduce the scope of operations to only those within specified projects.
When creating the application, select "No, I won't use an Ontology SDK" on the Resources page.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Request

- `CreateProjectRequest` · object · required
  - `displayName` · string · required
    "The display name of the resource"
  - `description` · string
  - `spaceRid` · string · required
    "The unique resource identifier (RID) of a Space."
  - `roleGrants` · map
    - `RoleId` · string · required
      "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."
    - `array` · list · required
      - `PrincipalWithId` · object · required
        "Represents a user principal or group principal with an ID."
        - `principalId` · string · required
          "The ID of a Foundry Group or User."
        - `principalType` · enum · required
          one of `USER`, `GROUP`
  - `defaultRoles` · list
    - `RoleId` · string · required
      "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."
  - `organizationRids` · list
    - `OrganizationRid` · string · required
  - `resourceLevelRoleGrantsAllowed` · boolean
    "Whether role grants should be allowed on individual resources within the Project. When not specified, defaults to true."

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

- `ProjectCreationNotSupported` (INVALID_ARGUMENT) — "Project creation is not supported in the current user's space."
- `ProjectNameAlreadyExists` (CONFLICT) — "The requested display name for the created project is already being used in the space."
- `InvalidDisplayName` (INVALID_ARGUMENT) — "The display name of a resource should not be exactly `.` or `..`, contain a forward slash `/` and must be
less than or equal to 700 characters."
- `OrganizationsNotFound` (NOT_FOUND) — "At least one organization RID could not be found."
- `InvalidRoleIds` (INVALID_ARGUMENT) — "A roleId referenced in either default roles or role grants does not exist in the project role set for the space."
- `CreateProjectNoOwnerLikeRoleGrant` (INVALID_ARGUMENT) — "The create project request would create a project with no principal being granted an owner-like role. As a result, there would be no user with administrative privileges over the project. A role is defined to be owner-like if it has the `compass:edit-project` operation. In the common case of the default role-set, this is just the `compass:manage` role."
- `OrganizationMarkingNotOnSpace` (INVALID_ARGUMENT) — "At least one of the organization markings associated with a passed organization is not applied on the requested space."
- `CreateProjectPermissionDenied` (PERMISSION_DENIED) — "Could not create the Project."
- `ProjectNotFound` (NOT_FOUND) — "The given Project could not be found."
- `SpaceNotFound` (NOT_FOUND) — "The given Space could not be found."
