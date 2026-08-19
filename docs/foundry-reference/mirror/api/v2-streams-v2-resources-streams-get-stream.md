<!-- source: https://palantir.com/docs/foundry/api/v2/streams-v2-resources/streams/get-stream/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Get Stream

`GET /api/v2/streams/datasets/{datasetRid}/streams/{streamBranchName}`

Get a stream by its branch name. If the branch does not exist, there is no stream on that branch, or the
user does not have permission to access the stream, a 404 error will be returned.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:streams-read`.

Scopes: `api:streams-read`

## Path parameters

- `datasetRid` · string · required
  "The Resource Identifier (RID) of a Dataset."
- `streamBranchName` · string · required
  "The name of a Branch."

## Response

- `Stream` · object · required
  - `branchName` · string · required
    "The name of a Branch."
  - `schema` · object · required
    "The Foundry schema for this stream."
    - `fields` · list
      - `Field` · object · required
        "A field in a Foundry schema. For more information on supported data types, see the [supported field types](/docs/foundry/data-integration/datasets/#supported-field-types) user documentation."
        - `name` · string · required
        - `schema` · object · required
          "The specification of the type of a Foundry schema field."
          - `nullable` · boolean · required
          - `customMetadata` · map
          - `dataType` · union · required
            - `struct` · object
              - `subFields` · list
                - `Field` · object · required
                  "A field in a Foundry schema. For more information on supported data types, see the [supported field types](/docs/foundry/data-integration/datasets/#supported-field-types) user documentation."
            - `date` · object
            - `string` · object
            - `byte` · object
            - `double` · object
            - `integer` · object
            - `float` · object
            - `long` · object
            - `boolean` · object
            - `array` · object
              - `itemsSchema` · object · required
                "The specification of the type of a Foundry schema field."
            - `binary` · object
            - `short` · object
            - `decimal` · object
              - `precision` · integer
                "The total number of digits of the Decimal type. The maximum value is 38."
              - `scale` · integer
                "The number of digits to the right of the decimal point. The maximum value is 38."
            - `map` · object
              - `keySchema` · object · required
                "The specification of the type of a Foundry schema field."
              - `valueSchema` · object · required
                "The specification of the type of a Foundry schema field."
            - `timestamp` · object
    - `keyFieldNames` · list
      "The names of the fields to be used as keys for partitioning records. These key fields are used to group all records with the same key into the same partition, to guarantee processing order of grouped records. These keys are not meant to uniquely identify records, and do not by themselves deduplicate records. To deduplicate records, provide a change data capture configuration for the schema. Key fields can only be of the following types: - Boolean - Byte - Date - Decimal - Integer - Long - Short - String - Timestamp For additional information on keys for Foundry streams, see the [streaming keys](/docs/foundry/building-pipelines/streaming-keys/) user documentation."
      - `FieldName` · string · required
    - `changeDataCapture` · union
      "Configuration for utilizing the stream as a change data capture (CDC) dataset. To configure CDC on a stream, at least one key needs to be provided. For more information on CDC in Foundry, see the [Change Data Capture](/docs/foundry/data-integration/change-data-capture/) user documentation."
      - `fullRow` · object
        "Configuration for change data capture which resolves the latest state of the dataset based on new full rows being pushed to the stream. For example, if a value for a row is updated, it is only sufficient to publish the entire new state of that row to the stream."
        - `deletionFieldName` · string · required
          "The name of a boolean field in the schema that indicates whether or not a row has been deleted."
        - `orderingFieldName` · string · required
          "The name of an ordering field that determines the newest state for a row in the dataset. The ordering field can only be of the following types: - Byte - Date - Decimal - Integer - Long - Short - String - Timestamp"
  - `viewRid` · string · required
    "The view that this stream corresponds to."
  - `partitionsCount` · integer · required
    "The number of partitions for the Foundry stream. Defaults to 1. Generally, each partition can handle about 5 mb/s of data, so for higher volume streams, more partitions are recommended."
  - `streamType` · enum · required
    one of `LOW_LATENCY`, `HIGH_THROUGHPUT`
    "A conceptual representation of the expected shape of the data for a stream. HIGH_THROUGHPUT and LOW_LATENCY are not compatible with each other. Defaults to LOW_LATENCY."
  - `compressed` · boolean · required
    "Whether or not compression is enabled for the stream. Defaults to false."

## Errors

- `InvalidFieldSchema` (INVALID_ARGUMENT) — "The field schema failed validations"
- `InvalidStreamNoSchema` (INVALID_ARGUMENT) — "The requested stream exists but is invalid, as it does not have a schema."
- `InvalidStreamType` (INVALID_ARGUMENT) — "The stream type is invalid."
- `StreamNotFound` (NOT_FOUND) — "The given Stream could not be found."
