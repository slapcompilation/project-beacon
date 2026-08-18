<!-- source: https://palantir.com/docs/foundry/building-pipelines/streaming-keys/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Streaming keys

Foundry streams allow you to specify one or more columns as key columns, as well as a primary key to identify a resolved record. The sections below explain how to set up and maintain both partitions and primary keys for your streaming pipeline.

## Partition keys

Generally, [*primary* keys](/docs/foundry/transforms-python/data-expectations-reference/#primary-key) in the Palantir platform are used to uniquely identify a database record. However, *partition* keys in Foundry streams group *records* with the same **key**, such as all *readings* for a particular **device**, or all *transactions* for a particular **customer**. In contrast to primary keys in batch pipelines, partition keys in streams do not deduplicate records since they do not uniquely identify records.

Keys in Foundry allow users to ensure all records for a particular key will maintain order. When the record enters Foundry, it is stored internally in Kafka. Kafka guarantees that records written to the same partition will maintain order on read and write. If a record is sent to Foundry with no key, the record will be written to any partition in the internal Kafka topic in a round-robin style. However, if the user specifies a key for the record, the record will be written to the dedicated partition for that key, thus maintaining order when consumed downstream.

Similarly, Flink streaming jobs automatically maintain ordering based on the partition key column(s) set on input sources. Flink transform jobs may run with one or more parallel partitions per transform operation. For partition keyed input streams, Flink jobs will automatically send all records with the same values for all key columns to the same parallel operator instance. Unless specifically re-keyed (as with the [`Key by` transform](/docs/foundry/pb-functions-transform/keyByV3/)), partitioning and ordering for the entire length of the pipeline is determined by the key columns and row values as they were on the source, even if transform logic drops columns or overwrites values.

## Primary keys: Change data capture (CDC) mode

Primary keys in Foundry streams work similarly to those used in relational databases and in batch datasets. However, streaming primary keys consist of a set of deduplication columns that uniquely identify a resolved record and do not specify ordering columns.

The primary key is a piece of metadata that lives in the schema of a stream in Foundry. The key does not impact the contents of the stored data or how streaming data pipelines and transforms are applied. Primary keys control how some Foundry consumers read the data; the full *data* can be thought of as a **changelog**, while the *primary key* tells consumers how to compute a deduplicated **current view** of the data after applying all changes.

The current view is a filtered view of the data that only contains the most recently streamed record for each key. The full most recent record for a key will always be retained, even if it contains `nulls`. If a deleted column is specified, and the most recently streamed record for a key has this value set to `true`, the record will be filtered.

The following example shows a primary key and data stream, where the most recently streamed rows are higher in the table.

Primary key: `{Dedeuplication column(s): [Key], isDeletedColumn: Optional[isDeleted]}`

| Key  | Value     | isDeleted |\
|------|-----------|-----------|\
| Key2 | `null`    | `false`   |
| Key1 | thirdVal  | `true`    |
| Key2 | secondVal | `false`   |
| Key1 | firstVal  | `false`   |

This stream of changelogs, when read by a CDC-aware consumer, will be read as the following current view:

| Key  | Value     | isDeleted |\
|------|-----------|-----------|\
| Key2 | `null`    | `false`   |

If you choose to set a primary key for your streaming data, you must also set the same columns as partition keys to maintain ordering and correctly resolve deduplicated data views. Once you set a primary key in the streaming setup interface, the same columns will be automatically added as partition key columns.

The following two CDC-aware jobs will automatically read primary keyed streaming data as a current view:

1. **Hydrate the Ontology with a primary keyed stream:** New update records will cause a new object to be created, updated, or deleted as necessary.
2. **A stream's archive dataset is read by any Spark transformation job:** Before any transformations occur, the source will be deduplicated. Notably, almost all interactions with the archive dataset run a Spark job, including Dataset Previews and Contour analyses. When viewing the archive dataset, it will always appear as a deduplicated current view, even though the data itself contains the full changelog (if you download the data as a file). The full changelog will be processed by any streaming job that does not run Spark, including replays.

## Key propagation

Pipeline Builder tracks the evolution of both partition key and primary key columns through pipeline transforms and writes any valid keys to the schema of the output stream. If your transforms do not invalidate any key columns, the same partitioning and deduplication instructions will be automatically maintained in a sequence of any number of downstream pipelines.

If you rename a key column, the key will update to contain the new column name. Similarly, if you apply a transform that removes or overwrites a key column, that column will be removed from the key. Since any overwriting of key column contents may represent a new ordering guarantee or a new deduplication strategy, Pipeline Builder drops the column from the key entirely. You must apply the `Key by` transform again if you want to keep a key column that was previously overwritten. Even when partition key columns are dropped due to removals or overwrites, the same ordering guarantee will persist for the remainder of the pipeline unless you re-key.

:::callout{theme="warning"}
If all partition keys or deduplication CDC keys are removed or overwritten, the key will be dropped entirely. Be mindful when deleting or overwriting the contents of key columns; doing so may lead to unexpected results, including losing ordering guarantees or deduplication strategies.
:::

Currently, keys **never** propagate for user-defined functions (UDFs). Since the function is user-defined, there is no way to infer which key propagation strategy, if any, the user intends. If you intend to propagate keys, be sure to apply the `Key by` transform after your UDF.

Additionally, primary keys do not propagate for stateful transforms (most transforms are not stateful).

## Use a streaming key

In a streaming pipeline in the Pipeline Builder application, add the `Key by` transform to your graph. Notably, any keys you set here will override and replace any keys that were on the input data.

If you only want to set a partition key, toggle off the `CDC mode` option and only supply the `Key by columns` list. The other parameters are not required or allowed unless you are in CDC mode.

To set both a primary and partition key, toggle on the **CDC mode** option. If you have an `isDeleted` column, optionally specify it in the **Primary key is deleted** field. For streaming use cases, we highly recommend leaving the optional **Primary key ordering columns** parameter blank. The transform will set both a partition and primary key, where the partition key columns are the same as primary key deduplication columns. The **Primary key ordering columns** parameter matters only when consuming the archive dataset in a batch job and will never impact how streaming thinks about deduplication. The option to specify ordering columns is available for backwards compatibility, users of batch transforms, or users who intend to consume the stream archive in a specific batch-only way.

## Check current keys

The following sections describe how to find and verify streaming key logic in your Foundry stream.

### Check partition keys

Open your streaming dataset, navigate to the **Details** tab, then open the **Schema** tab to view the data schema in JSON.

Search for `includeInParitioning`, which will appear in an element of the `fieldSchemaList` for each column that is part of the primary key:

```
"customMetadata": {
"includeInPartitioning": true
}
```

If you do not see any schema fields with `includeInParitioning`, your stream is not keyed and ordering is not guaranteed for how your data will be stored or processed. To manually add keys, edit the schema as JSON text and insert the custom metadata (as described above) to each schema field (column) that you want to set as a partition key column.

:::callout{theme="neutral"}
If a stream already has one or more partition keys, adding a new partition key column will cause a *weaker* ordering guarantee since there will be more partitions; order is only guaranteed to be maintained for rows that share the same value for all partition key columns.
:::

Before deployment, if partition key columns are set on an input stream to a pipeline, ordering will be guaranteed for that source and all its transforms for the entire pipeline unless you intentionally re-key. Partition key columns may appear in a data preview with a key symbol.

### Check primary keys

Open your streaming dataset, navigate to the **Details** tab, then open the **Schema** tab to view the data schema in JSON.

You will see a JSON property named `primaryKey`. If your stream has deduplication columns called `uniqueCol1` and `uniqueCol2`, and the `isDeleted` column is `isDeletedCol`, the schema should appear as follows:

```
  "primaryKey": {
    "columns": [
      "uniqueCol1",
      "uniqueCol2"
    ],
    "resolution": {
      "type": "duplicate",
      "duplicate": {
        "resolutionStrategy": {
          "type": "customStrategy",
          "customStrategy": {}
        },
        "deletionColumn": "isDeletedCol"
      }
    }
  }
```

If no primary key is set, the schema will show `null`:

```
"primaryKey": null
```

To manually set or remove the primary key, you may edit the schema JSON to specify a key in the above format, or use `null` to remove the key. If you manually set primary keys, we strongly recommend setting the same columns as partition key columns.

:::callout{theme="neutral"}
The only way to guarantee ordering is to set partition key columns on your entire streaming lineage. Once set, the partition key columns will automatically propagate downstream. Even if a stream is configured to have only one partition, ordering is not necessarily guaranteed due to the way Flink applications scale and process records non-deterministically.
:::

## Streaming key best practices

Choose partition keys carefully, as keys that result in inefficiently distributed records can artificially increase load and limit throughput. If ordering is important to your use case, then set a partition key to a generic grouping identifier on which you want to maintain order, such as email ID, customer ID, or organization ID. If ordering is not important for your use case, you can choose to use a unique ID as a key or to not use a key at all for your stream.

The ordering guarantee of your final streaming output will be as strong as the *weakest* guarantee in your streaming series (backed by Kafka topics) and transforms (Flink jobs) that lead to your output. Therefore, make sure your desired ordering is maintained and that correct partition keys are set for your entire data lineage, starting from an initial streaming extract that pulls records into Foundry. The ordering guarantee will be no stronger than the system from which you are extracting to Foundry. For example, if you are using a Kafka connector to extract from Kafka, set partition key columns equal to the Kafka key column to allow Foundry to maintain an equivalent ordering guarantee on your system.

Additionally, problems can arise if you completely change the partition columns (and the ordering guarantee) during a series of data transforms. If a different ordering was guaranteed before applying a new `Key by` transform, the transform will receive records that are out of order from the newly added key columns; these records will remain in the wrong order during the transform series.
