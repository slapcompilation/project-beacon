<!-- source: https://palantir.com/docs/foundry/api/v2/models-v2-resources/models/create-model/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Model

`POST /api/v2/models`

:::callout{theme=warning title=Warning}
  This endpoint is in preview and may be modified or removed at any time.
  To use this endpoint, add `preview=true` to the request query parameters.
:::

Creates a new Model with no versions.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:models-write`.

Scopes: `api:models-write`

## Query parameters

- `preview` · boolean
  "Enables the use of preview functionality."

## Request

- `CreateModelRequest` · object · required
  - `name` · string · required
  - `parentFolderRid` · string · required
    "The unique resource identifier (RID) of a Folder."

## Response

- `Model` · object · required
  "The created Model"
  - `rid` · string · required
    "The Resource Identifier (RID) of a Model."

## Errors

- `ResourceNameAlreadyExists` (CONFLICT) — "The provided resource name is already in use by another resource in the same folder."
- `InvalidDisplayName` (INVALID_ARGUMENT) — "The display name of a resource should not be exactly `.` or `..`, contain a forward slash `/` and must be
less than or equal to 700 characters."
- `CreateModelPermissionDenied` (PERMISSION_DENIED) — "Could not create the Model."
