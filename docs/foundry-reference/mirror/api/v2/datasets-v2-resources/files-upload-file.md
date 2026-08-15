<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/files/upload-file/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Upload File

`POST /api/v2/datasets/{datasetRid}/files/{filePath}/upload`

Uploads a File to an existing Dataset.
The body of the request must contain the binary content of the file and the `Content-Type` header must be `application/octet-stream`.
By default the file is uploaded to a new transaction on the default branch - `master` for most enrollments.
If the file already exists only the most recent version will be visible in the updated view.
#### Advanced Usage
See [Datasets Core Concepts](/docs/foundry/data-integration/datasets/) for details on using branches and transactions. 
To **upload a file to a specific Branch** specify the Branch's name as `branchName`. A new transaction will 
be created and committed on this branch. By default the TransactionType will be `UPDATE`, to override this
default specify `transactionType` in addition to `branchName`. 
See [createBranch](/docs/foundry/api/datasets-resources/branches/create-branch/) to create a custom branch.
To **upload a file on a manually opened transaction** specify the Transaction's resource identifier as
`transactionRid`. This is useful for uploading multiple files in a single transaction. 
See [createTransaction](/docs/foundry/api/datasets-resources/transactions/create-transaction/) to open a transaction.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `filePath` · string · required
  "The path to a File within Foundry. Paths are relative and must not start with a leading slash. Examples: `my-file.txt`, `path/to/my-file.jpg`, `dataframe.snappy.parquet`."

## Query parameters

- `branchName` · string
  "The name of the Branch on which to upload the File. Defaults to `master` for most enrollments."
- `transactionType` · enum
  one of `APPEND`, `UPDATE`, `SNAPSHOT`, `DELETE`
  "The type of the Transaction to create when using branchName. Defaults to `UPDATE`."
- `transactionRid` · string
  "The Resource Identifier (RID) of the open Transaction on which to upload the File."

## Request

- `body` · string · required

## Response

- `File` · object · required
  - `path` · string · required
    "The path to a File within Foundry. Paths are relative and must not start with a leading slash. Examples: `my-file.txt`, `path/to/my-file.jpg`, `dataframe.snappy.parquet`."
  - `transactionRid` · string · required
    "The Resource Identifier (RID) of a Transaction."
  - `sizeBytes` · string
  - `updatedTime` · string · required

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `OpenTransactionAlreadyExists` (CONFLICT) — "A transaction is already open on this dataset and branch. A branch of a dataset can only have one open transaction at a time."
- `FileAlreadyExists` (NOT_FOUND) — "The given file path already exists in the dataset and transaction."
- `InvalidParameterCombination` (INVALID_ARGUMENT) — "The given parameters are individually valid but cannot be used in the given combination."
- `InvalidFilePath` (INVALID_ARGUMENT) — "The provided file path is invalid. Check that the path does not start with a leading slash."
- `TransactionNotFound` (NOT_FOUND) — "The requested transaction could not be found on the dataset, or the client token does not have access to it."
- `TransactionNotOpen` (INVALID_ARGUMENT) — "The given transaction is not open."
- `CreateTransactionPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to create a transaction on this dataset."
- `AbortTransactionPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to abort the given transaction on the given dataset."
- `CommitTransactionPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to commit the given transaction on the given dataset."
- `InvalidBranchName` (INVALID_ARGUMENT) — "The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs."
- `UploadFilePermissionDenied` (PERMISSION_DENIED) — "Could not upload the File."
