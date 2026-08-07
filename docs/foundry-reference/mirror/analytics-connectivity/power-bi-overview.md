<!-- source: https://palantir.com/docs/foundry/analytics-connectivity/power-bi-overview/ · mirrored 2026-08-06 from Palantir Foundry docs -->

# Power BI®

:::callout{theme="warning"}
The following page discusses implementation of the Power BI® connector to access Foundry resources from the Power Query interface. If you are searching for information on our Microsoft Power BI® XMLA connector for data integration, refer to our [data connectivity documentation](/docs/foundry/available-connectors/microsoft-power-bi-xmla/).
:::

## What is the Foundry integration for Power BI®?

* Includes a Microsoft-certified Power Query connector, which enables you to easily create Power BI® reports backed by Foundry data.
* Supports both <a target="_blank" href="https://docs.microsoft.com/en-us/power-bi/connect-data/desktop-use-directquery">Import and DirectQuery</a> modes.
* Offers compatibility with Foundry access controls, including granular permissions, for Power BI® Desktop.
* Supports OAuth authentication, as well as token-based, for Power BI® Desktop.

## Supported Power BI® products

* **Power BI® Desktop** (June 2020 release or later)
* **Power BI® Service via Power BI® Gateway** (June 2020 release or later)

*Note that **Power BI® Report Server** is not currently supported by the Power BI® custom connector. However, you can use the standard [ODBC driver](/docs/foundry/analytics-connectivity/odbc-jdbc-drivers/) to connect instead.*

## Power Query compatibility

As a certified Power Query connector, the integration makes Foundry data accessible from a wide range of Microsoft products:

* Microsoft Fabric (Dataflow Gen2)
* Power Platform (including Dataverse and Power Apps)
* Power BI® (Dataflows and semantic models)

To learn more about compatibility, review the [Palantir Foundry page in Microsoft's Power Query documentation ↗](https://learn.microsoft.com/en-us/power-query/connectors/palantir-foundry-datasets).

## Getting started

* [Setup Guide](/docs/foundry/analytics-connectivity/power-bi-setup/)
* [Getting Started Guide](/docs/foundry/analytics-connectivity/power-bi-getting-started/)
* [FAQs](/docs/foundry/analytics-connectivity/power-bi-faqs/)

<a target="_blank" href="https://docs.microsoft.com/en-us/power-bi/">Learn more about Power BI® and Power BI®'s functionality in Microsoft's official documentation.</a>

*Power BI® and the Power BI® logo are trademarks of the Microsoft group of companies.*
