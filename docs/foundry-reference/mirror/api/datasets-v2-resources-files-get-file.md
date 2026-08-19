<!-- source: https://palantir.com/docs/foundry/api/datasets-v2-resources/files/get-file/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get File

`GET /api/v2/datasets/{datasetRid}/files/{filePath}`

Gets metadata about a File contained in a Dataset. By default this retrieves the file's metadata from the latest
view of the default branch - `master` for most enrollments.
#### Advanced Usage
See [Datasets Core Concepts](/docs/foundry/data-integration/datasets/) for details on using branches and transactions. 
To **get a file's metadata from a specific Branch** specify the Branch's name as `branchName`. This will 
retrieve metadata for the most recent version of the file since the latest snapshot transaction, or the earliest
ancestor transaction of the branch if there are no snapshot transactions.
To **get a file's metadata from the resolved view of a transaction** specify the Transaction's resource identifier
as `endTransactionRid`. This will retrieve metadata for the most recent version of the file since the latest snapshot
transaction, or the earliest ancestor transaction if there are no snapshot transactions.
To **get a file's metadata from the resolved view of a range of transactions** specify the the start transaction's
resource identifier as `startTransactionRid` and the end transaction's resource identifier as `endTransactionRid`.
This will retrieve metadata for the most recent version of the file since the `startTransactionRid` up to the 
`endTransactionRid`. Behavior is undefined when the start and end transactions do not belong to the same root-to-leaf path.
To **get a file's metadata from a specific transaction** specify the Transaction's resource identifier as both the 
`startTransactionRid` and `endTransactionRid`.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `filePath` · string · required
  "The path to a File within Foundry. Paths are relative and must not start with a leading slash. Examples: `my-file.txt`, `path/to/my-file.jpg`, `dataframe.snappy.parquet`."

## Query parameters

- `branchName` · string
  "The name of the Branch that contains the File. Defaults to `master` for most enrollments."
- `startTransactionRid` · string
  "The Resource Identifier (RID) of the start Transaction."
- `endTransactionRid` · string
  "The Resource Identifier (RID) of the end Transaction."

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
- `FileNotFoundOnBranch` (NOT_FOUND) — "The requested file could not be found on the given branch, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `FileNotFoundOnTransactionRange` (NOT_FOUND) — "The requested file could not be found on the given transaction range, or the client token does not have access to it."
- `InvalidParameterCombination` (INVALID_ARGUMENT) — "The given parameters are individually valid but cannot be used in the given combination."
- `InvalidBranchName` (INVALID_ARGUMENT) — "The requested branch name cannot be used. Branch names cannot be empty and must not look like RIDs or UUIDs."
- `TransactionNotFound` (NOT_FOUND) — "The requested transaction could not be found on the dataset, or the client token does not have access to it."
- `FileNotFound` (NOT_FOUND) — "The given File could not be found."
