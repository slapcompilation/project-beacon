<!-- source: https://palantir.com/docs/foundry/analytics-connectivity/power-bi-setup/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Setup

:::callout{theme="warning"}
The following page discusses implementation of the Power BI® connector to access Foundry resources from the Power Query interface. If you are searching for information on our Microsoft Power BI® XMLA connector for data integration, refer to our [data connectivity documentation](/docs/foundry/available-connectors/microsoft-power-bi-xmla/).
:::

You can now access Palantir Foundry datasets from Power BI® and use them to build Power BI® reports and visualizations. To use Foundry with Power BI® Desktop, you must have both the Foundry Connector and the Foundry ODBC driver installed on your local computer. Follow the below guide to complete this installation for Power BI® Desktop.

### Step 1: Verify that the Connector is already installed

If you are on the June 2020 Power BI® release or later, the Palantir Foundry Connector should already be installed in your version of Power BI®. You can verify this by opening Power BI®, clicking on "Get Data" and finding "Palantir Foundry" in the list of Online Services.

If you see Palantir Foundry in the list, proceed to step 2 to install the ODBC driver.

If you do not see Palantir Foundry in the list, contact your Palantir representative for next steps. You may need to upgrade to the latest Power BI® release.

### Step 2: Install the Palantir Foundry ODBC driver

To complete the setup of the Foundry Power BI® integration, you will need to install an additional component called an ODBC driver. Navigate to the [Downloads Page: ODBC Driver](/docs/foundry/analytics-connectivity/downloads/#foundry-datasets-odbc-driver) to download and install the driver.

Contact your Palantir representative if you encounter any issues with the installation.

Alternatively, if you are unable to install the ODBC driver you can follow the instructions to use the [REST based Palantir Foundry Power BI® connector](/docs/foundry/analytics-connectivity/power-bi-rest/), which enables you to connect Palantir Foundry to Power BI® requiring only an Internet connection. Note that this connector has more limitations and is not expected to be as performant as the built-in Palantir Foundry connector that leverages the ODBC driver. The recommendation is therefore to use the built-in connector wherever possible.

### Step 3: Get Started Building Reports

Now that you've installed the ODBC driver, you can follow the instructions in the [Power BI®: Getting Started Guide](/docs/foundry/analytics-connectivity/power-bi-getting-started/) to get started building your first report backed by Foundry data.

*Power BI® and the Power BI® logo are trademarks of the Microsoft group of companies.*
