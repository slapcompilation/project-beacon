<!-- source: https://palantir.com/docs/foundry/data-health/checks-reference/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# Checks reference

This page provides more detailed documentation on available health check types.

|Category   |Check type                                                               |Supported resources |
|---        |---                                                                      |---                 |
|Status     |[Schedule status](#schedule-status)                                      |Datasets            |
|Status     |[Build status](#build-status)                                            |Datasets, Iceberg tables, Virtual tables            |
|Status     |[Job status](#job-status)                                                |Datasets, Iceberg tables, Virtual tables            |
|Status     |[Sync status](#sync-status)                                              |Datasets            |
|Time       |[Build duration](#build-duration)                                        |Datasets            |
|Time       |[Data freshness](#data-freshness)                                        |Datasets            |
|Time       |[Sync duration](#sync-duration)                                          |Datasets            |
|Time       |[Sync freshness](#sync-freshness)                                        |Datasets            |
|Time       |[Time since last updated](#time-since-last-updated)                      |Datasets, Iceberg tables, Virtual tables            |
|Time       |[Time since sync last updated](#time-since-sync-last-updated)            |Datasets            |
|Size       |[Dataset file count](#dataset-file-count)                                |Datasets            |
|Size       |[Dataset partition](#dataset-partition)                                  |Datasets            |
|Size       |[Row count](#row-count)                                                  |Datasets            |
|Size       |[Transaction file count](#transaction-file-count)                        |Datasets            |
|Size       |[Transaction file size](#transaction-file-size)                          |Datasets            |
|Content    |[Allowed column values](#allowed-column-values)                          |Datasets            |
|Content    |[Approximate unique percentage](#approximate-unique-percentage)          |Datasets            |
|Content    |[Column regex](#column-regex)                                            |Datasets            |
|Content    |[Approximate column relation](#approximate-column-relation)              |Datasets            |
|Content    |[Date range](#date-range)                                                |Datasets            |
|Content    |[Null percentage](#null-percentage)                                      |Datasets            |
|Content    |[Numeric mean](#numeric-mean)                                            |Datasets            |
|Content    |[Numeric median](#numeric-median)                                        |Datasets            |
|Content    |[Numeric range](#numeric-range)                                          |Datasets            |
|Content    |[Primary key](#primary-key)                                              |Datasets, Iceberg tables, Virtual tables            |
|Schema     |[Column](#column)                                                        |Datasets, Iceberg tables, Virtual tables            |
|Schema     |[Column count](#column-count)                                            |Datasets            |
|Schema     |[Schema](#schema)                                                        |Datasets, Iceberg tables, Virtual tables            |

## Status checks

### Schedule status

Checks whether the most recent build of the schedule succeeded or failed.

| Rule component | Description                                                                                                     | Example options    | Required? |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ | --------- |
| **Severity**   | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical | Y         |
| **Escalate**   | Whether to escalate severity after consecutive failures                                                         | Y, N               | N         |
| **Notes**      | Add a note to provide additional context                                                                        | Text               | N         |
| **Issues**     | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N               | N         |

A schedule status check is representative of the status of the pipeline or set of datasets that always build together. As a result, it will give a status across the various steps leading to the creation or update of this final dataset.

### Build status

Checks whether the most recent build of the dataset succeeded or failed.

| Rule component | Description                                                                                                     | Example options    | Required? |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ | --------- |
| **Severity**   | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical | Y         |
| **Escalate**   | Whether to escalate severity after consecutive failures                                                         | Y, N               | N         |
| **Notes**      | Add a note to provide additional context                                                                        | Text               | N         |
| **Issues**     | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N               | N         |

A build status check is representative of the status of the whole process leading to a final dataset to be built. As a result, it will give a status across the various steps leading to the creation or update of this final dataset. Note that if the intermediate datasets that are updated or created during the process also have a build status health check, these will not be updated. However, the job status will be updated for all these intermediate datasets.

### Job status

Checks whether the most recent job run on a dataset succeeded or failed.

| Rule component | Description                                                                                                     | Example options    | Required? |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ | --------- |
| **Severity**   | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical | Y         |
| **Escalate**   | Whether to escalate severity after consecutive failures                                                         | Y, N               | N         |
| **Notes**      | Add a note to provide additional context                                                                        | Text               | N         |
| **Issues**     | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N               | N         |

A job status check triggers independently from the build that causes the dataset to be refreshed or created. In other words, should the concerned dataset be the ultimate output of a given build or not, the job status check will run for each and every build of a particular dataset.

#### When to use job status, build status, or schedule status checks

In general it is recommended that all schedules have schedule status checks. If your schedule already has a schedule status check, installing job status checks on other datasets built by the same schedule is not recommended, as any job failing on the schedule will trigger a schedule status check.

Use a job status check with intermediate datasets if you want to check whether the dataset got updated, regardless of whether other datasets in the build were successfully updated. If needed, use a build status check if the dataset is a build output and you want to check that the entire build and all datasets, including this dataset, succeeded.

Build status and job status will be equivalent if the dataset is the only output of a build. They may differ if the dataset is an intermediate dataset or if the build has multiple outputs, and the job on the dataset succeeds (or does not run), but other jobs in the build fail and cause the build to fail.

### Sync status

Checks whether the most recent sync of the dataset to another database succeeded or failed.

| Rule component       | Description                                                                                                     | Example options                           | Required? |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------- |
| **Sync destination** | Which sync of the dataset to monitor, relevant especially when the dataset syncs to multiple destinations.      | `phonograph2-cache-worker`, `jdbc-worker` | Y         |
| **Severity**         | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                        | Y         |
| **Escalate**         | Whether to escalate severity after consecutive failures                                                         | Y, N                                      | N         |
| **Notes**            | Add a note to provide additional context                                                                        | Text                                      | N         |
| **Issues**           | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                      | N         |

## Time checks

### Build duration

Checks whether the total time a build takes to complete meets some threshold.

| Rule component       | Description                                                                                                     | Example options                                                                            | Required? |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **Build duration**   | Total time a build takes to complete (in days, minutes, or hours)                                               | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | N         |
| **Median deviation** | Difference (in [**approximate standard deviations**](#approximate-standard-deviation)) from the median time to complete recent builds                              | `1` Standard deviations, `10` Recent builds                                                | N         |
| **Severity**         | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Notes**            | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**           | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

As for the build status check, the build duration check will only be updated for the terminal output of the build. The intermediate datasets that are part of a larger build and have a build duration check attached to them will not be updated.

### Data freshness

Checks the time of the latest transaction on a dataset against the maximum value of a timestamp column. If the timestamp in the column represents when the row was added, this can be used to measure exact data freshness.

| Rule component      | Description                                                                                                     | Example options                                                                            | Required? |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **Column name**     | Column name of the column containing the time of the last update.                                               | `LAST_UPDATED`                                                                             | Y         |
| **Freshness range** | Time range during which to consider the column's latest data as "fresh" (in days, minutes, or hours)            | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | Y         |
| **Severity**        | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Notes**           | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**          | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

### Sync duration

Checks whether the total time a sync takes to complete meets some threshold.

| Rule component       | Description                                                                                                     | Example options                                                                            | Required? |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **Sync destination** | Which sync of the dataset to monitor, relevant especially when the dataset syncs to multiple destinations.      | `phonograph2-cache-worker`, `jdbc-worker` | Y         |
| **Sync duration**    | Total time a sync takes to complete (in days, minutes, or hours)                                                | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | N         |
| **Median deviation** | Difference (in [**approximate standard deviations**](#approximate-standard-deviation)) from the median time to complete recent syncs                               | `1` Standard deviations, `10` Recent builds                                                | N         |
| **Severity**         | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Notes**            | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**           | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

### Sync freshness

Checks the time of the latest sync of a dataset against the maximum value of a datetime column. If the timestamp in the column represents when the row was added, this can be used to measure exact data freshness.

| Rule component      | Description                                                                                                     | Example options                                                                            | Required? |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **Column name**     | Column name of the column containing the time of the last update.                                               | `LAST_UPDATED`                                                                             | Y         |
| **Freshness range** | Time range during which to consider the column's latest data as "fresh" (in days, minutes, or hours)            | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | Y         |
| **Severity**        | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Notes**           | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**          | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

### Time since last updated

Checks whether the total time since the dataset has updated (had a new transaction) meets some threshold.

| Rule component                | Description                                                                                                     | Example options                                                                            | Required? |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **Last updated**              | Total time since the dataset has updated (in days, minutes, or hours)                                           | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | N         |
| **Median deviation**          | Difference (in [**approximate standard deviations**](#approximate-standard-deviation)) from the median update time of recent builds                                | `1` Standard deviations, `10` Recent builds                                                | N         |
| **Ignore empty transactions** | Whether to exclude empty transactions when checking time since updated/median deviation. Transactions with no files will be ignored, as if they had not existed                         | Y, N                                                                                       | Y         |
| **Severity**                  | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Schedule**                  | [**Schedule**](/docs/foundry/health-checks/check-evaluation/) check to run automatically or manually                                 | Automatic, Custom Schedule                                                                 | Y         |
| **Notes**                     | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**                    | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

### Time since sync last updated

Checks whether the total time since the dataset last synced to some destination meets some threshold.

| Rule component                | Description                                                                                                     | Example options                                                                            | Required? |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **Last sync**                 | Total time since the dataset last synced to some destination (in days, minutes, or hours)                       | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | N         |
| **Median deviation**          | Difference (in [**approximate standard deviations**](#approximate-standard-deviation)) from the median update time of recent builds                                | `1` Standard deviations, `10` Recent builds                                                | N         |
| **Severity**                  | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Notes**                     | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**                    | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

## Size checks

### Dataset file count

Checks the total number of files in the latest [view](/docs/foundry/data-integration/datasets/) of the dataset.

| Rule component       | Description                                                                                                     | Example options                                                                            | Required? |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **File count**       | Total number of files in the most recent view of a dataset                                                      | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | Y         |
| **Severity**         | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Median deviation** | Difference (in [**approximate standard deviations**](#approximate-standard-deviation)) from the median number of files in recent builds                            | `1` Standard deviations, `10` Recent builds                                                | N         |
| **Notes**            | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**           | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

### Dataset partition

Checks if the partitioning of the dataset is performant.

| Rule component | Description                                                                                                             | Example options         | Required? |
| -------------- | ------------------------------------------------------------------------------------------------------------------------| ----------------------- | --------- |
| **Notes**      | The partitioning check works as follows: <br> - If there are less than 50 files in total, the check always passes. <br> - If there are 50 or more files in total, the check passes if at least 90% of the files are more than 96MB in size. <br><br> If the check fails, it means that the partitioning of the data across files is sub-optimal for performance and the data needs to be partitioned better. | No options to configure | N         |
| **Issues**     | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails         | Y, N                    | N         |

### Row count

Checks the total number of rows in the dataset.

| Rule component       | Description                                                                                                     | Example options                                                                            | Required? |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **Row count**        | Total number of rows in a dataset                                                                               | Between `500` and `1000`, Greater than or equal to `100`, Less than or equal to `1000`, Equal to `10` | Y         |
| **Severity**         | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Median deviation** | Difference (in [**approximate standard deviations**](#approximate-standard-deviation)) from the median row count in recent builds                            | `1` Standard deviations, `10` Recent builds                                                | N         |
| **Notes**            | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**           | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

If the row count check is set against the last successful check result, the check will evaluate the criteria according to the row count recorded in the previous passing check, and will not consider the results in failed checks.

### Transaction file count

Checks the total number of files committed in one transaction, excluding log files.

| Rule component       | Description                                                                                                     | Example options                                                                            | Required? |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **File size**        | Total number of files committed in a transaction                                                                | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | N         |
| **Severity**         | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Median deviation** | Difference (in [**approximate standard deviations**](#approximate-standard-deviation)) from the median number of files in recent builds                            | `1` Standard deviations, `10` Recent builds                                                | N         |
| **Notes**            | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**           | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

### Transaction file size

Checks the total size of the files committed in one transaction, excluding log files.

| Rule component       | Description                                                                                                     | Example options                                                                            | Required? |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **File size**        | Total size of all files committed in a transaction (in `MB` or `KB`)                                            | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | N         |
| **Severity**         | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Median deviation** | Difference (in [**approximate standard deviations**](#approximate-standard-deviation)) from the median file size in recent builds                                  | `1` Standard deviations, `10` Recent builds                                                | N         |
| **Notes**            | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**           | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

## Content checks

### Allowed column values

Checks if the values in a column match a list of allowed values.

| Rule component     | Description                                                                                                     | Example options    | Required? |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------ | --------- |
| **Column name**    | Column name to check against                                                                                    | `FIRST_NAME`       | Y         |
| **Allowed values** | Allowed possible values for above column                                                                        | `John`, `Jane`     | Y         |
| **Severity**       | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical | Y         |
| **Notes**          | Add a note to provide additional context                                                                        | Text               | N         |
| **Issues**         | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N               | N         |

### Approximate unique percentage

Checks what percentage of values in a column are unique. The percentage is **approximate**. Note this means this check is not suitable for checking if a column is a primary key (100% unique values), use the [primary key check](#primary-key) instead.

| Rule component        | Description                                                                                                     | Example options                                                                                | Required? |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------- |
| **Column name**       | Column name to check against                                                                                    | `FIRST_NAME`                                                                                   | Y         |
| **Unique percentage** | Values that are unique in the column (in `%`)                                                                   | Between `10` and `20`, Greater than or equal to `50`, Less than or equal to `50`, Equal to `1` | Y         |
| **Severity**          | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                             | Y         |
| **Notes**             | Add a note to provide additional context                                                                        | Text                                                                                           | N         |
| **Issues**            | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                           | N         |

### Column regex

Checks if the values in a column match a certain regular expression.

| Rule component     | Description                                                                                                     | Example options    | Required? |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------ | --------- |
| **Column name**    | Column name to check                                                                                            | `FIRST_NAME`       | Y         |
| **Regex**          | Regular expression the column should match                                                                      | `^Pre`, `post$`, `.*any.*`     | Y         |
| **Severity**       | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical | Y         |
| **Notes**          | Add a note to provide additional context                                                                        | Text               | N         |
| **Issues**         | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N               | N         |

### Approximate column relation

This check provides an **estimate** of similarity between two columns as a percentage. For an exact check, use [data expectations](/docs/foundry/maintaining-pipelines/define-data-expectations/) instead.

| Rule component       | Description                                                                                                     | Example options                             | Required? |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------- |
| **Other dataset**    | Dataset to check against                                                                                        | `/Users/John Appleseed/Stock_Prices_Latest` | Y         |
| **Column 1 name**    | Column name of the dataset on which the check is set                                                            | `FIRST_NAME`                                | Y         |
| **Column 2 name**    | Column name of the other dataset                                                                                | `f_name`                                    | Y         |
| **Percentage match** | To what extent the two columns must match (in `%`)                                                              | `85%` of values are equal                   | Y         |
| **Notes**            | Add a note to provide additional context                                                                        | Text                                        | N         |
| **Issues**           | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                        | N         |

### Date range

Checks for the range of values in a date column.

| Rule component         | Description                                                                                                     | Example options           | Required? |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------- | --------- |
| **Column name**        | Name of the column to check                                                                                     | `LAST_UPDATED`            | Y         |
| **Allowed date range** | Allowed date range for the column                                                                               | `2017-01-01 – 2018-01-01` | Y         |
| **Notes**              | Add a note to provide additional context                                                                        | Text                      | N         |
| **Issues**             | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                      | N         |

### Null percentage

Checks what percentage of values in a column are null.

| Rule component       | Description                                                                                                     | Example options                                                                            | Required? |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **Column name**      | Name of the column to check                                                                                     | `CUSTOMER_ID`                                                                             | Y         |
| **Null percentage**  | Percentage of values that are null in the column (in `%`)                                                       | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | N         |
| **Severity**         | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Median deviation** | Difference (in [**approximate standard deviations**](#approximate-standard-deviation)) from the median null percentage of recent builds                            | `1` Standard deviations, `10` Recent builds                                                | N         |
| **Notes**            | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**           | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

### Numeric mean

Checks whether the average of a numeric column meets some threshold.

| Rule component                 | Description                                                                                                     | Example options                                                                            | Required? |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **Column name**                | Name of the numeric column to check                                                                             | `NUM_FAILURES`                                                                             | Y         |
| **Mean**                       | Desired mean of the column                                                                                      | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | N         |
| **Severity**                   | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Difference from last check** | Compare the current mean of the column to the mean of the column at the last check run, ± an optional constant  | Greater than the last check + `5`                                                          | N         |
| **Notes**                      | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**                     | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

### Numeric median

Checks whether the median of a numeric column meets some threshold.

| Rule component                 | Description                                                                                                     | Example options                                                                            | Required? |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------- |
| **Column name**                | Name of the numeric column to check                                                                             | `NUM_FAILURES`                                                                             | Y         |
| **Median**                     | Desired median of the column                                                                                    | Between `1` and `2`, Greater than or equal to `1`, Less than or equal to `1`, Equal to `1` | N         |
| **Severity**                   | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical                                                                         | Y         |
| **Difference from last check** | Compare the current mean of the column to the mean of the column at the last check run, ± an optional constant  | Greater than the last check + `5`                                                          | N         |
| **Notes**                      | Add a note to provide additional context                                                                        | Text                                                                                       | N         |
| **Issues**                     | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N                                                                                       | N         |

### Numeric range

Checks the range of values in a numeric column.

| Rule component    | Description                                                                                                     | Example options    | Required? |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | ------------------ | --------- |
| **Column name**   | Name of the numeric column to check                                                                             | `NUM_FAILURES`     | Y         |
| **Allowed range** | Allowed range for the column                                                                                    | `3-5`              | Y         |
| **Severity**      | [**Severity**](/docs/foundry/health-checks/watching-checks/#watching-checks) of check failure                                 | Moderate, Critical | Y         |
| **Notes**         | Add a note to provide additional context                                                                        | Text               | N         |
| **Issues**        | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N               | N         |

### Primary key

Checks that the values in a column are 100% unique and non-null.

| Rule component  | Description                                                                                                     | Example options | Required? |
| --------------- | --------------------------------------------------------------------------------------------------------------- | --------------- | --------- |
| **Column name** | Name of the column to check                                                                                     | `PART_ID`       | Y         |
| **Notes**       | Add a note to provide additional context                                                                        | Text            | N         |
| **Issues**      | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N            | N         |

## Schema checks

### Column

Checks for the existence and type of a column.

| Rule component  | Description                                                                                                     | Example options | Required? |
| --------------- | --------------------------------------------------------------------------------------------------------------- | --------------- | --------- |
| **Column name** | Name of the column to check for                                                                                | `PART_ID`       | Y         |
| **Is Present**  | Check existence of column                                                                                       | Y               | Y         |
| **Type**        | Type of the column                                                                                              | `Integer`       | Y         |
| **Notes**       | Add a note to provide additional context                                                                        | Text            | N         |
| **Issues**      | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N            | N         |

### Column count

Checks for the total number of columns in the dataset.

| Rule component   | Description                                                                                                     | Example options | Required? |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | --------------- | --------- |
| **Column count** | Total number of columns in the dataset                                                                          | `50`            | Y         |
| **Notes**        | Add a note to provide additional context                                                                        | Text            | N         |
| **Issues**       | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N            | N         |

### Schema

Checks the dataset schema, verifying that the schema is respecting the chosen comparison type (see below for more details on the available ones).

| Rule component   | Description                                                                                                     | Example options | Required? |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | --------------- | --------- |
| **Columns**         | Enumerating the dataset columns and types - can choose full type match or column existence only                  | Type: String    | Y         |
| **Comparison type** | Specify which comparison policy will be used                            | Text            | Y         |
| **Notes**           | Add a note to provide additional context                                                                        | Text            | N         |
| **Issues**          | Automatically [**create an issue**](/docs/foundry/health-checks/notifications/#integrating-with-issues) when this check fails | Y, N            | N         |

Available schema check types are the following:

| Value                              | Comparison allowance |
| ---------------------------------- | -------------------- |
| `EXACT_MATCH_ORDERED_COLUMNS`      | Checks column order, names and types, and number of columns. |
| `EXACT_MATCH_UNORDERED_COLUMNS`    | Checks column names and types, and number of columns. Order does not matter. |
| `COLUMN_ADDITIONS_ALLOWED`        | Checks column names and types. Extra columns are allowed, but columns cannot be missing. |
| `COLUMN_ADDITIONS_ALLOWED_STRICT` | Like `COLUMN_ADDITIONS_ALLOWED`; however, whenever a new column is added to the dataset, that column is added to the check. Added columns cannot be missing thereafter. |

## Approximate standard deviation

Since dataset builds can easily have outliers, we do not use the true standard deviation. Instead, we use the median absolute deviation (MAD) which is a more robust measure of variability.

The MAD is defined as the median of the absolute deviations from the median of the data. For values `x_1, ..., x_n` with median `X` this means `MAD = median(|x_i - X|)`.

The median absolute deviation can be used to approximate standard deviation by multiplying with a constant.

Our calculation is `σ = MAD * 1.4826`.

For detailed information see [Median Absolute Deviation - Wikipedia ↗](https://en.wikipedia.org/wiki/Median_absolute_deviation).
