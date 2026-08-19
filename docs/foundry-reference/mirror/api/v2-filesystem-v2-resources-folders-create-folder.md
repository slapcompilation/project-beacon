<!-- source: https://palantir.com/docs/foundry/api/v2/filesystem-v2-resources/folders/create-folder/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Folder

`POST /api/v2/filesystem/folders`

Creates a new Folder.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:filesystem-write`.

Scopes: `api:filesystem-write`

## Request

- `CreateFolderRequest` · object · required
  - `parentFolderRid` · string · required
    "The parent folder Resource Identifier (RID). For Projects, this will be the Space RID and for Spaces, this value will be the root folder (`ri.compass.main.folder.0`)."
  - `displayName` · string · required
    "The display name of the resource"

## Response

- `Folder` · object · required
  "The created Folder"
  - `rid` · string · required
    "The unique resource identifier (RID) of a Folder."
  - `displayName` · string · required
    "The display name of the resource"
  - `description` · string
    "The description associated with the Folder."
  - `documentation` · string
    "The documentation associated with the Folder."
  - `path` · string · required
    "The full path to the resource, including the resource name itself"
  - `type` · enum · required
    one of `FOLDER`, `SPACE`, `PROJECT`
    "A folder can be a regular Folder, a [Project](/docs/foundry/getting-started/projects-and-resources/#projects) or a [Space](/docs/foundry/security/orgs-and-spaces/#spaces)."
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
    "The trash status of the Folder. If trashed, this could either be because the Folder itself has been trashed or because one of its ancestors has been trashed."
  - `parentFolderRid` · string · required
    "The parent folder Resource Identifier (RID). For Projects, this will be the Space RID and for Spaces, this value will be the root folder (`ri.compass.main.folder.0`)."
  - `projectRid` · string
    "The Project Resource Identifier (RID) that the Folder lives in. If the Folder is a Space, this value will not be defined."
  - `spaceRid` · string · required
    "The Space Resource Identifier (RID) that the Folder lives in. If the Folder is a Space, this value will be the same as the Folder RID."

## Errors

- `ResourceNameAlreadyExists` (CONFLICT) — "The provided resource name is already in use by another resource in the same folder."
- `GetRootFolderNotSupported` (INVALID_ARGUMENT) — "Getting the root folder as a resource is not supported."
- `CreateFolderOutsideProjectNotSupported` (INVALID_ARGUMENT) — "The given resource is not a folder."
- `InvalidFolder` (INVALID_ARGUMENT) — "The given resource is not a Folder."
- `InvalidDisplayName` (INVALID_ARGUMENT) — "The display name of a resource should not be exactly `.` or `..`, contain a forward slash `/` and must be
less than or equal to 700 characters."
- `MissingDisplayName` (INVALID_ARGUMENT) — "A Display Name must be provided."
- `CreateFolderPermissionDenied` (PERMISSION_DENIED) — "Could not create the Folder."
- `FolderNotFound` (NOT_FOUND) — "The given Folder could not be found."
