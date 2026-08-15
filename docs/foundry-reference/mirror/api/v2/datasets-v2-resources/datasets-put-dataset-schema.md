<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/datasets/put-dataset-schema/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Put Dataset Schema

`PUT /api/v2/datasets/{datasetRid}/putSchema`

Adds a schema on an existing dataset using a PUT request.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-write`.

Scopes: `api:datasets-write`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."

## Request

- `PutDatasetSchemaRequest` · object · required
  - `branchName` · string
    "The name of a Branch."
  - `dataframeReader` · enum
    one of `AVRO`, `CSV`, `PARQUET`, `DATASOURCE`
    "The dataframe reader used for reading the dataset schema. Defaults to PARQUET."
  - `endTransactionRid` · string
    "The Resource Identifier (RID) of the end Transaction."
  - `schema` · object · required
    "The schema that will be added."
    - `fieldSchemaList` · list
      - `DatasetFieldSchema` · object · required
        "A field in a Foundry dataset."
        - `type` · enum · required
          one of `ARRAY`, `BINARY`, `BOOLEAN`, `BYTE`, `DATE`, `DECIMAL`, `DOUBLE`, `FLOAT`, `INTEGER`, `LONG`, `MAP`, `SHORT`, `STRING`, `STRUCT`, `TIMESTAMP`
          "The data type of a column in a dataset schema."
        - `name` · string
          "The name of a column. May be absent in nested schema objects."
        - `nullable` · boolean · required
          "Indicates whether values of this field may be null."
        - `userDefinedTypeClass` · string
          "Canonical classname of the user-defined type for this field. This should be a subclass of Spark's `UserDefinedType`."
        - `customMetadata` · map
          "User-supplied custom metadata about the column, such as Foundry web archetypes, descriptions, etc."
        - `arraySubtype` · object
          "Only used when field type is array."
        - `precision` · integer
          "Only used when field type is decimal."
        - `scale` · integer
          "Only used when field type is decimal."
        - `mapKeyType` · object
          "Only used when field type is map."
        - `mapValueType` · object
          "Only used when field type is map."
        - `subSchemas` · list
          "Only used when field type is struct."
          - `DatasetFieldSchema` · object · required
            "A field in a Foundry dataset."

## Response

- `GetDatasetSchemaResponse` · object · required
  - `branchName` · string · required
    "The name of a Branch."
  - `endTransactionRid` · string · required
    "The Resource Identifier (RID) of a Transaction."
  - `schema` · object · required
    "The schema for a Foundry dataset. Files uploaded to this dataset must match this schema."
    - `fieldSchemaList` · list
      - `DatasetFieldSchema` · object · required
        "A field in a Foundry dataset."
        - `type` · enum · required
          one of `ARRAY`, `BINARY`, `BOOLEAN`, `BYTE`, `DATE`, `DECIMAL`, `DOUBLE`, `FLOAT`, `INTEGER`, `LONG`, `MAP`, `SHORT`, `STRING`, `STRUCT`, `TIMESTAMP`
          "The data type of a column in a dataset schema."
        - `name` · string
          "The name of a column. May be absent in nested schema objects."
        - `nullable` · boolean · required
          "Indicates whether values of this field may be null."
        - `userDefinedTypeClass` · string
          "Canonical classname of the user-defined type for this field. This should be a subclass of Spark's `UserDefinedType`."
        - `customMetadata` · map
          "User-supplied custom metadata about the column, such as Foundry web archetypes, descriptions, etc."
        - `arraySubtype` · object
          "Only used when field type is array."
        - `precision` · integer
          "Only used when field type is decimal."
        - `scale` · integer
          "Only used when field type is decimal."
        - `mapKeyType` · object
          "Only used when field type is map."
        - `mapValueType` · object
          "Only used when field type is map."
        - `subSchemas` · list
          "Only used when field type is struct."
          - `DatasetFieldSchema` · object · required
            "A field in a Foundry dataset."
  - `versionId` · string · required
    "The version identifier of a dataset schema."

## Errors

- `BranchNotFound` (NOT_FOUND) — "The requested branch could not be found, or the client token does not have access to it."
- `DatasetNotFound` (NOT_FOUND) — "The requested dataset could not be found, or the client token does not have access to it."
- `InvalidSchema` (INVALID_ARGUMENT) — "The schema failed validations"
- `DatasetViewNotFound` (NOT_FOUND) — "The requested dataset view could not be found. A dataset view represents the effective file contents of a dataset
for a branch at a point in time, calculated from transactions (SNAPSHOT, APPEND, UPDATE, DELETE). The view may not
exist if the dataset has no transactions, contains no files, the branch is not valid, or the client token does not have access to it."
- `PutDatasetSchemaPermissionDenied` (PERMISSION_DENIED) — "Could not putSchema the Dataset."
