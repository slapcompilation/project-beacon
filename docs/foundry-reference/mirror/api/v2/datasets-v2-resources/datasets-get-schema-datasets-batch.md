<!-- source: https://palantir.com/docs/foundry/api/v2/datasets-v2-resources/datasets/get-schema-datasets-batch/ · mirrored 2026-08-15 from Palantir Foundry docs -->

# Get Schema Datasets Batch

`POST /api/v2/datasets/getSchemaBatch`

Fetch schemas for multiple datasets in a single request. Datasets not found 
or inaccessible to the user will be omitted from the response.


The maximum batch size for this endpoint is 1000.

Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:datasets-read`.

Scopes: `api:datasets-read`

## Request

- `body` · list · required
  - `GetSchemaDatasetsBatchRequestElement` · object · required
    - `endTransactionRid` · string
      "The Resource Identifier (RID) of the end Transaction. If a user does not provide a value, the RID of the latest committed transaction will be used."
    - `datasetRid` · string · required
      "The Resource Identifier (RID) of a Dataset."
    - `versionId` · string
      "The schema version that should be used. If none is provided, the latest version will be used."
    - `branchName` · string
      "The name of a Branch."

## Response

- `GetSchemaDatasetsBatchResponse` · object · required
  - `data` · map
    - `DatasetRid` · string · required
      "The Resource Identifier (RID) of a Dataset."
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
