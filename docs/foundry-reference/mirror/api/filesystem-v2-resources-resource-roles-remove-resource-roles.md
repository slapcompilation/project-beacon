<!-- source: https://palantir.com/docs/foundry/api/filesystem-v2-resources/resource-roles/remove-resource-roles/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Remove Resource Roles

`POST /api/v2/filesystem/resources/{resourceRid}/roles/remove`

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Path parameters

- `resourceRid` · string · required
  "The unique resource identifier (RID) of a resource."

## Request

- `RemoveResourceRolesRequest` · object · required
  - `roles` · list
    - `ResourceRoleIdentifier` · object · required
      "A role grant on a resource for add/remove operations that doesn't require specifying the principal type."
      - `resourceRolePrincipal` · union · required
        "A principal for resource role operations that doesn't require specifying the principal type."
        - `principalIdOnly` · object
          "Represents a principal with just an ID, without the type."
          - `principalId` · string · required
            "The ID of a Foundry Group or User."
        - `everyone` · object
          "A principal representing all users of the platform."
      - `roleId` · string · required
        "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."

## Errors

- `InvalidRoleIds` (INVALID_ARGUMENT) — "A roleId referenced in either default roles or role grants does not exist in the project role set for the space."
- `PrincipalNotFound` (NOT_FOUND) — "A principal (User or Group) with the given PrincipalId could not be found"
- `RemoveResourceRolesPermissionDenied` (PERMISSION_DENIED) — "Could not remove the ResourceRole."
- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
