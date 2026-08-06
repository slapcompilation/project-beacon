<!-- source: https://palantir.com/docs/foundry/analytics-connectivity/troubleshooting-odbc-jdbc/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Troubleshooting issues when configuring ODBC & JDBC Drivers

## "ODBC ERROR \[IM003] Specified driver could not be loaded"

### Problem

The following error is raised when trying to use the ODBC driver on Windows:

> `ODBC: ERROR [IM003] Specified driver could not be loaded due to system error 126: The specified module could not be found. (FoundrySqlDriver, C:\Program Files\Palantir\Foundry ODBC Driver\bin64\<ModuleName>.dll)`

### Solution

Ensure you have the latest [Microsoft Visual C++ Redistributable ↗](https://docs.microsoft.com/en-US/cpp/windows/latest-supported-vc-redist?view=msvc-170) installed on the host.

## "FoundrySqlServer\:InvalidDatasetCannotAccess"

### Problem

The following error is raised when running a SQL query with the ODBC driver, JDBC driver, or BI tool connectors for Palantir Foundry:

> `FoundrySqlServer:InvalidDatasetCannotAccess`

### Solution

The user account configured in the ODBC connection may not have permission to view the dataset(s) referenced in the query.

Take one of the following actions to verify access:

* Log into Foundry using the relevant user account, navigate to the relevant datasets, and ensure that data can be accessed as expected.
* Individuals with sufficient permissions may follow the instructions in the [guide to checking permissions](/docs/foundry/security/checking-permissions/) to verify access on behalf of the relevant account.

## "FoundrySqlServer\:TooManyRows"

### Problem

The following error is raised when running a SQL query with the ODBC driver, JDBC driver, or BI tool connectors for Palantir Foundry:

> `FoundrySqlServer:TooManyRows`

### Solution

Some SQL queries are subject to row limits for performance reasons. Review the documentation for [Foundry SQL Server's execution engines](/docs/foundry/analytics-connectivity/architecture/#execution-engines) to learn about these limits, and how to define queries that avoid them.

## Connection errors with custom SSL certificates

### Problem

When attempting to connect to Foundry using the JDBC or ODBC driver, you may encounter an error message indicating that the driver is unable to establish a secure connection with Foundry. The error message may look like the following:

> `Dialogue transport failure; PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target`

This error indicates that the driver, when connecting to your Foundry URL, was unable to verify that the server's SSL certificate was signed by a trusted Certificate Authority (CA). This can happen when the CA is not known to your operating system's truststore, or the driver is unable to access the operating system truststore.

You might encounter custom CAs and certificates in the following scenarios:

* Your Foundry URL uses your organization's domain instead of a Palantir-provided domain (for example, `foundry.[your-organization].com` instead of `[your-organization].palantirfoundry.com`).
* Your organization's network is configured to perform TLS decryption/inspection, which causes the driver to see a different certificate than the one originally presented by Foundry.

### Solution

Ensure that the driver has access to the custom certificate chain used by your organization, using one of the following methods.

#### Option 1: Load the custom certificate chain into your operating system truststore

By default, the driver uses your operating system's default truststore when verifying SSL certificates. Contact your organization's IT support to understand if your organization's custom certificate chain can be added to it. If so, the driver will be able to verify connections to Foundry without any additional configuration.

#### Option 2: Manually provide the custom certificate chain in PEM format

If your organization is unable to load the custom certificate chain into your operating system's default truststore, you can manually provide the certificate chain to the driver. To do this, obtain the certificate chain in PEM format and specify a path to that file using the [`TrustStorePath` connection parameter](/docs/foundry/analytics-connectivity/odbc-jdbc-drivers/#parameter-reference) of the JDBC or ODBC driver:

1. **Obtain the certificate chain from a trusted connection.** For example, if you can already access Foundry in Google Chrome, follow the instructions below to export the certificate chain in PEM format. If you use a different browser, refer to the browser's documentation for instructions on exporting the certificate chain.

   1. Open Google Chrome and open your Foundry URL in a new tab.
   2. Select the padlock icon in the address bar, choose **Connection is secure**, then select **Certificate is valid**.

   :::callout{theme="warning"}
   If Chrome reports that the connection is insecure and/or the certificate is invalid, there may be a separate issue causing certificate trust errors for all connections to Foundry from your computer. Consult your organization's IT support and Palantir support for assistance.
   :::

   3. Select the **Details** tab.
   4. Select **Export...**.
   5. Choose **Base64-encoded ASCII, certificate chain** as the export format, and choose a location to save the certificate file. Select **Save**.
2. **Configure the driver to use the certificate chain by specifying the `TrustStorePath` connection parameter.** The value of the property should be the full path to the file you exported in the previous step. Refer to [ODBC & JDBC Drivers: Connection parameters](/docs/foundry/analytics-connectivity/odbc-jdbc-drivers/#configuration-parameters) to learn how to specify connection parameters.
