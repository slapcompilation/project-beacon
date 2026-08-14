<!-- source: https://palantir.com/docs/foundry/transforms-python/tables-api/ · mirrored 2026-08-14 from Palantir Foundry docs -->

# API overview

The `transforms-tables` library provides `TableInput` and `TableOutput` parameters to interact with virtual tables in Python transforms. These behave in a similar way to the `Input` and `Output` parameters used with Foundry datasets. However, writing to a virtual table requires additional configuration to [specify the source](/docs/foundry/data-integration/source-type-overview/) and the location within the external system where the table will be stored. The virtual table will be created during checks, as with dataset outputs. Once created, the extra configuration for the source and table metadata can be removed from the `TableOutput` and replaced with the table RID to be more concise.

```python
from transforms.api import transform
from transforms.tables import TableInput, TableOutput, TableTransformInput, TableTransformOutput, SnowflakeTable


@transform.spark.using(
    source_table=TableInput(alias: str),
    output_table=TableOutput(
        alias: str,  # The Compass path where the virtual table should be registered
        source: str,  # The source RID where the output table should be written
        table: Table,  # The locator defining where the output table should be stored in the external system
    ),
)
def compute(source_table: TableTransformInput, output_table: TableTransformOutput):
    ...  # Normal transforms API
```

The `table: Table` parameter in `TableOutput` defines where the output table should be created in the external system.

:::callout{theme="warning" title="Source and location cannot be changed after creation"}
Once a virtual table has been created, it is not possible to change its source or location. Modifying the source or location will cause checks to fail.
:::

The available `Table` subclasses are:

* `BigQueryTable(project: str, dataset: str, table: str)`
* `DatabricksTable(catalog: str, schema: str, table: str, format: Optional[str], location: Optional[str])`
* `DeltaTable(path: str)`
* `FilesTable(path: str, format: str)`
* `IcebergTable(table: str, warehouse_path: Optional[str])`
* `SnowflakeTable(database: str, schema: str, table: str)`

You must use the appropriate class based on the type of source you are connecting to. Refer to the documentation below for more information.

#### `transforms.tables.BigQuery`

Configures an output table in [Google BigQuery ↗](https://cloud.google.com/bigquery/docs).

**Constructor:**

```python
BigQueryTable(project: str, dataset: str, table: str)
```

| Parameter | Type | Description | Optional |
| --- | --- | --- | --- |
| `project` | `str` | The Google Cloud project ID where the BigQuery dataset resides. | No |
| `dataset` | `str` | The name of the BigQuery dataset containing the table. | No |
| `table` | `str` | The name of the BigQuery table. | No |

#### `transforms.tables.DatabricksTable`

Configures an output table in [Databricks ↗](https://docs.databricks.com/aws/en/). Note that writing to tables in Databricks requires **external access** to be set up in Unity Catalog. Review the [Databricks](/docs/foundry/available-connectors/databricks/#virtual-tables) section of the virtual tables documentation for more information.

**Constructor:**

```python
DatabricksTable(
    catalog: str,
    schema: str,
    table: str,
    format: Optional[str],
    location: Optional[str] = None
)
```

| Parameter | Type | Description | Optional |
| --- | --- | --- | --- |
|`catalog` | `str` | The Databricks catalog name. | No |
|`schema` | `str` | The schema (database) name within the catalog. | No |
|`table` | `str` | The table name. | No |
|`format` | `Optional[str]` | The file format (`delta`, `iceberg`). Defaults to `delta`. | Yes |
|`location` | `Optional[str]` | The storage location for an external table (for example, `abfss://<bucket-path>/<table-directory>`). | Yes |

The following types of tables can be written to in Databricks:

* **External Delta table:** The `location` parameter should specify the directory in cloud storage where the table should be stored. The `format` parameter defaults to `delta` so is not strictly required. Refer to the [official Databricks documentation ↗](https://docs.databricks.com/aws/en/tables/external) for more information on external tables.
* **Managed Iceberg table:** The `format` parameter should be set to `iceberg`. The location where the table will be stored is determined by Unity Catalog, so the `location` parameter is not required. Refer to the [official Databricks documentation ↗](https://docs.databricks.com/aws/en/iceberg) for more information on managed Iceberg tables.

#### `transforms.tables.DeltaTable`

Configures an output table in [Delta Lake ↗](https://docs.delta.io/latest/).

**Constructor:**

```python
DeltaTable(path: str)
```

| Parameter | Type | Description | Optional |
| --- | --- | --- | --- |
| `path` | `str` | The storage path to the Delta table. | No |

Can be used with [Azure Blob Filesystem](/docs/foundry/available-connectors/onelake-and-azure-blob-filesystem/), [Google Cloud Storage](/docs/foundry/available-connectors/google-cloud-storage/), or [Amazon S3](/docs/foundry/available-connectors/amazon-s3/) sources.

#### `transforms.tables.FilesTable`

Configures an output table stored in Avro, CSV, or Parquet format in a cloud storage location.

**Constructor:**

```python
FilesTable(path: str, format: str)
```

| Parameter | Type | Description | Optional |
| --- | --- | --- | --- |
| `path` | `str` | The path to the folder . | No |
| `format` | `str` | The file format (`avro`, `csv`, `parquet`). | No |

Can be used with [Azure Blob Filesystem](/docs/foundry/available-connectors/onelake-and-azure-blob-filesystem/), [Google Cloud Storage](/docs/foundry/available-connectors/google-cloud-storage/), or [Amazon S3](/docs/foundry/available-connectors/amazon-s3/) sources.

#### `transforms.tables.IcebergTable`

Configures an output table in an [Apache Iceberg ↗](https://iceberg.apache.org/docs/latest/) catalog.

**Constructor:**

```python
IcebergTable(table: str, warehouse_path: Optional[str] = None)
```

| Parameter | Type | Description | Optional |
| --- | --- | --- | --- |
| `table` | `str` | The full table identifier (for example, db.table or catalog notation). | No |
| `warehouse_path` | `Optional[str]` | The warehouse storage path for the Iceberg table. | Yes |

Refer to the [Iceberg catalogs](/docs/foundry/data-integration/virtual-tables/#iceberg-catalogs) section of this documentation for more information on supported sources.

#### `transforms.tables.SnowflakeTable`

Configures an output table in [Snowflake ↗](https://docs.snowflake.com/).

**Constructor:**

```python
SnowflakeTable(database: str, schema: str, table: str)
```

| Parameter | Type | Description | Optional |
| --- | --- | --- | --- |
| `database` | `str` | The Snowflake database name. | No |
| `schema` | `str` | The schema name within the database. | No |
| `table` | `str` | The table name. | No |
