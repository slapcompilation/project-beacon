<!-- source: https://palantir.com/docs/foundry/api/filesystem-v2-resources/projects/get-project/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Project

`GET /api/v2/filesystem/projects/{projectRid}`

Get the Project with the specified rid.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-read`.

Scopes: `api:filesystem-read`

## Path parameters

- `projectRid` · string · required
  "The unique resource identifier (RID) of a Project."

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

- `ProjectNotFound` (NOT_FOUND) — "The given Project could not be found."
