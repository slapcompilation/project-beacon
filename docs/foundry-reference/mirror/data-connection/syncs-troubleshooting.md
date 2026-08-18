<!-- source: https://palantir.com/docs/foundry/data-connection/syncs-troubleshooting/ · mirrored 2026-08-18 from Palantir Foundry docs -->

# Troubleshooting reference

This page describes several common issues with Syncs with steps to debug:

* [PKIX and SSL Exceptions](#pkix-and-ssl-exceptions)
* [Egress Proxy Issues](#egress-proxy-issues)
* [Incremental JDBC Syncs](#incremental-jdbc-sync-issues)
* [Intermittent sync failures or hangs](#intermittent-sync-failures-or-hangs)
* [A sync started failing](#a-sync-started-failing)
* [Unexpected data was synced](#unexpected-data-was-synced)

## PKIX and SSL exceptions

For certificate and TLS troubleshooting, including `PKIX` and `SSLHandshakeException` errors, see [Certificates and TLS](/docs/foundry/data-connection/troubleshooting/#certificates-and-tls).

If your sync fails with the error `Response 421 received. Server closed connection`, this suggests you may be connecting with an unsupported SSL protocol / port combination. An example includes implicit FTPS over port 991, which is an outdated and unsupported standard. Explicit SSL over port 21 is the preferred method in this case.

## Egress proxy issues

### FTP syncs

If your sync is an FTP/S sync, ensure that you are not using an egress proxy load balancer. FTP is a stateful protocol, so using a load balancer can cause the sync to fail if sequential requests don't originate from the same IP.

Note that due to the nature of load balancing, failures will be non-deterministic; syncs and previews may sometimes succeed, even with the load-balancing proxy in place.

Additionally, HTTP proxies do not support active mode transfers for FTP and FTPS. Active mode requires the FTP server to connect back to the client, which is not possible through an HTTP proxy. When using HTTP proxies with FTP/FTPS connections, only passive mode transfers are supported. Ensure your FTP source is configured to use passive mode when connecting through an HTTP proxy.

### S3 syncs

If your sync or exploration is failing with the error `com.amazonaws.services.s3.model.AmazonS3Exception:Forbidden (Service: Amazon S3; Status Code: 403; Error Code: 403 Forbidden; Request ID: null; S3 Extended Request ID: null)`, this means that the command is hitting an error on going through the egress proxy. If you receive this error, you should check whether any of the following scenarios are applicable:

* The Region field is empty. This is required when the S3 bucket you are connecting to is in a different region than the proxy.
* STS is unreachable due to not being allowlisted.
* The S3 URL is unreachable due to not being allowlisted.
* The STS credentials are invalid or you are unable to assume the IAM role.
* The sync needs to use VPC instead of proxy; to resolve the S3 endpoint, address(es) must be excluded from the proxy by adding the following configurations:
  * To the S3 source proxyConfiguration block, add:

    ```yaml
    host: <address of deployment gateway or egress NLB>
    port: 8888
    protocol: http
    nonProxyHosts: <bucket>.s3.<region>.amazonaws.com,s3.<region>.amazonaws.com,s3-<region>.amazonaws.com
    ```

    e.g: Allowlisting all VPC buckets would involve a config addition of:

    ```yaml
    clientConfiguration:
         proxyConfiguration:
            host: <color>-egress-proxy.palantirfoundry.com
            port: 8888
            protocol: http
            nonProxyHosts: *.s3.<region>.amazonaws.com, s3.<region>.amazonaws.com, s3-<region>.amazonaws.com
    ```

If your sync or exploration is failing with the error `Could not list objects in bucket`, check whether both the region and signing region are configured. Setting both values can cause this error; configure only the signing region to resolve the issue.

## Incremental JDBC sync issues

To see the exact query that ran against your source system, refer to `_data-ingestion.log`.

If your sync is an incremental sync, ensure you have provided a monotonically increasing column (e.g. timestamp or id) and an initial value for this column.

Once you've chosen the incremental column, you need to make sure you have added the `?` operator to the `SQL` query in the sync configuration page (the `?` is replaced with the 'incremental' value and only a single `?` may be used). For example, `SELECT * FROM table WHERE id > ?`.

#### Missing rows and rows not being updated

If you believe there are rows missing from your synced dataset or that previously synced rows aren't being properly updated, check the following:

* If new rows are added to the existing dataset, and the value stored in the incremental column for the new row(s) is less than the current cursor, the new rows will not be synced.
  * For example, if you're using `ID` as your monotonically increasing column and the last `ID` value synced in the last sync was 10, and then you add a row with `ID` 5, that row with `ID` 5 won't be synced.
* If you have rows that have not been synced due to the above, you can still sync these rows by either:
  * Performing a snapshot sync rather than an incremental sync, or
  * Adjusting your query to target the missing rows, and run it as a one-off.

#### Duplicate rows

If you believe existing rows are being re-synced, check the following:

* If existing rows in the source database are updated and the incremental column for those row(s) is changed such that it becomes greater than the current cursor, those rows will be re-synced, and thus duplicated. For example, if the column you are using as the incremental column is a timestamp, representing when the row was inserted or last updated, and you update a row between dataset syncs, that updated row will be re-synced.
  * If you have duplicate rows present due to the above, you can remove them by either:
    * Performing a snapshot sync rather than an incremental sync, or
    * Using a downstream transform that removes duplicate rows.
* If the data type of your chosen incremental column is a timestamp and it uses sub-millisecond precision, duplicate rows will be re-synced. This is because currently incremental JDBC syncs only serialize timestamp values up to millisecond precision, and the incremental value is then always rounded down to the nearest millisecond. Therefore, rows with microsecond and/or nanosecond precision will always be re-synced because the comparison against the current (rounded-down) incremental value is always "positive".
* If you have duplicate rows present due to the above you will need to cast the incremental column to either a `LONG` or a `STRING` (in ISO-8601 format).

#### NullPointerException thrown on incremental sync

If a NullPointerException is thrown on your incremental sync, this may indicate that the SQL query is retrieving rows from the database that would cause the incremental column to contain null values.

* For example, take the query `SELECT * FROM table WHERE col > ? OR timestamp > 1`, where `col` is the incremental column being used for the sync. The use of `OR` means that the query does not guarantee that `col` only contains non-null values. If a null value for `col` is synced for any row, then the sync will fail upon Data Connection attempting to update the incremental state for the sync since the current state will be compared with the synced null value and throw an error.
* To remediate situations like these, either choose a different incremental column or ensure that no null values can be synced for the current incremental column. For the query above, we could avoid the errors with a rewrite like `SELECT * FROM table WHERE (col > ? OR timestamp > 1) AND col IS NOT NULL`.

:::callout{theme="neutral"}
If you wish to change the incremental column used for your sync, we recommend that you create a new sync.
:::

## Intermittent sync failures or hangs

#### Check if your agent is running out of resources

On the agent host, in the `<bootvisor-directory>/var/data/processes` directory, run `ls -lrt` to find the most recently created `bootstrapper~<uuid>` directory.

* `cd` into that directory and navigate to `/var/log/`.
* Review the contents of the `magritte-agent-output.log`.

If you see the error `OutOfMemory Exception`, it means that the agent cannot handle the workload being assigned to it.

* To fix this, you may need to increase the "agent heap size" parameter, which can be done in the agent overview page. However, before doing so we recommend you read the instructions for [Tuning Heap Sizes](/docs/foundry/data-connection/agents-troubleshooting/#agent-status-shows-unhealthy) in the agent troubleshooting reference guide.
* If you cannot increase the agent's heap size, you may need to reduce the "Maximum concurrent syncs" parameter. This can also be done in the agent overview page.

#### Hanging syncs

Below are some common causes of hanging syncs and their associated fixes:

**All syncs: Hanging during the fetching stage**

If your sync is hanging during the fetching stage, check if the source is both available and operational:

* To check whether the source is available, try to connect and interact with the source (without using your agent or other Foundry products). If you are able to connect successfully and queries run as expected, contact your Palantir representative for further assistance.
* If you find that you are unable to connect to the source or that responses to queries sent to the source are slow, it is likely the source is either experiencing higher than normal volumes of traffic or is down. To mitigate the impact of busy sources, we suggest doing the following:
  * Break up your sync in to smaller syncs.
  * Use incremental syncs (if applicable).
  * Schedule your syncs at times when you know the source won't be busy.

**JDBC syncs: Hanging during the fetching stage**

If your sync is taking longer than expected to complete the fetching stage, it could be because the agent is making a large number of network and database calls. In order to tune the number of network and database calls made during a sync, you can alter the `Fetch Size` parameter:

* The `Fetch Size` parameter is located within the "advanced options" section of the source configuration and defines the number of rows fetched during each database round trip for a given query. Therefore:
  * Decreasing the `Fetch Size` parameter will result in fewer rows being returned per call to the database, and more calls will be required. However, this means the agent will use less memory as fewer rows will be stored in the agent's heap at a given time.
  * Increasing the `Fetch Size` parameter will result in more rows being returned per call to the database, and fewer calls will be required. However, this means the agent will use more memory as a larger number of rows will be stored in the agent's heap at a given time.
  * We recommend starting with `Fetch Size`: 500 and tuning accordingly.

**JDBC syncs: Hanging during the upload stage**

If your sync is taking a long time to upload files or fails during the upload stage, you could be overloading a network link. In this case we suggest tuning the `Max file size` parameter:

* The `Max file size` parameter is located within the "advanced options" section of the source configuration and defines the maximum size (in bytes or rows) of the output files which are uploaded to Foundry. Therefore:
  * Decreasing the `Max file size` parameter can increase pressure on the network as smaller files are uploaded more frequently; if a file upload fails, the cost of re-uploading is less.
  * Increasing the `Max file size` parameter will require less total bandwidth, but such uploads are more likely to fail.
  * We recommend `Max file size`: 120mb.

**FTP / SFTP / Directory / syncs: Hanging during the fetching stage**

The most common reason why file-based syncs hang during the fetching stage is because the agent is crawling a large file system.

* In order to avoid long crawl times, ensure you have specified the subfolder to crawl within the source configuration page.
  * Note: Any regex filters will run on the path of the file relative to the source’s root directory.
* If a subfolder is not specified, the sync will crawl the source root.

:::callout{theme="neutral"}
Syncs that crawl a filesystem will do two complete crawls of the filesystem (unless configured otherwise). This is to ensure the sync does not upload files which are currently being written to or altered in any way.
:::

#### Large file-based syncs are vulnerable to transient failures

File-based syncs are transactional. If a sync fails at any point, the transaction is aborted and none of the files from that run are committed to the dataset. For example, if a sync is configured to upload one million files and a network error occurs after uploading all but one file, the entire transaction is aborted. None of the uploaded files are committed and the dataset view is not modified.

Due to this transactional behavior, syncs that process a large number of files in a single run are more vulnerable to transient network issues or source system problems. To reduce the impact of sync failures:

* Use [incremental `APPEND` syncs](/docs/foundry/data-connection/file-based-syncs/#optimize-file-based-syncs) instead of `SNAPSHOT` syncs.
* Apply a file limit filter so that each run processes a smaller batch of files.

This way, a failure only requires re-syncing the current batch rather than all files.

For more details, see [sync failure behavior](/docs/foundry/data-connection/file-based-syncs/#sync-failure-behavior) and [optimize file-based syncs](/docs/foundry/data-connection/file-based-syncs/#optimize-file-based-syncs).

#### If your sync fails with the `REQUEST_ENTITY_TOO_LARGE` error

Downloading, processing, and uploading large files is error-prone and slow. `REQUEST_ENTITY_TOO_LARGE` service exceptions occur if an individual file exceeds the maximum size configured for the agent's upload destination. For the `data-proxy` upload strategy, this is set to 100GB by default.

Overriding the limit is **not** recommended; if possible, find a way to access this data as a collection of smaller files. However, if you wish to override this limit as a temporary workaround, use the following steps:

1. Within Data Connection, navigate to your agent and select the **Advanced** configuration tab.
2. Select the "Agent" tab.
3. Under the destinations block, include the following to increase the limit to 150Gb:

   ```yaml
   uploadStrategy:
       type: data-proxy
       maximumUploadedFileSizeBytes: 161061273600
   ```

## A sync started failing

#### If your sync fails with the `BadPaddingException` error

`BadPaddingException` exceptions occur because the source credential encryption key stored within the agent is not what was expected. This commonly happens when an agent manager is manually upgraded, but the old `/var/data` directory is not copied to the new install location.

The easiest way to resolve this is to re-enter the credentials for each of the sources using the affected agent.

## Unexpected data was synced

#### If timestamp columns in your JBDC sync show up as Long columns in Foundry

When rows are synced from a JDBC source and they contain timestamp columns, those timestamp columns will be cast to long columns in Foundry. This behavior exists for backwards compatibility reasons.

To fix the data type for these columns, we recommend using a [Python Transform](/docs/foundry/transforms-python/overview/) environment to perform this cleaning. Here is an example code snippet that casts the column `"mytimestamp"` back into timestamp form:

```python
df = df.withColumn("mytimestamp", (F.col("mytimestamp") / 1000).cast("timestamp"))
```
