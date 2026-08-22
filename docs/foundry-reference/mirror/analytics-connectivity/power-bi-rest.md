<!-- source: https://palantir.com/docs/foundry/analytics-connectivity/power-bi-rest/ · mirrored 2026-08-22 from Palantir Foundry docs -->

# REST Connector setup

:::callout{theme="warning"}
The following page and discusses implementation of the Power BI® connector to access Foundry resources from the Power Query interface. If you are searching for information on our Microsoft Power BI® XMLA connector for data integration, refer to our [data connectivity documentation](/docs/foundry/available-connectors/microsoft-power-bi-xmla/).
:::

You can access Palantir Foundry datasets from Power BI® without needing to install the Palantir Foundry ODBC driver. Compared to the built-in Palantir Foundry connector that is available in Power BI® by default, this connector only supports smaller dataset sizes. It is only intended for use when it is not possible to install the ODBC driver. The Palantir Foundry REST connector only supports **Import** mode for dataset ingestion and not **Direct Query**.

### Step 1: Install the Connector in the Custom Connectors Directory

You can deploy custom connectors that are not natively shipped to ingest data into Power BI®. Locate the **Custom Connectors** folder within the Power BI® installation in your file directory. This directory should have been created as a part of the installation for Power BI®. Download the Palantir Foundry REST Connector and move it into this directory.

Download:

* [Palantir REST Power BI® Connector ↗](https://www.palantir.com/drivers/artifacts/datasets/powerbi-rest/1.0.0/foundry-rest-1.0.0.mez)

### Step 2: Configure Power BI® to use Custom Connectors

Change the Power BI® desktop settings to allow unverified extensions by navigating to **Options > Security > Data extensions**. Select the option **(Not Recommended) Allow any extension to load without validation or warning**.

### Step 3: Ingest data

Restart the Power BI® application to allow the configurations to take effect. Custom connectors are loaded on start up and should now be available for use. You can follow the instructions in the [Power BI®: Getting Started Guide](/docs/foundry/analytics-connectivity/power-bi-getting-started/) to get started building your first report backed by Foundry data. Note that the connector will be called "Palantir Foundry (REST)" in Power BI® when not using the ODBC connector method.
