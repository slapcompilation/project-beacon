<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/datasets/get-dataset/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Dataset

`GET /api/v2/datasets/{datasetRid}`

Get the Dataset with the specified rid.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."

## Response

- `Dataset` · object · required
  - `rid` · string · required
    "The Resource Identifier (RID) of a Dataset."
  - `name` · string · required
  - `parentFolderRid` · string · required
    "The unique resource identifier (RID) of a Folder."

## Errors

- `ResourceNameAlreadyExists` (CONFLICT) — "The provided resource name is already in use by another resource in the same folder."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
