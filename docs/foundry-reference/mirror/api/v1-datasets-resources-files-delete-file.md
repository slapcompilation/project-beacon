<!-- source: https://palantir.com/docs/foundry/api/v1/datasets-resources/files/delete-file/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Delete File

`DELETE /api/v1/datasets/{datasetRid}/files/{filePath}`

Deletes a File from a Dataset. By default the file is deleted in a new transaction on the default 
branch - `master` for most enrollments. The file will still be visible on historical views.

#### Advanced Usage
             
See [Datasets Core Concepts](/docs/foundry/data-integration/datasets/) for details on using branches and transactions.

To **delete a File from a specific Branch** specify the Branch's identifier as `branchId`. A new delete Transaction 
will be created and committed on this branch.

To **delete a File using a manually opened Transaction**, specify the Transaction's resource identifier 
as `transactionRid`. The transaction must be of type `DELETE`. This is useful for deleting multiple files in a
single transaction. See [createTransaction](/docs/foundry/api/datasets-resources/transactions/create-transaction/) to 
open a transaction.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of the Dataset on which to delete the File."
- `filePath` · string · required
  "The File path within the Dataset."

## Query parameters

- `branchId` · string
  "The identifier (name) of the Branch on which to delete the File. Defaults to `master` for most enrollments."
- `transactionRid` · string
  "The Resource Identifier (RID) of the open delete Transaction on which to delete the File."

## Errors

- `InvalidParameterCombination` (INVALID_ARGUMENT) — "The given parameters are individually valid but cannot be used in the given combination."
- `FileNotFoundOnBranch` (NOT_FOUND) — "The requested file could not be found on the given branch, or the client token does not have access to it."
- `CreateTransactionPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to create a transaction on this dataset."
- `AbortTransactionPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to abort the given transaction on the given dataset."
- `TransactionNotFound` (NOT_FOUND) — "The requested transaction could not be found on the dataset, or the client token does not have access to it."
- `FileNotFoundOnTransactionRange` (NOT_FOUND) — "The requested file could not be found on the given transaction range, or the client token does not have access to it."
- `OpenTransactionAlreadyExists` (CONFLICT) — "A transaction is already open on this dataset and branch. A branch of a dataset can only have one open transaction at a time."
- `InvalidBranchId` (INVALID_ARGUMENT) — "The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs."
- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `CommitTransactionPermissionDenied` (PERMISSION_DENIED) — "The provided token does not have permission to commit the given transaction on the given dataset."
- `InvalidTransactionType` (INVALID_ARGUMENT) — "The given transaction type is not valid. Valid transaction types are `SNAPSHOT`, `UPDATE`, `APPEND`, and `DELETE`."
- `PutSchemaPermissionDenied` (PERMISSION_DENIED) — "todo"
- `TransactionNotOpen` (INVALID_ARGUMENT) — "The given transaction is not open."
