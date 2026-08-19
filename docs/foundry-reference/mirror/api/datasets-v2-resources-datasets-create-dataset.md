<!-- source: https://palantir.com/docs/foundry/api/datasets-v2-resources/datasets/create-dataset/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Dataset

`POST /api/v2/datasets`

Creates a new Dataset. A default branch - `master` for most enrollments - will be created on the Dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Request

- `CreateDatasetRequest` · object · required
  - `parentFolderRid` · string · required
    "The unique resource identifier (RID) of a Folder."
  - `name` · string · required

## Response

- `Dataset` · object · required
  "The created Dataset"
  - `rid` · string · required
    "The Resource Identifier (RID) of a Dataset."
  - `name` · string · required
  - `parentFolderRid` · string · required
    "The unique resource identifier (RID) of a Folder."

## Errors

- `ResourceNameAlreadyExists` (CONFLICT) — "The provided resource name is already in use by another resource in the same folder."
- `CreateDatasetPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to create a dataset in this folder."
- `TransactionNotCommitted` (INVALID_ARGUMENT) — "The given transaction has not been committed."
- `TransactionNotFound` (NOT_FOUND) — "The requested transaction could not be found on the dataset, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `CreateBranchPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to create a branch of this dataset."
- `BranchAlreadyExists` (CONFLICT) — "The branch cannot be created because a branch with that name already exists."
- `InvalidBranchName` (INVALID_ARGUMENT) — "The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs."
- `InvalidDisplayName` (INVALID_ARGUMENT) — "The display name of a resource should not be exactly `.` or `..`, contain a forward slash `/` and must be
less than or equal to 700 characters."
- `FolderNotFound` (NOT_FOUND) — "The given Folder could not be found."
