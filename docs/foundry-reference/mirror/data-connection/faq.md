<!-- source: https://palantir.com/docs/foundry/data-connection/faq/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Data Connection FAQ

The following are some frequently asked questions about Data Connection.

For general information, view our [Data Connection documentation](/docs/foundry/data-connection/overview/).

* [Scheduled build never ran](#scheduled-build-never-ran)
* [Ingestion led to duplicate rows in a dataset when running `SNAPSHOT` transaction](#ingestion-led-to-duplicate-rows-in-a-dataset-when-running-a-snapshot-transaction)
* [Incremental load run time info](#incremental-load-run-time-info)
* [Column type is not consistent between database and dataset](#column-type-is-not-consistent-between-database-and-dataset)
* [Status of running query](#status-of-running-query)
* [Sync is failing with a schema mismatch](#sync-is-failing-with-a-schema-mismatch)
* [Permission error when re-adding a deleted sync job spec](#permission-error-when-re-adding-a-deleted-sync-job-spec)
* [Bootvisor status is `Unknown`](#bootvisor-status-is-unknown)
* [SSL/TLS issues](#common-tlsssl-issues)

***

## Scheduled build never ran

A build was scheduled to run at a given time, but it did not attempt to run.

To troubleshoot, perform the following steps:

1. Is there another running sync for this dataset and branch? Verify that no other job is running at the same time as it is not possible to run two syncs on the same dataset and branch simultaneously.

2. Has the schedule been paused? Verify this schedule is not paused on the schedule overview page for this dataset. You can access this page via the **Edit in Scheduler** view of the sync or in Dataset Preview's **Manage Schedules** option.

3. Was the agent of this sync disabled? Navigate to the agent associated with the source of this sync, and verify the agent is not disabled.

[Return to top](#data-connection-faq)

***

## Ingestion led to duplicate rows in a dataset when running a `SNAPSHOT` transaction

A sync ran but led to duplicate rows.

1. When creating a new sync, choose to run an `APPEND` type sync instead of a `Snapshot`.
2. When declaring the incremental settings, if `last_upd_in_appl_ts` is the column that will be unique and always increasing, set that as the column and then select a value that is less than all the other values in this column.
3. After this, no additional action should be required as Data Connection will track the latest value that was synced and only bring in additional newer rows. Newer means greater than previous values, and newer timestamps are greater than older timestamps.

[Return to top](#data-connection-faq)

***

## Incremental load run time info

What value was used when I ran my incremental sync?

To troubleshoot, perform the following steps:

1. Go to the dataset.
2. Select **History** near the top of the screen.
3. Select the relevant transaction you are interested in on the left part of the screen.
4. View **Build**.
5. View **Transaction**.
6. Expand the section for **Custom Metadata** towards the bottom of the screen.
7. Review the block for `incrementalMetadata` and verify correctness.

[Return to top](#data-connection-faq)

***

## Column type is not consistent between database and dataset

My type is something different from what appears on my dataset after it synced.

To troubleshoot, perform the following steps:

1. If the column is `TIMESTAMP`, verify if the resultant type is `LONG` in Foundry.  If it is `LONG`, you need to parse the type using your data preparation tool of choice (Code Repositories, Preparation, or another application) to `TIMESTAMP`. This is a side effect of many drivers provided by database creators where types are reverted to their safest representations.
2. If the column is `DECIMAL` and has a different precision than the original database, we recommend casting the number to a specific precision and scale in the query on the database itself, or casting the column to `VARCHAR` in the query and re-casting in Foundry.

[Return to top](#data-connection-faq)

***

## `TIME` type columns lose sub-second precision between database and dataset

My database includes `TIME` type columns with sub-second precision and values with a non-zero sub-second component, but the value in the dataset only reflects distinctions up to the second component.

For most JDBC-based sources, including PostgreSQL and Microsoft SQL Server, a `TIME` value in the database is reflected in the Foundry output dataset as an `INTEGER` representing the milliseconds since midnight rounded down to the nearest full second. As a result, values in the database like `05:00:00.000`, `05:00:00.200`, and `05:00:00.800` will all become `18000000` in the output dataset.

To preserve sub-second distinctions, consider casting the value to a string in the sync configuration's SQL statement, as in the below Postgres example:

```sql
SELECT record_id, CAST(column_with_time_type AS text) FROM table_name
```

***

## Status of running query

After a query begins running, how do I check its status?

To troubleshoot, perform the following steps:

1. Open the **Job tracker** application and select the running sync.
2. The most granular status of a sync is shown here.
3. If possible, verify the query behavior in the source database.

[Return to top](#data-connection-faq)

***

## Sync is failing with a schema mismatch

If the schema of a file or JDBC table changes between incremental `APPEND` transactions, your dataset will start failing with complaints of schema mismatches. Data Connection does infer schema for JDBC extracts, only propagates existing schemas for file-based extracts. In this event, you would have to apply the schema inference again if it is the same. If schemas truly have changed between `APPEND` transactions, a new dataset is needed for the new schema.

To troubleshoot, perform the following steps:

**File-based**

1. If the files are XLSX or CSV tabular data, it may be possible to re-infer schemas on the synced dataset without issue. If this schema matches the previous, the dataset will add the appended rows without issue.

2. If after inferring schema you still get schema errors (either in Dataset Preview or another application), then this new file needs to instead be synced to a new dataset since it represents a fundamentally different view of a table.

3. If the dataset was already appended with the new schema, we recommend reaching out to Palantir Support to revert this transaction. Additionally, the syncs of files to the current dataset need to be paused by going to the sync overview page and pausing any schedule associated with this sync.

4. Subsequent files with new schemas should sync to a different dataset than the original, so we recommend copying the information from the original sync into a new sync, but replacing the target dataset with a different one (annotating in the dataset name the new version).

5. Additionally, it may be best to delete the original sync to avoid any future schema mismatch errors from occurring and corrupting the existing data in Foundry.

**JDBC**

1. In the case where you expect a schema to change at some point and persist in its new form into the future, it is best to land the original table into a dataset whose name indicates the schema version. (Such as `account_transactions_v1.0`).
2. If a schema changes in the original table before a sync executes:
   * Pause the sync's schedule (if it exists)
3. If a schema changes in the original table after a sync executes:
   * Pause the sync's schedule (if it exists)
   * Contact Palantir Support to revert this transaction which has likely corrupted the target dataset
4. After your sync is paused, and you are ready to move to the new schema, you must first land the new schema into a new dataset:
   * Clone the sync into a new sync and replace the target dataset with a new one (such as `account_transactions_v1.1`). This new dataset can then be unioned with the original to contain the full set of data.
   * If required for your use case, you can delete the original sync after verifying correct behavior in the new sync. This ensures no possibility of landing corrupt data in the old dataset at the cost of decreased transparency on prior loading configuration.

[Return to top](#data-connection-faq)

***

## Permission error when re-adding a deleted sync job spec

After deleting a sync's job spec, attempting to re-add it results in a permission error.

To resolve this issue:

Create a new sync that outputs to the same dataset. This establishes a new job spec with the correct permissions while preserving your existing data in the target dataset.

[Return to top](#data-connection-faq)

***

## Bootvisor status is `Unknown`

My Bootvisor is stuck in a `Unknown` state and won't stop / start.

:::callout{theme="warning"}
Contact Palantir Support to check your setup before proceeding. Following the below steps will temporarily prevent syncs from running on this agent. Ensure multiple agents for sources or perform these steps during maintenance windows to prevent downtime.
:::

1. Pause syncs on the agent.
2. Wait for all currently running syncs to finish.
3. Stop the agent (this step may fail depending on the current state of the agent).
4. SSH into the agent machine.
5. `kill` all JVM processes related to Data Connection.
6. Start the Bootvisor with `./service/bin/init.sh start`.
7. Start the agent in Data Connection, verifying the agent is not `paused` as well.

[Return to top](#data-connection-faq)

***

## Common TLS/SSL issues

For guidance on TLS, mTLS, and SSL — including whether to add a server or client certificate and how to resolve common certificate errors such as `CERTIFICATE_VERIFY_FAILED` — see [Certificates and TLS](/docs/foundry/data-connection/troubleshooting/#certificates-and-tls).

[Return to top](#data-connection-faq)
