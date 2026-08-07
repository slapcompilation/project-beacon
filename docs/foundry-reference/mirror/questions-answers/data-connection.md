<!-- source: https://palantir.com/docs/foundry/questions-answers/data-connection/ · mirrored 2026-08-04 from Palantir Foundry docs -->

# Data Connection

### How do you cleanly uninstall an agent from a system?

To cleanly uninstall an agent, refer to the [documentation](/docs/foundry/data-connection/set-up-agent/#set-up-automatic-restarts) on reinstalling or upgrading the agent in the user interface. Before deleting the agent's directory, make sure to stop all related processes and copy any local settings, such as proxy configurations. Additionally, clear any cron jobs as outlined in the agent setup documentation.

*Timestamp:* February 13, 2024

### What could be causing 'java.lang.NullPointerException' and 'SchemaColumnConvertNotSupportedException' errors when importing datasets from S3 and applying a schema in Foundry?

The problem could be related to the incorrect interpretation of a column's datatype during the schema application in Foundry. To debug, download the Parquet files and use Python code to read the data with the applied schema. If the error messages mention columns names, you could exclude the problematic column from the schema to see if the rest load correctly.

*Timestamp:* February 13, 2024

### How can I ensure that an S3 bucket only contains the latest exported data when using Foundry, avoiding appending new files to old ones?

To ensure that an S3 bucket only contains the latest exported data, you can use external transformations to call AWS APIs directly and implement custom logic for cleanup or pre/post-processing. This could involve deleting everything in the bucket before exporting, creating new directories, or moving things around. Additionally, you can also write a script to delete the contents of the S3 bucket before exporting from Foundry.

*Timestamp:* February 13, 2024

### How do multiple agents on a single sync handle division of labor? Is there any parallelism between the agents?

There is no parallelism between two agents. Syncs are scheduled on available healthy agents either randomly or based on whichever has fewer syncs in queue, which is configurable. Each agent can run a configurable number of syncs concurrently depending on allocated resources.

*Timestamp:* February 13, 2024

### How can I resolve a SQL Server connection timeout due to an IP change? Can I connect using the computer name instead?

The solution is to reconfigure the source with the new details, which includes using the computer name in the URL.

*Timestamp:* February 13, 2024

### Is it possible to automatically create tickets in a Service Now instance using the Service Now connector?

The Service Now connector currently only supports batch syncs. To perform writes to Service Now, such as automatically creating tickets, you can build directly against their API using the REST API source type or external transforms.

*Timestamp:* February 14, 2024

### Do Data Connection sources currently inherit Markings from agents?

No, Data Connection sources do not currently inherit Markings from agents.

*Timestamp:* February 13, 2024

### How can we handle the loss of microsecond precision in Data Connection when importing timestamps for incremental syncs to avoid duplicate entries?

Create an additional string column that is a string value of the timestamp, and perform incremental syncs on that string column instead of the original timestamp column.

*Timestamp:* February 20, 2024

### Does Foundry require additional setup for AWS PrivateLink for same-region S3 connections?

No additional setup for AWS PrivateLink is required if both the Foundry instance and the customer's AWS VPC are in the same region, as AWS transfers data without exposing it to the Internet.

*Timestamp:* February 13, 2024

### Why is a custom plugin not being recognized when running a job?

The issue could be due to differences in the Java versions of the plugin and the bootvisor.

*Timestamp:* February 23, 2024

### How can I set up a new type of data connection using Globus to enable data transfer between blob storage stores?

You will need to integrate with the Globus Python SDK using Python external transforms.

*Timestamp:* February 13, 2024

### Are there any export options available for JDBC sources from Foundry to Microsoft SQL server?

For JDBC exports, legacy [export tasks](/docs/foundry/data-connection/export-tasks/) using the JDBC connector are the only option available for now.

*Timestamp:* February 21, 2024

### Why am I getting an error stating 'The uploaded Jar was not signed correctly' when trying to upload a jar for an Oracle EBS connection?

You must only use Palantir signed jars.

*Timestamp:* February 13, 2024

### How can I export datasets larger than the data-proxy limit of 10M rows?

Convert datasets from Parquet to CSV in Foundry transforms, and then use file-based exports (Data Connection exports) to write the data to a file-based destination like S3 or streaming systems like Kafka.

*Timestamp:* February 13, 2024

### Is it possible to update an out-of-the-box HDFS source type to a custom ABFS source type and maintain syncs intact during a migration?

Yes, it is possible to update the source type while keeping syncs intact. We recommend saving the existing configuration and reverting if something breaks. Additionally, try the update on a test source first before applying the changes to the actual source.

*Timestamp:* February 13, 2024

### Why can't we connect to the ABFS source using a shared access signature and a blob SAS token?

If `soft-delete` is enabled for the ABFS source, then you cannot use shared access signature and a blob SAS token to connect to ABFS. This is the allowed configuration from Azure.

*Timestamp:* April 16, 2024

### Can I use legacy tasks to export data to a tabular datasource since the new export framework does not support tabular destinations?

Yes, if your tabular datasource has a JDBC driver, you can use the JDBC export task to export data.

*Timestamp:* April 25, 2024

### How can I connect to MS OneLake?

You can connect to MS OneLake by using the [ABFS connector](/docs/foundry/available-connectors/onelake-and-azure-blob-filesystem/), or by using external transforms and leveraging the Python client provided by OneLake.

*Timestamp:* June 25, 2025

### Can stored procedures in a database be viewed or accessed on the Foundry side when connected through a data connector?

No, stored procedures on the database cannot be viewed or accessed directly on the Foundry side when connected through a data connector, but they can be executed via the "SQL Query" option when configuring a sync.

*Timestamp:* April 16, 2024

### Why does an agent start downloading additional files after initial installation and start up?

Agents need to download updated versions of bootstrapper / bootvisor / agent binaries and initial or updated versions of managed plugin binaries. Some of these are always downloaded, while others are only downloaded if a source of that type is assigned to the agent.

*Timestamp:* April 24, 2024

### How can I set up an incremental ingest on SQLServer CDC tables using a binary type column `$start` that is not showing up in the incremental section of the sync UI?

Cast the binary type column `$start` to `varchar(max)` to avoid truncation and then use the column in the incremental section of the sync UI.

*Timestamp:* April 16, 2024

### How can I correctly use `rewritePaths` to rename files when exporting data to Azure, and why is it only exporting one file?

You should use the new export functionality for file-based exports, which does not support `rewritePaths`. Instead, perform any necessary file renaming or data transformations upstream of the export process. This approach is recommended because legacy export tasks are more difficult to configure and debug.

*Timestamp:* April 16, 2024

### How can I migrate an agent between two hosts?

To migrate an agent between two hosts, you should first shut down the agent properly on the old host using `./auto_restart.sh clear; ./init.sh stop` to remove the cronjob and stop the bootstrapper. Then, copy the entire directory containing the agent to the new host using a tool like `scp`, assuming both hosts are up and can connect.

*Timestamp:* April 18, 2024

### How can I import data into Foundry using JDBC when the SQL query changes dynamically based on dataset values?

For importing data into Foundry, you should use syncs/extracts, which are supported for JDBC. For use cases where the SQL query changes dynamically, you should use external transforms to write the custom logic for data ingestion, rather than using it to change the sync configuration. This approach is preferred over data connection tasks, which are discouraged due to their limitations.

*Timestamp:* April 16, 2024

### What is the recommended approach for ingesting array-type columns from Postgres?

The recommended approach is to ingest the array-type columns as strings and then parse them in Pipeline Builder.

*Timestamp:* April 24, 2024

### What Project-level permissions are required to create an agent?

`Owner` permissions on the Project are required to create an agent.

*Timestamp:* April 16, 2024

### What should be done when encountering the 'ExplorationRuntimeReadinessService:ExplorationRuntimeNotReady' error while trying to explore JDBC sources?

The issue might be transient and can be fixed by refreshing the service a few times.

*Timestamp:* April 16, 2024

### What should be the SSL parameter for an Oracle JDBC driver connection?

The SSL parameter needed for an Oracle JDBC driver connection is `CONNECTION_PROPERTY_THIN_NET_ENCRYPTION_LEVEL`.

*Timestamp:* May 23, 2024

### How can I limit the number of files being ingested in an incremental sync and guarantee the order in which the files are chosen?

The filter:

```
- type: sortByLastModified
  order: DESCENDING
```

can be used to limit the number of files being ingested and guarantee the order in which the files are chosen.

*Timestamp:* April 24, 2024

### Can Data Connection agents be installed on AWS Fargate (Serverless ECS or EKS) ?

AWS Fargate (Serverless ECS or EKS) is not recommended by Palantir as infrastructure for deploying the Data Connection Agents, primarily due to the lack of default volumes attached to them. Choosing to deploy agents in containers using these services is not officially supported.

*Timestamp:* September 5, 2024

### How can we resolve the "Only single connections are supported" error when trying to connect to Databricks using a code-based external transform?

The error is caused by attempting to call `get_https_connection()` on a non-REST API source. The solution is to either create a rest API source for the Databricks instance or to construct a custom client for the connection. Storing credentials in a "Generic" source or a REST API source is also a viable option.

*Timestamp:* December 18, 2024
