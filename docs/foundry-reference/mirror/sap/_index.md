<!-- source: https://palantir.com/docs/foundry/sap/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# SAP

:::callout{theme="neutral"}
Connecting Foundry to SAP consists of two steps:

1. [Install an Advanced Business Application Programming (ABAP) add-on](/docs/foundry/sap/install-sap/) on SAP side.
2. Configure a source on the Foundry side that matches your SAP landscape:
   * [**SAP ERP**](/docs/foundry/available-connectors/sap-erp/): SAP ECC, S/4HANA (on-premise and Cloud Private Edition), and other ERP Central Component systems.
   * [**SAP SLT**](/docs/foundry/available-connectors/sap-slt/): Connections through an SAP Landscape Transformation (SLT) Replication Server, including real-time streaming syncs.

For SAP Business Warehouse (BW) and existing integrations, see [SAP (Custom source)](/docs/foundry/available-connectors/sap-custom-source/).

The rest of this page describes the Connector add-on and walks through the high-level end-to-end setup flow.
:::

The **Palantir Foundry Connector 2.0 for SAP Applications** ("Connector") is an SAP Certified Add-On developed in partnership with [Diskover Limited ↗](https://www.diskover.net/).

The Connector securely captures data and metadata from SAP systems (S/4HANA, ECC, Business Warehouse, SLT Replication Server) and integrates them into the Foundry platform. The Connector is installed on the SAP application layer, adheres to standard SAP security policies, and uses native SAP application logic for data access.

* **Connector installation:** The Connector is an SAP Certified Add-On, installed using SAINT (SAP Add-On Installation Tool).

* **Connector exposes access over HTTPS:** The Connector runs a web service via SICF. This allows the Foundry Data Connector to request underlying ERP or BW data over HTTPS.

* **Data transfer logic defined in Foundry:** The tables, objects, filters and schedules of the data transfers are defined in Foundry and executed by the Foundry Data Connection Coordinator.

* **Application layer access:** Palantir Foundry will send the request to the SAP ABAP platform (formerly known as the SAP NetWeaver Application Server) independent of which database is running under SAP. There is no direct database access. All information access is from the application layer.

* **SAP standard security:** Foundry will call the Connector with an SAP user secured and authorized within SAP. Therefore, all SAP standard security procedures and policies apply. There is no additional maintenance of dataflow security.

* **SAP application logic access:** Tables, functions, BW InfoProviders and BEx queries are all available objects for data extraction to Foundry.

* **System load and scalability:** The Connector checks data load on the system before starting extraction. If certain criteria are not met, extraction is aborted. The Connector is fully aligned with SAP scalability. The Connector may co-exist within the same application server or, optionally, run in a separate application server reserved for data processing.

## Supported capabilities

|Capability	|Status	|
|---	|---	|
|Bulk import	|🟢 Generally available	|
|Interactive exploration	|🟢 Generally available	|
|Webhooks	|🟢 Generally available	|
|Streaming import	|🟡 Beta	|
|Bulk export	|🔴 Under development	|

### Supported SAP object types and systems

* SAP Application Tables
* SAP BW InfoProviders
* SAP SLT
* SAP BW BEx Queries
* SAP ERP Extractors
* SAP Functions/BAPIs
* SAP Data Model
* SAP CDS Views
* SAP HANA Information Views

## Setup guide

### Prerequisites

* SAP\_BASIS 7.4 SP5 or above (the technical component version, applicable to both SAP NetWeaver and SAP S/4HANA systems)
* SAP\_BASIS 7.5 (no minimum SP level)

These are minimum versions. The Connector supports all higher SAP\_BASIS versions, including SAP S/4HANA releases based on SAP\_BASIS 8.x (for example, SAP\_BASIS 816).

:::callout{theme="neutral"}
If you plan to use [SLT via OData](/docs/foundry/sap/configure-sap-slt/#use-odp-via-odata-connector-version-234-sp34-and-above), the OData component (`PALODATA`) requires SAP\_BASIS 7.50 SP09 or above.
:::

:::callout{theme="neutral"}
If your primary SAP system is running a SAP\_BASIS version lower than 7.4 SP5, see [Remote Agent Installation](/docs/foundry/sap/install-sap/#remote-agent-installation) for details of how to setup a remote connection.
:::

### Getting started

These are the high-level steps to connect your organization's SAP system(s) to Foundry.

1. Work with your SAP Basis team to decide which connection pattern is most suitable for your SAP landscape. [Read more about the three connection patterns](/docs/foundry/sap/architecture/).
2. [Create a space within your organizational network for the Agent to be installed.](/docs/foundry/data-connection/set-up-agent/#create-agent-host)
3. [Make sure that the Agent has the necessary network egress to communicate with Foundry.](/docs/foundry/data-connection/set-up-agent/#configure-agent-network-access)
   :::callout{theme="neutral"}
   The port on the SAP server that the Agent will communicate via is the default HTTPS port for ICM (Internet Communication Manager – a component of the SAP ABAP platform). The port number can be found by running the `SMICM` transaction code in the SAP system.
   :::
4. [Download the Connector add-on installation packages from Foundry.](/docs/foundry/sap/download-sap-addon/)
5. Ask the responsible team (such as your SAP Basis team) to [install the Palantir Foundry Connector 2.0 for SAP Applications add-on](/docs/foundry/sap/install-sap/) on the relevant SAP system(s).
6. [Download the Agent software through Data Connection and install it.](/docs/foundry/data-connection/set-up-agent/#download-and-install-the-agent)
7. Set up a Source in Foundry to connect to the SAP system(s). The Foundry-side configuration depends on which connector matches your SAP landscape:

   * [**SAP ERP**](/docs/foundry/available-connectors/sap-erp/): For connecting to SAP ECC, S/4HANA (on-premise and Cloud Private Edition), and other ERP Central Component systems.
   * [**SAP SLT**](/docs/foundry/available-connectors/sap-slt/): For connecting through an SAP Landscape Transformation (SLT) Replication Server, including real-time streaming syncs.

   For SAP Business Warehouse (BW) and existing integrations, see [SAP (Custom source)](/docs/foundry/available-connectors/sap-custom-source/).
