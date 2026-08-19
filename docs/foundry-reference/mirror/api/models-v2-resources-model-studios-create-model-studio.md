<!-- source: https://palantir.com/docs/foundry/api/models-v2-resources/model-studios/create-model-studio/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Model Studio

`POST /api/v2/models/modelStudios`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Creates a new Model Studio.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-write`.

Scopes: `api:models-write`

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `CreateModelStudioRequest` · object · required
  - `name` · string · required
    "The name of the Model Studio."
  - `parentFolderRid` · string · required
    "The RID of the parent folder where the studio will be created."

## Response

- `ModelStudio` · object · required
  "The created ModelStudio"
  - `rid` · string · required
    "The Resource Identifier (RID) of a Model Studio."
  - `folderRid` · string · required
    "The parent folder containing this Model Studio."
  - `createdTime` · string · required
    "The time at which the resource was created."

## Errors

- `ResourceNameAlreadyExists` (CONFLICT) — "The provided resource name is already in use by another resource in the same folder."
- `InvalidDisplayName` (INVALID_ARGUMENT) — "The display name of a resource should not be exactly `.` or `..`, contain a forward slash `/` and must be
less than or equal to 700 characters."
- `InvalidModelStudioCreateRequest` (INVALID_ARGUMENT) — "The request to create a Model Studio contains invalid arguments."
- `CreateModelStudioPermissionDenied` (PERMISSION_DENIED) — "Could not create the ModelStudio."
