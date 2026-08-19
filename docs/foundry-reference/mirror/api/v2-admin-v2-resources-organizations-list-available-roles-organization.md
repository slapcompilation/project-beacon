<!-- source: https://palantir.com/docs/foundry/api/v2/admin-v2-resources/organizations/list-available-roles-organization/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# List Available Roles Organization

`GET /api/v2/admin/organizations/{organizationRid}/listAvailableRoles`

List all roles that can be assigned to a principal for the given Organization.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:admin-read`.

Scopes: `api:admin-read`

## Path parameters

- `organizationRid` · string · required

## Response

- `ListAvailableOrganizationRolesResponse` · object · required
  - `data` · list
    - `Role` · object · required
      "A set of permissions that can be assigned to a principal for a specific resource type."
      - `id` · string · required
        "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."
      - `roleSetId` · string · required
      - `name` · string · required
      - `description` · string · required
      - `isDefault` · boolean · required
        "Default roles are provided by Palantir and cannot be edited or modified by administrators."
      - `type` · enum · required
        one of `ORGANIZATION`
        "The type of resource that is valid for this role."
      - `operations` · list
        "The operations that a principal can perform with this role on the assigned resource."
        - `Operation` · string · required
          "An operation that can be performed on a resource. Operations are used to define the permissions that a Role has. Operations are typically in the format `service:action`, where `service` is related to the type of resource and `action` is the action being performed."

## Errors

- `ListAvailableRolesOrganizationPermissionDenied` (PERMISSION_DENIED) — "Could not listAvailableRoles the Organization."
- `OrganizationNotFound` (NOT_FOUND) — "The given Organization could not be found."
