<!-- source: https://palantir.com/docs/foundry/sap/install-sap/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Installation of the SAP add-on

The Palantir Foundry Connector 2.0 for SAP Applications ("Connector"), developed in partnership with [Diskover Limited ↗](https://www.diskover.net/), is an ABAP-based data extraction interface for integrating data from SAP systems into Palantir Foundry. The Connector operates on the SAP ABAP platform (formerly known as the SAP NetWeaver Application Server) and serves data over HTTPS via REST API calls.

The Connector can be used to sync data from SAP directly to Foundry, to explore data in SAP, and to write data to SAP via remote functions.

![components](/docs/resources/foundry/sap/sap-addon-components.png)

The Connector consists of four application components:

* **PALANTIR (required):** The Palantir Foundation component contains all the shared objects required by **PALCONN** (Connector), **PALAGENT** (Remote Agent), and **PALODATA** (SLT via OData).
* **PALCONN:** The Palantir Foundry Connector application component (PALCONN) contains all connector related objects and services. This component is not for Remote Agents and cannot be installed below SAP\_BASIS (the technical component version, applicable to both SAP NetWeaver and SAP S/4HANA systems) 7.4 SP05.
* **PALAGENT (optional, for SAP\_BASIS below 7.4 SP05):** The Palantir Foundry Remote Agent application component (PALAGENT) contains all remote agent related objects and services to ingest data from SAP Applications running below SAP\_BASIS 7.4 SP05. Systems below SAP\_BASIS 7.4 SP5 must be accessed remotely via a system running SAP\_BASIS 7.4 SP5 or above with the **PALCONN** component installed. Review the [remote architecture documentation](/docs/foundry/sap/architecture/#connecting-to-a-remote-sap-erp-system-via-a-gateway) for more details.
* **PALODATA (optional, for SLT systems only):** The Palantir Foundry OData application component (PALODATA) contains objects and services related to ingesting SLT data via OData APIs, also known as [ODP-based data extraction via OData ↗](https://help.sap.com/docs/SAP_NETWEAVER_750/ccc9cdbdc6cd4eceaf1e5485b1bf8f4b/11853413cf124dde91925284133c007d.html).

:::callout{theme="neutral"}
Install the add-on to a development or sandbox system and test thoroughly prior to installing on production.
:::

## Installation scenarios

There are three installation scenarios available for the Connector.

For all scenarios, [ensure that the relevant installation packages have been downloaded](/docs/foundry/sap/download-sap-addon/) before proceeding.

#### Stand-alone installation

The Connector can be installed directly on the source SAP system. The following object types are supported in this scenario:

* SAP Tables and Views
* InfoProviders
* BEx Queries
* SAP Business Content Extractors
* SAP Functions / BAPIs
* SAP ABAP Based CDS Views
* Writeback via SAP Functions (optionally with user attribution using OAuth 2.0)

For this scenario, follow the guide below:

* [Install the Connector](/docs/foundry/sap/install-sap-connector/)

#### SLT installation

:::callout{theme="neutral"}
With Connector version 2.34 (SP34) and above, an additional `PALODATA` component must be installed to connect to SLT.
:::

In this scenario, the Connector is installed on the SAP SLT Replication Server.

Only the SLT object type is supported in this case.

For this scenario, follow the guides below:

* [Install the Connector](/docs/foundry/sap/install-sap-connector/)
* [Configure SAP SLT](/docs/foundry/sap/configure-sap-slt/)

#### Remote Agent installation

The source ERP system may not fulfill the Connector's installation requirements. In this scenario, an SAP ABAP platform with SAP\_BASIS version 7.4 SP5 or above should be deployed as a gateway to the source SAP system. The Connector should be installed on the gateway server where it will communicate with the source ERP system over an RFC connection and serve data to Foundry over HTTPS. The Connector's Remote Agent should be installed on the source ERP system to respond to the requests coming from the Connector.

For this scenario, follow the guides below:

* Install the Connector to the gateway server using the [main installation guide](/docs/foundry/sap/install-sap-connector/)
* [Install the Remote Agent](/docs/foundry/sap/install-sap-remote-agent/)

If the source ERP system is below SAP\_BASIS version 7.0 SP32, follow the guide below:

* [Install the Remote Agent for ERP 4.6C/4.7 (620/640)](/docs/foundry/sap/install-sap-remote-agent-620/)

## Support Packages and Fix Packs

New features and product fixes for the Connector are delivered as support packages. To apply a support package, follow the steps below:

* [Install a Support Package](/docs/foundry/sap/install-sap-support-package/)

Sometimes, the Connector's product fixes are delivered out of the support package lifecycle. In these circumstances, follow these instructions:

* [Install a Fix Pack](/docs/foundry/sap/install-sap-fixpack/)
