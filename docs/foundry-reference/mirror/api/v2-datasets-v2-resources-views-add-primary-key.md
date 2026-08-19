<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/views/add-primary-key/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Add Primary Key

`POST /api/v2/datasets/views/{viewDatasetRid}/addPrimaryKey`

Adds a primary key to a View that does not already have one. Primary keys are treated as 
guarantees provided by the creator of the dataset.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `viewDatasetRid` · string · required
  "The rid of the View."

## Request

- `AddPrimaryKeyRequest` · object · required
  - `branch` · string
    "The name of a Branch."
  - `primaryKey` · object · required
    "The primary key of the dataset. Primary keys are treated as guarantees provided by the creator of the dataset."
    - `columns` · list
      "The columns that constitute the primary key. These columns must satisfy the following constraints: - The list of columns must be non-empty. - The list must not contain duplicate columns after applying column normalization. - Each referenced column must exist in the schema. - The type of each referenced column must be one of the following: `BYTE`, `SHORT`, `DECIMAL`, `INTEGER`, `LONG`, `STRING`, `BOOLEAN`, `TIMESTAMP` or `DATE`."
    - `resolution` · union · required
      "The semantics of the primary key within the dataset. For example, the unique resolution means that every row in the dataset has a distinct primary key. The value of this field represents a contract for writers of the dataset. Writers are responsible for maintaining any related invariants, and readers may make optimizations based on this. Violating the assumptions of the resolution can cause undefined behavior, for example, having duplicate primary keys with the unique resolution."
      - `unique` · object
        "Primary key values are unique within the dataset – no conflicts."
      - `duplicate` · object
        "Duplicate primary key values may exist within the dataset – resolution required."
        - `deletionColumn` · string
          "The name of the boolean column that indicates whether a row should be considered deleted. Based on the `resolutionStrategy`, if the final row selected for a given primary key has `true` in this column, that row will be excluded from the results. Otherwise, it will be included."
        - `resolutionStrategy` · union · required
          - `latestWins` · object
            "Picks the row with the highest value of a list of columns, compared in order."
            - `columns` · list

## Response

- `View` · object · required
  - `viewName` · string · required
  - `datasetRid` · string · required
    "The rid of the View."
  - `parentFolderRid` · string · required
    "The unique resource identifier (RID) of a Folder."
  - `branch` · string
    "The branch name of the View. If not specified, defaults to `master` for most enrollments."
  - `backingDatasets` · list
    - `ViewBackingDataset` · object · required
      "One of the Datasets backing a View."
      - `branch` · string
        "The branch of the backing dataset. If not specified, defaults to the branch of the View."
      - `datasetRid` · string · required
        "The Resource Identifier (RID) of a Dataset."
      - `stopPropagatingMarkingIds` · list
        "Markings listed here will not be inherited from this backing dataset. The caller must have the DECLASSIFY permission on each marking listed here. If multiple backing datasets have the same marking applied, the marking must be listed for each backing dataset or it will still be inherited."
        - `MarkingId` · string · required
          "The ID of a security marking."
  - `primaryKey` · object
    "The primary key of the dataset. Primary keys are treated as guarantees provided by the creator of the dataset."
    - `columns` · list
      "The columns that constitute the primary key. These columns must satisfy the following constraints: - The list of columns must be non-empty. - The list must not contain duplicate columns after applying column normalization. - Each referenced column must exist in the schema. - The type of each referenced column must be one of the following: `BYTE`, `SHORT`, `DECIMAL`, `INTEGER`, `LONG`, `STRING`, `BOOLEAN`, `TIMESTAMP` or `DATE`."
    - `resolution` · union · required
      "The semantics of the primary key within the dataset. For example, the unique resolution means that every row in the dataset has a distinct primary key. The value of this field represents a contract for writers of the dataset. Writers are responsible for maintaining any related invariants, and readers may make optimizations based on this. Violating the assumptions of the resolution can cause undefined behavior, for example, having duplicate primary keys with the unique resolution."
      - `unique` · object
        "Primary key values are unique within the dataset – no conflicts."
      - `duplicate` · object
        "Duplicate primary key values may exist within the dataset – resolution required."
        - `deletionColumn` · string
          "The name of the boolean column that indicates whether a row should be considered deleted. Based on the `resolutionStrategy`, if the final row selected for a given primary key has `true` in this column, that row will be excluded from the results. Otherwise, it will be included."
        - `resolutionStrategy` · union · required
          - `latestWins` · object
            "Picks the row with the highest value of a list of columns, compared in order."
            - `columns` · list

## Errors

- `ViewPrimaryKeyCannotBeModified` (CONFLICT) — "A primary key already exits."
- `ViewNotFound` (NOT_FOUND) — "The requested View could not be found. Either the view does not exist, the branch is not valid or the
client token does not have access to it."
- `ViewPrimaryKeyMustContainAtLeastOneColumn` (INVALID_ARGUMENT) — "No columns were provided as part of the primary key"
- `ViewPrimaryKeyRequiresBackingDatasets` (INVALID_ARGUMENT) — "Cannot add a primary key to a View that does not have any backing datasets."
- `InvalidViewPrimaryKeyColumnType` (INVALID_ARGUMENT) — "The type of each referenced column in the primary key must be one of the following: BYTE, SHORT, DECIMAL,
INTEGER, LONG, STRING, BOOLEAN, TIMESTAMP or DATE."
- `NotAllColumnsInPrimaryKeyArePresent` (INVALID_ARGUMENT) — "Not all columns in the View's primary key are present in the dataset(s)."
- `ViewPrimaryKeyDeletionColumnNotInDatasetSchema` (INVALID_ARGUMENT) — "The deletion column is not present in the dataset."
- `InvalidViewPrimaryKeyDeletionColumn` (INVALID_ARGUMENT) — "The deletion column must be a boolean."
- `AddPrimaryKeyPermissionDenied` (PERMISSION_DENIED) — "Could not addPrimaryKey the View."
