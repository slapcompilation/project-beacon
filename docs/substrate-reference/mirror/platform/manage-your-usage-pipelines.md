<!-- source: https://supabase.com/docs/guides/platform/manage-your-usage/pipelines · mirrored 2026-08-13 from Supabase docs -->

# Manage Pipelines usage

## What you are charged for

You are charged for configured pipelines and pipeline data processed. Data processed is billed at different rates during initial sync and ongoing replication. Pipelines are charged by the hour for as long as they are configured, including while they are stopped.

- **Pipeline hours** measure how long each pipeline remains configured. Delete a pipeline to end this charge.
- **Initial sync data processed** is the Postgres row data accepted by the destination when a table is first synchronized or synchronized again.
- **Ongoing replication data processed** is the Postgres row data accepted by the destination for subsequent database changes. It depends on how much your published data changes, not on the source table size, WAL size, or destination's compressed storage size.

Destination-provider charges are separate. For example, Google Cloud can charge for BigQuery ingestion, storage, and CDC compute.

## How data processed is measured

Pipeline data processed is the amount of logical row data emitted by Postgres for replication, successfully processed by a pipeline, and accepted by its destination. It is not based on physical table storage or destination-specific encoding, making usage consistent across destinations.

The measurement includes:

- **Initial sync and resynchronization**: Row data emitted by Postgres COPY.
- **Ongoing replication**: Row values Postgres emits for inserts, updates, and deletes. Updates include new row values and any previous identity values Postgres emits. Deletes include the emitted identity values.

Failed destination write attempts that Pipelines retries are not counted. Data is counted only after the destination acknowledges successful processing. In rare cases, Pipelines can count an acknowledged batch but crash or be interrupted before its replication checkpoint is persisted. Recovery can then process and count the same data again.

Data successfully processed again as part of a user-requested resynchronization, table restart, or pipeline reset is also counted again.

### Cost estimates

The Dashboard provides a quick planning estimate of initial sync volume and cost using information already available about your source tables. It is designed to give you a useful indication before initial sync begins without first scanning and encoding all the data that the sync will process.

If an estimate is unavailable, you can still create the pipeline or restart tables.

Note: Use this estimate as a planning guide rather than an exact quote. The final volume is measured from the data successfully processed during initial sync and can vary based on your published data and filters.

Actual charges use the logical Postgres row data copied after publication column and row filters and accepted by the destination.

### Usage on your invoice

Usage is shown as "ETL Pipeline Hours", "ETL Copy Backfill Data GB", and "ETL Replicated Data GB" on your invoice.

## Pricing

$0.053 per hour for each configured pipeline. $0.60 per Gigabyte of data processed during initial sync. $3.00 per Gigabyte of data processed during ongoing replication.

| Plan       | Configured Pipeline | Initial Sync Data Processed | Ongoing Replication Data Processed |
| ---------- | ------------------- | --------------------------- | ---------------------------------- |
| Free       | -                   | -                           | -                                  |
| Pro        | $0.053/hr           | $0.60 per GB                | $3.00 per GB                       |
| Team       | $0.053/hr           | $0.60 per GB                | $3.00 per GB                       |
| Enterprise | Custom              | Custom                      | Custom                             |

**Data processed** is Postgres row data successfully processed by a pipeline and accepted by its destination. It is measured from the logical row data emitted by Postgres for replication, rather than physical table storage or destination-specific encoding.

For a detailed breakdown of how charges are calculated, refer to [Manage Pipeline usage](https://supabase.com/docs/guides/platform/manage-your-usage/pipelines).

## Billing examples

### Billing period without an initial sync

The project has a configured pipeline for the entire month.

| Line Item                     | Units     | Costs       |
| ----------------------------- | --------- | ----------- |
| Pro Plan                      | -         | $25         |
| Compute Hours Small Project 1 | 730 Hours | $15.04      |
| ETL Pipeline Hours            | 730 Hours | $38.69      |
| ETL Replicated Data GB        | 150 GB    | $450        |
| **Subtotal**                  |           | **$528.73** |
| Compute Credits               |           | -$10        |
| **Total**                     |           | **$518.73** |

### Multiple projects with initial syncs

Multiple projects had a configured pipeline for the entire month and processed data during initial sync and ongoing replication.

| Line Item                           | Units     | Costs        |
| ----------------------------------- | --------- | ------------ |
| Pro Plan                            | -         | $25          |
|                                     |           |              |
| Compute Hours Small Project 1       | 730 Hours | $15.04       |
| ETL Pipeline Hours Project 1        | 730 Hours | $38.69       |
| ETL Replicated Data GB Project 1    | 15 GB     | $45          |
| ETL Copy Backfill Data GB Project 1 | 150 GB    | $90          |
|                                     |           |              |
| Compute Hours Small Project 2       | 730 Hours | $15.04       |
| ETL Pipeline Hours Project 2        | 730 Hours | $38.69       |
| ETL Replicated Data GB Project 2    | 70 GB     | $210         |
| ETL Copy Backfill Data GB Project 2 | 1,500 GB  | $900         |
|                                     |           |              |
| **Subtotal**                        |           | **$1377.46** |
| Compute Credits                     |           | -$10         |
| **Total**                           |           | **$1367.46** |

### After deleting a pipeline after one day

Pipeline hours are billed in arrears for as long as a pipeline is configured, including while it is stopped. After you delete the pipeline, pipeline-hour billing ends.

| Line Item                     | Hours | Costs      |
| ----------------------------- | ----- | ---------- |
| Pro Plan                      | -     | $25        |
|                               |       |            |
| Compute Hours Small Project 1 | 730   | $15.04     |
| ETL Pipeline Hours Project 1  | 24    | $1.27      |
|                               |       |            |
| **Subtotal**                  |       | **$41.31** |
| Compute Credits               |       | -$10       |
| **Total**                     |       | **$31.31** |

## Optimize usage

- Include only the tables and columns that you need at the destination.
- Keep high-churn tables out of the publication when their changes are not needed for analytics.
- If you no longer require replication, delete the pipeline through your [project's replication settings](https://supabase.com/dashboard/project/_/database/replication) to stop pipeline-hour charges.
