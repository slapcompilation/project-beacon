<!-- source: https://palantir.com/docs/foundry/analytics-connectivity/odbc-jdbc-drivers/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# ODBC & JDBC drivers for Foundry datasets

The ODBC and JDBC drivers for Foundry datasets present a read-only SQL-based interface for accessing datasets from client applications (such as BI tools and ETL tools). Users can explore projects and datasets in Foundry and execute SQL queries to access tabular data. The drivers leverage [Foundry SQL Server](/docs/foundry/analytics-connectivity/architecture/) on the server side to process and execute SQL queries.

### JDBC or ODBC?

We recommend the use of JDBC over ODBC in cases where the client application supports both protocols. The JDBC driver is easier to install and configure, and data loading is more performant.

### Foundry SQL Server

The drivers rely on Foundry SQL Server to process and execute SQL queries against Foundry datasets. Review the [Foundry SQL Server architecture](/docs/foundry/analytics-connectivity/architecture/) documentation to learn more about the architecture and how to improve query performance.

## System requirements

### ODBC

<table>
<thead>
    <tr>
        <th>Operating System</th>
        <th>Requirements</th>
    </tr>
</thead>
<tbody>
    <tr>
        <td>Windows</td>
        <td>
            <ul>
                <li>64-bit</li>
                <li>Administrator privileges</li>
                <li>The latest <a href="https://docs.microsoft.com/cpp/windows/latest-supported-vc-redist?view=msvc-170">Microsoft Visual C++ Redistributable</a> installed</li>
            </ul>
        </td>
    </tr>
</tbody>
</table>

:::callout{theme="neutral"}
The ODBC driver is currently compatible with Windows only.
:::

### JDBC

<table>
<thead>
    <tr>
        <th>Operating System</th>
        <th>Requirements</th>
    </tr>
</thead>
<tbody>
    <tr>
        <td>Windows</td>
        <td rowspan="3">
            <ul>
                <li>Minimum Java version: Java 11</li>
                <li>Maximum Java version: Java 15</li>
            </ul>
        </td>
    </tr>
    <tr>
        <td>macOS</td>
    </tr>
    <tr>
        <td>Linux</td>
    </tr>
</tbody>
</table>

:::callout{theme="neutral"}
Java 16+ is supported with extra configuration. See the [guide](#use-the-jdbc-driver-with-java-16-and-above) below for more details.
:::

## Setup guide

### ODBC

#### Part 1. Install the ODBC driver

Run the ODBC driver installer following the instructions found in [Downloads: ODBC Driver](/docs/foundry/analytics-connectivity/downloads/#foundry-datasets-odbc-driver).

#### Part 2. Configure a Data Source Name (DSN) configuration

To use the driver within client applications, first configure a Data Source Name (DSN) configuration for your Foundry environment:

1. From the **Start** menu, search for **ODBC** and open the **ODBC Data Sources** tool. Choose the 64-bit version.
2. On either the **User DSN** or **System DSN** tab, click **Add...** .
3. Select **FoundrySqlDriver** from the list of drivers.
4. Enter the following required parameters:
   1. **Data Source Name:** A name for the data source on your machine.
   2. **Server:** The URL of your Foundry environment; for example `https://<SUBDOMAIN>.palantirfoundry.com` .
   3. **Token:** A security token generated from the **Settings** page inside Foundry. See the [User-generated tokens](/docs/foundry/platform-security-third-party/user-generated-tokens/) documentation for instructions on how to obtain a token. For additional authentication options, review the [Use OAuth to authenticate](#use-oauth-to-authenticate) guide.
5. Click **Test...** to verify a successful connection, then click **OK** to save the DSN configuration.

See [Configuration parameters](#configuration-parameters) for additional configuration parameters and instructions on building a connection URL.

#### Part 3. Configure the DSN within client applications

Now that you created a DSN, you can reference it from client applications that support ODBC sources. Refer to the client application documentation on ODBC sources. Below are some set-up guides for applications commonly used with Foundry:

* [Excel](/docs/foundry/analytics-connectivity/excel/)
* [Power BI](/docs/foundry/analytics-connectivity/power-bi-overview/)
* [Microsoft Report Builder](/docs/foundry/analytics-connectivity/msft-report-builder-overview/)

#### (Optional) Part 4: Execute a SQL query

If supported by the client application, test a SQL query that returns rows from a Foundry dataset:

```sql
SELECT * FROM "/Path/To/Dataset" LIMIT 10
```

The client application may instead allow you to browse projects and select datasets to access data.

### JDBC

#### Part 1: Install the JDBC driver

Download the JDBC driver (.jar file) which can be found on the [Downloads: JDBC Driver](/docs/foundry/analytics-connectivity/downloads/) page. Once downloaded, place the file into the appropriate location as specified in the client application's documentation for configuring JDBC connections.

#### Part 2: Construct the JDBC connection string

The JDBC connection string format is:

```
jdbc:foundrysql://<FOUNDRY_HOSTNAME>?Password=<TOKEN>
```

* `FOUNDRY_HOSTNAME` is the hostname of your Foundry environment (such as `subdomain.palantirfoundry.com`).
* `TOKEN` is a security token generated from the **Settings** page inside Foundry. See the [User-generated tokens](/docs/foundry/platform-security-third-party/user-generated-tokens/) documentation for instructions on how to obtain a token. For additional authentication options, review the [Use OAuth to authenticate](#use-oauth-to-authenticate) guide.

Optional parameters may be specified by appending `&OptionalParam=<VALUE>` to the connection string. See [Configuration parameters](#configuration-parameters) for a full list of available parameters.

If the JDBC client requires the driver class to be specified explicitly, specify `com.palantir.foundry.sql.jdbc.FoundryJdbcDriver`.

#### (Optional) Part 3: Execute a SQL query

If supported by the client application, test a SQL query that returns rows from a Foundry dataset:

```sql
SELECT * FROM "/Path/To/Dataset" LIMIT 10
```

The client application may instead allow you to browse projects and select datasets to access data.

## Reference

### Configuration parameters

The available configuration parameters are the same across ODBC and JDBC. Each driver can be configured in one of two ways: using a connection string within the client application, or configuring outside the client application:

| | Using a connection string | Outside the client application |
|---|---|---|
| ODBC | `Driver=FoundrySqlDriver;BaseUrl=<FOUNDRY_HOSTNAME>;Pwd=<TOKEN>;OptionalParamOne=ABC;OptionalParamTwo=XYZ` | Configure a DSN using the Windows ODBC Data Sources tool. See [Part 2. Configure a Data Source Name (DSN) configuration](#part-2-configure-a-data-source-name-dsn-configuration). |
| JDBC | `jdbc:foundrysql://<FOUNDRY_HOSTNAME>?Password=<TOKEN>&OptionalParamOne=ABC&OptionalParamTwo=XYZ` | Use a `foundry.ini config` file. See [Configure the JDBC driver using a foundry.ini config file](#configure-the-jdbc-driver-using-a-foundryini-config-file). |

#### Parameter reference

| Parameter | Connection string key | Required | Description |
|---|---|---|---|
| Foundry URL | ODBC `BaseUrl` / JDBC N/A | Yes | Foundry URL, e.g. `https://<SUBDOMAIN>.palantirfoundry.com` |
| Auth Token | ODBC `Pwd` / JDBC `Password` | Yes | Authentication token [generated using the Foundry UI](/docs/foundry/platform-security-third-party/user-generated-tokens/) or obtained via an [OAuth authentication flow](#use-oauth-to-authenticate). |
| Dataset branch | `Branch` | No | The branch on which datasets will be queried. If not set, this defaults to `master`. |
| Project/Catalog | `Catalog` | No | Restrict the tables the driver displays to a single Project. Set to a full Project path, such as `/MyOrg/MyProject`. Setting this property can resolve table browsing issues in some applications. |
| Auth Method | `AuthMethod` | No | Authentication method to use for the connection. Allowed values: `Token` (default), `OauthFlow`, or `ClientCredentials`. See [Use OAuth to authenticate](#use-oauth-to-authenticate) for guidance on using OAuth-based authentication methods. |
| OAuth Client ID | `OauthClientId` | No | Client ID of a third-party application registered and enabled in Foundry. Required if `AuthMethod` is set to `OauthFlow` or `ClientCredentials`. Alternatively, may be set in an application's username field. |
| OAuth Client Secret | `OauthClientSecret` | No | Client secret of a third-party application registered and enabled in Foundry. Required if `AuthMethod` is set to `ClientCredentials`. Alternatively, may be set in an application's password field. |
| Proxy host | `ProxyHost` | No | Proxy host, if required to access Foundry. Should be specified as `myproxy.example.com`, without adding a leading `http`. On Windows, the driver will automatically use a proxy if it has been set as the default Windows proxy, so this parameter may not need to be used. |
| Proxy port | `ProxyPort` | No | Proxy port. Required if proxy host is set. |
| Proxy username | `ProxyUsername` | No | Proxy username, if your proxy requires authentication. Only HTTP basic authentication is supported. |
| Proxy password | `ProxyPassword` | No | Proxy password. Required if proxy username is set. |
| Proxy auto-detect | `EnableProxyAutoDetect` | No | Whether the driver should automatically load the configured operating system proxy (if one is set). Allowed values: `true` (default) or `false`. If credentials are required, they must still be manually specified. Set to `false` to disable and use a direct connection. |
| SSL trust store path | `TrustStorePath` | No | Path to a custom SSL certificate trust store in `.pem` file format. Only required if the Foundry certificate is not present in the default operating system trust store. |
| SQL Dialect | `Dialect` | No | The [SQL dialect](#sql-dialects) to be used by the connection. Allowed values: `ODBC` (default), `ANSI`, or `SPARK`. |
| UTC Timestamps | ODBC `UtcTimestamps` / JDBC N/A | No | Whether timestamps should be returned in UTC or in the local timezone. Allowed values: `true` or `false` (default). When using BI tools and publishing reports, this setting only applies to the local DSN and may differ after publishing. This setting only applies to ODBC timestamps, as JDBC timestamps are always returned as UTC. |

### Type handling

The following table shows how Foundry types are mapped to ODBC and JDBC types.

| Foundry type | ODBC type | JDBC type |
|---|---|---|
| Array | Encoded into JSON and returned as a string (`SQL_WVARCHAR`). | Same as ODBC |
| Binary | Encoded as a hexadecimal string (`SQL_WVARCHAR`) preceded by `0x`. | `byte[]` |
| Boolean | `SQL_BIT` | `boolean` |
| Byte | `SQL_TINYINT` | `byte` |
| Date | `SQL_DATE` | `java.sql.Date` |
| Decimal | `SQL_DECIMAL` | `java.math.BigDecimal` |
| Double | `SQL_DOUBLE` | `double` |
| Float | `SQL_DOUBLE` | `float` |
| Integer | `SQL_INTEGER` | `int` |
| Long | `SQL_BIGINT` | `long` |
| Map | Encoded into JSON and returned as a string (`SQL_WVARCHAR`). | Same as ODBC|
| Short | `SQL_SMALLINT` | `short` |
| String | `SQL_WVARCHAR`. The max string column length parameter can be set via the `StringColumnLength` property. | `java.lang.String` |
| Struct | Encoded into JSON and returned as a string (`SQL_WVARCHAR`). | Same as ODBC |
| Timestamp | `SQL_TIMESTAMP`. By default, times are converted to the system's local timezone. This can be changed via the `UtcTimestamps` property. | `java.sql.Timestamp` in UTC timezone. The `UtcTimestamps` property has no effect. |

### SQL dialects

The following table outlines some of the SQL syntax and features of available SQL dialects (see `Dialect` parameter in [Configuration parameters](#configuration-parameters)).

|  | Spark (recommended) | ANSI, ODBC |
|---|---|---|
| Quoting identifiers (column names, table names) | Backticks:<br/> ``SELECT * FROM `/Space/Project/...` `` | Double quotes:<br/> `SELECT * FROM "/Space/Project/..."` |
| Quoting string literals | Single or double quotes:<br/> `WHERE column = 'value' OR column = "value"` | Single quotes:<br/> `WHERE column = 'value'` |
| Date literals | `SELECT DATE 'yyyy-mm-dd'` | Same as Spark |
| Current date | `SELECT CURRENT_DATE` | Same as Spark |
| **Additional references** | [Spark SQL Guide: SQL Reference ↗](https://spark.apache.org/docs/latest/sql-ref.html) | Supported functions: [ODBC Reference ↗](https://learn.microsoft.com/sql/odbc/reference/appendixes/appendix-e-scalar-functions?view=sql-server-ver16) |

## Usage guides

### Use SQL to query Foundry datasets

Datasets can be referenced in SQL queries by path or by RID. The SQL syntax depends on the dialect set for the connection (see [Configuration parameters](#configuration-parameters)).

#### SPARK dialect

```
-- Basic SELECT
SELECT * FROM `/Path/To/Dataset`

-- Filtering with a WHERE clause
SELECT * FROM `/Path/To/Dataset`
WHERE years < 13 AND category = 'Z';

-- Using JOIN
SELECT *
FROM `/Path/To/Dataset_A` a
JOIN `/Path/To/Dataset_B` b
    ON a.id = b.fk_id;
```

#### ODBC & ANSI dialect

```
-- Basic SELECT
SELECT * FROM "/Path/To/Dataset";

-- Filtering with a WHERE clause
SELECT * FROM "/Path/To/Dataset"
WHERE years < 13 AND category = 'Z';

-- Using JOIN
SELECT *
FROM "/Path/To/Dataset_A" a
JOIN "/Path/To/Dataset_B" b
    ON a.id = b.fk_id;
```

See [Guides: Identifying a dataset's RID or filepath](/docs/foundry/analytics-connectivity/identify-dataset-rid/) for further instructions on using dataset identifiers.

### Use OAuth to authenticate

Instead of manually generating an authentication token tied to a single Foundry account, the ODBC & JDBC drivers support OAuth 2.0 flows for additional authentication options:

* **[Individual users](#individual-users-odbc-on-windows-only):** The driver opens a login prompt in your browser for you to authenticate to Foundry.
* [**Service users**](#service-users): The driver connects to Foundry as the service user attached to a third-party application registered in Foundry.
* [**External applications (for developers)**](#external-applications-for-developers): A third-party application integrates with Foundry’s OAuth system to fetch tokens on behalf of its users.

When possible, we recommend using these OAuth-based options over token generation as they are more secure and allow shared use of embedded connection strings without sharing an individual user’s token.

#### Individual users (ODBC on Windows only)

The ODBC driver supports an automatic OAuth login and authorization flow when running on Windows. This flow is only supported for desktop applications installed on your computer, not for applications that you access through a web browser.

Follow the steps below to set up this flow:

1. *(Completed by a Foundry administrator)* Register a [third-party application](/docs/foundry/platform-security-third-party/register-3pa/) in Foundry, specifying the following configuration options:
   1. **Client type:** **Public client** is recommended in most cases; **Confidential client** is supported if your use case requires it.
   2. **Authorization grant types:** Enable the **Authorization code grant** and set the redirect URL to `http://127.0.0.1/foundrydriver/oauthredirect`.
   3. Ensure the application is **Registered** and **Enabled**.
   4. Copy the application’s **Client ID** from the application details screen and share with any users who are setting up an ODBC connection on their machines.
2. After receiving the **Client ID** from your Foundry administrator, set the following ODBC connection parameters:
   1. `AuthMethod` = `OauthFlow`
   2. `OauthClientId` = `<YOUR_CLIENT_ID>`\
      Alternatively, the **Client ID** can be set in an application's username field instead of `OauthClientId`, to allow configuring credentials in-app. `AuthMethod` must still be set.
3. (Optional) If you are configuring these settings in the Windows ODBC Administrator app, you can choose the **Test** option to trigger the login prompt and verify that login is working.

The next time you use the driver in a client application, you will be prompted to log in to Foundry in your browser. After that, you will not need to log in every time you use the driver, though you may occasionally be prompted again.

#### Service users

For workflows not associated with individual users (such as refreshing a dashboard's data on a schedule), we recommend OAuth-based service users, leveraging [third-party applications](/docs/foundry/platform-security-third-party/register-3pa/) with the OAuth Client Credentials grant type. The driver authenticates to Foundry with a long-lived client ID/secret pair that is easier to manage than manually created service accounts with generated tokens.

Follow the steps below to set up OAuth for a service user:

1. *(Completed by a Foundry administrator.)* Register a [third-party application](/docs/foundry/platform-security-third-party/register-3pa/) in Foundry:
   1. **Client type:** Choose **Confidential client**.
   2. **Authorization grant types:** Enable the **Client credentials grant,** and be sure to store the **Client ID** and **Client Secret** pair in a secure location.
   3. Ensure the application is **Registered** and **Enabled**.
   4. Ensure that the generated service user has been granted access to any datasets that will be accessed via the ODBC or JDBC driver. The service user generated for the application is listed in the **Client credentials grant** details panel.
2. Set the following configuration parameters when configuring the driver:
   1. `AuthMethod` = `ClientCredentials`
   2. `OauthClientId` = `<YOUR_CLIENT_ID>`
   3. `OauthClientSecret` = `<YOUR_CLIENT_SECRET>`\
      Alternatively, the **Client ID** and **Client Secret** can be set in an application's username and password fields instead of `OauthClientId` and `OauthClientSecret`, to allow configuring credentials in-app. `AuthMethod` must still be set.

The driver will now connect to Foundry as the OAuth app's service user.

#### External applications (for developers)

Application developers can integrate ODBC and JDBC drivers into an application that runs its own OAuth client to manage OAuth login flows with third-party applications. This option allows full control of the login flow, including redirecting the user to authentication with Foundry and handling the authorization response after the user has completed authentication and authorization. See the [writing OAuth2 clients for Foundry](/docs/foundry/platform-security-third-party/writing-oauth2-clients/#authorization-code-grant) documentation to fetch access tokens on behalf of a Foundry user.

Once your application has obtained an access token on behalf of a user, it can be passed to the driver via the standard password property:

* ODBC `Pwd` / JDBC `Password` = `<ACCESS_TOKEN_OBTAINED_FROM_TOKEN_ENDPOINT>`

### Enable logging in the ODBC driver

If you need to enable driver logging to troubleshoot an issue, follow the steps below. Note that these steps may require administrator permissions.

1. Create a folder in which to save the logs, such as `My Documents\Foundry Driver logs`.
2. Open the Windows **ODBC Data Sources** tool. You can find this by searching "ODBC" in the Windows search bar. Choose the 64-bit version.
3. Open the **System DSN** tab. Select the **FoundrySql** source, and then select **Configure**. Note that it does not matter which Foundry data source you select, as the logging settings are applied to all data sources that use the Foundry driver.
4. Select **Logging Options** on the configuration window.
5. Set the log level to **DEBUG**. Set the log path to the folder you created earlier.
6. Select **OK** to save the settings.

Restart the client application and perform the action want to troubleshoot. The logs should appear in the folder you selected. If you require support from Palantir or another support team, you can compress this folder into a zip file to share.

After troubleshooting is complete, return to the **ODBC Data Sources** tool and disable logging by setting the log level to `OFF`. This step is recommended to improve performance.

### Enable logging in the JDBC driver

The JDBC driver will discover any SLF4J logger that your Java application provides on the classpath. Specifically, your application should provide implementations of the classes `org.slf4j.impl.StaticLoggerBinder` and `org.slf4j.impl.StaticMDCBinder`. You can use a default implementation by adding `slf4j-simple` (version 1.X) as a project dependency.

If you have not configured an SLF4J logger, you will see the following messages printed when the driver is first loaded:

```
SLF4J: Failed to load class "org.slf4j.impl.StaticLoggerBinder".
SLF4J: Defaulting to no-operation (NOP) logger implementation
SLF4J: See http://www.slf4j.org/codes.html#StaticLoggerBinder for further details.
SLF4J: Failed to load class "org.slf4j.impl.StaticMDCBinder".
SLF4J: Defaulting to no-operation MDCAdapter implementation.
SLF4J: See http://www.slf4j.org/codes.html#no_static_mdc_binder for further details.
```

### Configure the JDBC driver using a `foundry.ini` config file

The JDBC driver can be configured via a config file in addition to using the connection string. To do this, create a file called `foundry.ini` in the same directory as where the JDBC .jar file is located.

The .ini file is divided into two sections: `low-priority` and `high-priority`. Properties specified in the `low-priority` section have a lower priority than connection string properties. This means that if the same property is specified in the `low-priority` section and in the connection string, the connection value will be used. In contrast, properties specified in the `high-priority` section will take precedence over connection properties. This can be useful in situations where reports are published to a server from a development machine, and the server properties need to take precedence over the development properties.

Example `foundry.ini` file:

```
[high-priority]
proxyHost=myproxy.abc
proxyPort=1234

[low-priority]
branch=production-branch
```

### Use the JDBC driver with Java 16 and above

The JDBC driver supports a maximum Java version of Java 15 by default. To use the driver with Java versions 16 and above, set the `--add-opens` Java runtime option within your application to `java.base/java.nio=org.apache.arrow.memory.core,ALL-UNNAMED`.

#### Example: Java command

```java
java --add-opens=java.base/java.nio=org.apache.arrow.memory.core,ALL-UNNAMED -jar your_application.jar
```

#### Example: Environment variable

In some cases, it is more convenient to specify the option in the `_JAVA_OPTIONS` environment variable, which is detected and applied automatically by some Java environments. On Unix-based systems this can be configured using the `export` command:

```
export _JAVA_OPTIONS="--add-opens=java.base/java.nio=org.apache.arrow.memory.core,ALL-UNNAMED"
```
