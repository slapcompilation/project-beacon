<!-- source: https://palantir.com/docs/foundry/analytics-connectivity/downloads/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Downloads

This page provides download links for the [ODBC and JDBC drivers for Foundry Datasets](/docs/foundry/analytics-connectivity/odbc-jdbc-drivers/) and the [Tableau Connector for Foundry Datasets](/docs/foundry/analytics-connectivity/tableau-overview/)

### Downloads Available

* [ODBC Driver](#foundry-datasets-odbc-driver)
* [JDBC Driver](#foundry-datasets-jdbc-driver)
* [Tableau Connector](#foundry-datasets-tableau-connector)

### Foundry Datasets ODBC driver

To install the driver, download the Palantir-signed installer file below and follow the on-screen instructions. Refer to the [ODBC Setup Guide](/docs/foundry/analytics-connectivity/odbc-jdbc-drivers/#odbc-1) for further instructions to configure a connection to Foundry.

Windows 64-bit is supported by this installer. Windows 32-bit, Mac and Linux are not currently supported.

Download:

* [Foundry ODBC Driver 3.39.0 (Windows x64) ↗](https://www.palantir.com/drivers/artifacts/datasets/odbc/3.39.0/foundry-sql-odbc-driver-3.39.0.exe)

### Foundry Datasets JDBC driver

To install the driver, download the .jar file below and place it into the relevant directory on your machine as described in the application-specific documentation. Refer to the [JDBC Setup Guide](/docs/foundry/analytics-connectivity/odbc-jdbc-drivers/#jdbc-1) for further instructions to configure a connection to Foundry.

Java 11+ is required.

Download:

* [Foundry JDBC Driver 3.39.0 (JRE 11+) ↗](https://www.palantir.com/drivers/artifacts/datasets/jdbc/3.39.0/foundry-sql-jdbc-driver-3.39.0-withdep.jar)

### Foundry Datasets Tableau Connector (2021.1+)

The Foundry Datasets Tableau Connector is a Palantir-signed connector for Tableau, provided here as a Tableau connector (.taco) package file.

The connector is also available on [Tableau Exchange ↗](https://exchange.tableau.com/products/628). There is no difference between the version listed on Tableau Exchange and in the link below.

Download:

* [foundry-jdbc-2.6.0.taco ↗](https://www.palantir.com/drivers/artifacts/datasets/tableau/2.6.0/foundry-jdbc-2.6.0.taco)

### Foundry Datasets Tableau Connector

Use this version of the connector if your Tableau version is between `2019.4` and `2021.1`. This version provides the same functionality as the above version except that only token authentication is supported (OAuth unsupported) and datasets must be loaded via RID/path rather than search.

Downloads:

* [foundry-jdbc-1.2.0.taco ↗](https://www.palantir.com/drivers/artifacts/datasets/tableau/1.2.0/foundry-jdbc-1.2.0.taco)
