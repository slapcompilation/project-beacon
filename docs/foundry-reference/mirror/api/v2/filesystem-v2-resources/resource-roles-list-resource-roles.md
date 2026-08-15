<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/resource-roles/list-resource-roles/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# List Resource Roles

`GET /api/v2/filesystem/resources/{resourceRid}/roles`

List the roles on a resource.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-read`.

Scopes: `api:filesystem-read`

## Path parameters

- `resourceRid` · string · required
  "The unique resource identifier (RID) of a resource."

## Query parameters

- `includeInherited` · boolean
  "Whether to include inherited roles on the resource."
- `pageSize` · integer
  "The page size to use for the endpoint."
- `pageToken` · string
  "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Response

- `ListResourceRolesResponse` · object · required
  - `data` · list
    - `ResourceRole` · object · required
      - `resourceRolePrincipal` · union · required
        - `principalWithId` · object
          "Represents a user principal or group principal with an ID."
          - `principalId` · string · required
            "The ID of a Foundry Group or User."
          - `principalType` · enum · required
            one of `USER`, `GROUP`
        - `everyone` · object
          "A principal representing all users of the platform."
      - `roleId` · string · required
        "The unique ID for a Role. Roles are sets of permissions that grant different levels of access to resources. The default roles in Foundry are: Owner, Editor, Viewer, and Discoverer. See more about [roles](/docs/foundry/security/projects-and-roles#roles) in the user documentation."
  - `nextPageToken` · string
    "The page token indicates where to start paging. This should be omitted from the first page's request. To fetch the next page, clients should take the value from the `nextPageToken` field of the previous response and use it to populate the `pageToken` field of the next request."

## Errors

- `ResourceNotFound` (NOT_FOUND) — "The given Resource could not be found."
