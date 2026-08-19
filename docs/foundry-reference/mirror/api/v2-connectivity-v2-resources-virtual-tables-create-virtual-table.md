<!-- source: https://palantir.com/docs/foundry/api/v2/connectivity-v2-resources/virtual-tables/create-virtual-table/ · mirrored 2026-08-19 from Palantir Foundry docs -->

# Create Virtual Table

`POST /api/v2/connectivity/connections/{connectionRid}/virtualTables`

Creates a new [Virtual Table](/docs/foundry/data-integration/virtual-tables/) from an upstream table. The VirtualTable will be created
in the specified parent folder and can be queried through Foundry's data access APIs.


Third-party applications using this endpoint via OAuth2 must request the following operation scope: `api:connectivity-virtual-table-write`.

Scopes: `api:connectivity-virtual-table-write`

## Path parameters

- `connectionRid` · string · required
  "The Resource Identifier (RID) of a Connection (also known as a source)."

## Request

- `CreateVirtualTableRequest` · object · required
  - `markings` · list
    - `MarkingId` · string · required
      "The ID of a security marking."
  - `parentRid` · string · required
    "The unique resource identifier (RID) of a Folder."
  - `name` · string · required
    "The name of a VirtualTable."
  - `config` · union · required
    - `snowflake` · object
      "Pointer to the table in Snowflake. Uses the Snowflake table identifier of database, schema and table."
      - `database` · string · required
        "The database name."
      - `schema` · string · required
        "The schema name."
      - `table` · string · required
        "The table name."
    - `unity` · object
      "Pointer to the table in Unity Catalog. Uses the Databricks table identifier of catalog, schema and table."
      - `catalog` · string · required
        "The catalog name."
      - `schema` · string · required
        "The schema name."
      - `table` · string · required
        "The table name."
    - `glue` · object
      "Pointer to the table in AWS Glue."
      - `database` · string · required
        "The database name."
      - `table` · string · required
        "The table name."
    - `delta` · object
      "Pointer to the Delta table in cloud object storage (e.g., Azure Data Lake Storage, Google Cloud Storage, S3)."
      - `path` · string · required
        "The path of the Delta table in object storage."
    - `iceberg` · object
      "Pointer to the Iceberg table."
      - `tableIdentifier` · string · required
        "The identifier of the Iceberg table."
      - `warehousePath` · string
        "The path to the folder in the file system containing the Iceberg table. Can be omitted when the connection is configured with a catalog that does not rely on warehouse path."
    - `files` · object
      "Pointer to the table in cloud object storage (e.g., Azure Data Lake Storage, Google Cloud Storage, S3)."
      - `format` · enum · required
        one of `AVRO`, `CSV`, `PARQUET`
        "The format of files in the upstream source."
      - `path` · string · required
        "Storage path for the data in the underlying file system, i.e. paths like `/foo/bar`. The scheme is not included. May be either a folder or file. A non-partitioned table will have a single location. A partitioned table can have multiple locations, one for each partition."
    - `bigquery` · object
      "Pointer to the table in BigQuery. Uses the BigQuery table identifier of project, dataset and table."
      - `project` · string · required
        "The BigQuery project name."
      - `dataset` · string · required
        "The BigQuery dataset name."
      - `table` · string · required
        "The BigQuery table name."

## Response

- `VirtualTable` · object · required
  "The created VirtualTable"
  - `rid` · string · required
    "The Resource Identifier (RID) of a registered VirtualTable."
  - `name` · string · required
    "The name of a VirtualTable."
  - `parentRid` · string · required
    "The unique resource identifier (RID) of a Folder."
  - `config` · union · required
    - `snowflake` · object
      "Pointer to the table in Snowflake. Uses the Snowflake table identifier of database, schema and table."
      - `database` · string · required
        "The database name."
      - `schema` · string · required
        "The schema name."
      - `table` · string · required
        "The table name."
    - `unity` · object
      "Pointer to the table in Unity Catalog. Uses the Databricks table identifier of catalog, schema and table."
      - `catalog` · string · required
        "The catalog name."
      - `schema` · string · required
        "The schema name."
      - `table` · string · required
        "The table name."
    - `glue` · object
      "Pointer to the table in AWS Glue."
      - `database` · string · required
        "The database name."
      - `table` · string · required
        "The table name."
    - `delta` · object
      "Pointer to the Delta table in cloud object storage (e.g., Azure Data Lake Storage, Google Cloud Storage, S3)."
      - `path` · string · required
        "The path of the Delta table in object storage."
    - `iceberg` · object
      "Pointer to the Iceberg table."
      - `tableIdentifier` · string · required
        "The identifier of the Iceberg table."
      - `warehousePath` · string
        "The path to the folder in the file system containing the Iceberg table. Can be omitted when the connection is configured with a catalog that does not rely on warehouse path."
    - `files` · object
      "Pointer to the table in cloud object storage (e.g., Azure Data Lake Storage, Google Cloud Storage, S3)."
      - `format` · enum · required
        one of `AVRO`, `CSV`, `PARQUET`
        "The format of files in the upstream source."
      - `path` · string · required
        "Storage path for the data in the underlying file system, i.e. paths like `/foo/bar`. The scheme is not included. May be either a folder or file. A non-partitioned table will have a single location. A partitioned table can have multiple locations, one for each partition."
    - `bigquery` · object
      "Pointer to the table in BigQuery. Uses the BigQuery table identifier of project, dataset and table."
      - `project` · string · required
        "The BigQuery project name."
      - `dataset` · string · required
        "The BigQuery dataset name."
      - `table` · string · required
        "The BigQuery table name."
  - `markings` · list
    - `MarkingId` · string · required
      "The ID of a security marking."

## Errors

- `InvalidVirtualTableConnection` (INVALID_ARGUMENT) — "The specified connection is invalid or inaccessible."
- `VirtualTableAlreadyExists` (CONFLICT) — "A VirtualTable with the same name already exists in the parent folder."
- `VirtualTableRegisterFromSourcePermissionDenied` (PERMISSION_DENIED) — "User lacks permission to use the specified connection for virtual table registration."
- `CreateVirtualTablePermissionDenied` (PERMISSION_DENIED) — "Could not create the VirtualTable."
- `ConnectionNotFound` (NOT_FOUND) — "The given Connection could not be found."
