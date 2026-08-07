<!-- source: https://palantir.com/docs/foundry/sap/configure-extractors/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Extractors

The Palantir Foundry Connector 2.0 for SAP Applications ("Connector") supports data ingestion via multiple extraction interfaces called **SAP extractors**. They were originally designed to extract data from the SAP operational system to SAP Business Warehouse (BW).

There are 3 types of extractors:

* **Business content extractors** are standard and pre-delivered by SAP for various application components such as FI, CO, LO Cockpit, and more. They are not activated by default in the source system and need to be activated via the `RSA5` transaction code before use.
* **Customer generated extractors** are typically generated based on customer implementation and configuration settings.
* **Generic extractors** are highly customizable. Each customer can generate its own extraction logic based on database tables/views, info sets and function modules. These extractors are highly customizable and extraction logic is controlled by the customer.

:::callout{theme="neutral"}
The Connector can only use ODP-enabled extractors. The complete "ODP Data Replication API 2.0" is available with the following Support Packages (SP) for the applicable component (PI\_BASIS, SAP\_BW, or DW4CORE) in reference to SAP Note `1931427` - *ODP Data Replication API 2.0*. Ensure the following prerequisites are met:

* PI\_BASIS 730 SP 14 (part of SAP NetWeaver 7.30 SP 14)+
* PI\_BASIS 731 SP 16 (part of SAP NetWeaver 7.03 SP 16 and 7.31 SP 16)+
* PI\_BASIS 740 SP 11 (part of SAP NetWeaver 7.40 SP 11)+
* SAP\_BW 750 SP 0 (incl. former PI\_BASIS packages)+
* DW4CORE 100 SP 0 (incl. former PI\_BASIS packages)+
* DW4CORE 200 SP 0 (incl. former PI\_BASIS packages)+
:::

:::callout{theme="neutral"}
For authorizations in the source system where ODP enabled extractors reside, refer to SAP Note `2855052` - *Authorizations required for ODP Data Replication API 2.0*.
The Connector also has a separate role for extractors: assign the `/PALANTIR/CONTENT_EXT_ALL` authorization role to the Foundry technical user.
:::

## Configuration of extractors

### From a single source system (Connector releases older than v2.20.0 (< SP20))

* Create an RFC Connection from the Connector to the SAP Source system where the extractors reside.
* Use the `/n/palantir/param` transaction to maintain the following parameters:
  * RFC parameters
    * **Param ID:** `EXTRACTOR`
    * **Param Name:** `RFC_CONFIGURATION`
    * **Param Value:** `<RFC connection name>`
  * Context configuration
    * **Param ID:** `EXTRACTOR`
    * **Param Name:** `CONTEXT_CONFIGURATION`
    * **Param Value:** `SAPI`

### From multiple source systems (Connector releases v2.20.0 or newer (>= SP20))

As of SP20 of the Connector, it is possible to extract data from multiple source systems, also known as "contexts".

To configure multiple contexts, follow these steps:

* Run the `/PALANTIR/PARAM_E1` transaction and define each context:
  * **Extractor ID:** `<Source System ID>`
  * **Description:** `<Description of Source System>`
* Run the `/PALANTIR/PARAM_E2` transaction and define each context parameter:
  * **Extractor ID:** `<Context ID>`
  * **Param ID:** `<Connector parameter ID>`
  * **Param Name:** `<Connector parameter name>`
  * **Param Value:** `<Parameter Value>`

:::callout{theme="neutral"}
RFC and SOURCE parameters are multi-context specific; other extractor parameters are standard Connector [parameters](/docs/foundry/sap/addon-parameters/).
:::

* One of the contexts can be set as a default. In such a case, the Connector will use the default context if the context information is not specified from Foundry. To define a default context, run the `/PALANTIR/PARAM` transaction using the following parameter values:
  * **Param ID:** `EXTRACTOR`
  * **Param Name:** `DEFAULT_CONFIGURATION`
  * **Param Value:** `<EXTRACTOR ID>`

## Using extractors

* Use program `RODPS_OS_EXPOSE` to expose SAP extractors in the SAP source system.
* Restart the Foundry [Data Connection agent](/docs/foundry/data-connection/core-concepts/#agents) to refresh the cache.
* Create a new [BW Content Extractor](/docs/foundry/available-connectors/sap-erp/#sap-object-types) sync.
