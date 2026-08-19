<!-- source: https://palantir.com/docs/foundry/api/datasets-resources/datasets/get-dataset/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Dataset

`GET /api/v1/datasets/{datasetRid}`

Gets the Dataset with the given DatasetRid.


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

## Errors

- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
