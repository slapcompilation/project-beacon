<!-- source: https://palantir.com/docs/foundry/sap/configure-sap-slt/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Configure SLT (SAP Landscape Transformation Replication Server)

The SAP Landscape Transformation Replication Server (SLT) is a data replication tool that uses database triggers to perform change data capture (CDC), thus enabling efficient data replication from source SAP systems to a target system.

The SLT and the Palantir Foundry Connector 2.0 for SAP Applications ("Connector") can be configured to work together to enable CDC replication from SAP to Foundry.

In this setup, an SLT configuration will be created with a dedicated context (queue alias).

To replicate an SAP table to Foundry, a Foundry dataset sync will be configured per object. Once a dataset sync is configured, SLT will configure triggers on the relevant SAP object and changes to the object in SAP will then be captured and stored in the queue in the SLT server for an ODP (Operational Data Provisioning) scenario. Foundry will poll this queue on a preconfigured schedule to synchronize these changes to the Foundry dataset.

:::callout{theme="neutral"}
Starting with version 2.34 (SP34) and above, the Connector uses [ODP-based data extraction via OData ↗](https://help.sap.com/docs/SAP_NETWEAVER_750/ccc9cdbdc6cd4eceaf1e5485b1bf8f4b/11853413cf124dde91925284133c007d.html) to interact with ODP.
:::

When a Foundry dataset sync is first configured for an SAP object, SLT will perform a full load. Consecutive triggers will fetch only the changes for the object. The purging of SLT queues is managed by SLT.

You can also configure a Foundry dataset sync to have SLT perform a full load (snapshot) of specific SAP objects rather than operate in CDC mode (incremental).

:::callout{theme="neutral"}
This guide assumes the Connector has already been installed on the instance. You can review [installation instructions for the Connector](/docs/foundry/sap/install-sap/).
:::

## Prerequisites

### Use ODP directly (Connector version 2.33 (SP33) and below)

* SAP\_BASIS (the technical component version, applicable to both SAP NetWeaver and SAP S/4HANA systems) 7.4 SP14+ for Connector installation
* DMIS 2011\_1\_730 Component SP15+ for SAP SLT and source system
* SAP SLT configuration that allows 1\:N replication for all Mass Transfer IDs (MTIDs)

Ensure that the following SAP notes are implemented on the SLT system:

* SAP OSS Note `1660374` – *Fetch does not wait long enough; timeout*
* SAP OSS Note `2215583` – *Error due to moved data content during extraction from ODQ*

Ensure that the following SAP notes have been read and the relevant steps followed where applicable:

* SAP OSS Note `2697016` – *Unable to replicate table in CNV\_IUUC\_DB\_CONN131 - Other configuration have different trigger settings - SAP Landscape Transformation Replication Server.*
* SAP OSS Note `2787584` - *Authorization issues in LTRC despite user having SAP\_ALL - SLT*
* SAP OSS Note `3032108` - *Is 1\:N replication supported? - SLT*

:::callout{theme="neutral"}
In SAP SLT scenarios, there can be 1:4 registrations (max 4 consumers) for a table in older DMIS versions. Starting with DMIS 2018 SP4, SAP's new CDC functionality was enabled and there is no longer a limit on the number of consumers allowed.
:::

### Use ODP via OData (Connector version 2.34 (SP34) and above)

Connector version 2.34 introduces a `PALODATA` component, allowing you to configure syncs using the OData API [as recommended by SAP ↗](https://help.sap.com/docs/SAP_NETWEAVER_750/ccc9cdbdc6cd4eceaf1e5485b1bf8f4b/11853413cf124dde91925284133c007d.html).

This component has elevated prerequisites for SAP\_BASIS version **7.50 SP09+** given the recent nature of OData.
Also ensure that the following SAP notes have been read and where applicable implemented:

* SAP OSS Note `2854759` - *Handling of date fields during extraction via OData V2*
* SAP OSS Note `2878969` - *ODP extraction ODATA Function import names are getting truncated*
* SAP OSS Note `3062232` - *ODP ODATA V2 - Last skiptoken for a pointer provides no deltatoken*
* SAP OSS Note `3023446` - *ODP with oData version2: odata.maxpagesize is ignored for delta request*
* SAP OSS Note `2888122` - *ODATA ODP Delta not possible if latest delta request in source system deleted*

### Resource sizing

Using the Connector with SLT can be resource-intensive for the SAP system. Therefore, official SAP sizing documents should be reviewed for SLT before starting replication. Prior to beginning data extraction from the SAP environment, ensure there are free background and dialog processes on the SLT server (and also the SAP Application Server where the Connector is installed if SLT and the Connector are in different servers).

* Go to transaction `SM50` to see if there are free background and dialog processes. If there are no free processes, transferring data to Foundry will fail.
* Refer to the official SAP [SLT Sizing Guide ↗](https://help.sap.com/http.svc/rc/24061ced53984fb0b93e7c98dacef5e4/1702%20YMKT/en-US/SAP_SLT_Guide_21122015.pdf) for more guidance on sizing the system.

## SLT configuration

:::callout{theme="neutral"}
Only one of steps 2a and 2b is required. We recommend following step 2a and using the Post-Installation Wizard. Steps 3 and 4 are only required for a remote SLT scenario.
:::

* [1. Create an RFC destination connection to the source system](#1-create-an-rfc-destination-connection-to-the-source-system)
* [2a. Recommended: Create an SLT configuration for the source system using the Post-Installation Wizard](#2a-create-an-slt-configuration-for-the-source-system-using-the-post-installation-wizard)
* [2b. Create an SLT configuration for the source system using the SLT tools](#2b-create-an-slt-configuration-for-the-source-system-using-the-slt-tools)
* [3. Create an RFC destination connection to the Connector (remote SLT scenario)](#3-create-an-rfc-destination-connection-to-the-connector-remote-slt-scenario)
* [4. Configure the Connector to use SAP SLT (remote SLT scenario)](#4-configure-the-connector-to-use-sap-slt-remote-slt-scenario)

### 1. Create an RFC destination connection to the source system

To create a Remote Function Call (RFC) connection that SLT will use to replicate data from the SAP source system, refer to [Create an RFC connection](/docs/foundry/sap/create-sap-rfc-connection/).

### 2a. Create an SLT configuration for the source system using the Post-Installation Wizard

To create an SLT configuration using the Connector Post-Installation Wizard, use the `/n/PALANTIR/POST_INST` transaction code and only enable step 7 **Create SLT configuration**. The parameters of an SLT configuration are as follows:

|Parameter              |Description |
|---------------------------|-------------------------------------------------------------------------------------------|
|`Context Name`              |  Unique configuration name                                                                |
|`Context Description`       |  Context description that will be shown to the user in SAP transaction `LTRC` and in Foundry |
|`Data Transfer Jobs`      |  Number of data transfer jobs                                                             |
|`Initial Load Jobs`       |  Number of jobs for initial loads                                                        |
|`Calculation Jobs`        |  Number of calculation jobs for initial load range calculations                        |
|`Authorization Group`      |      No Authorization Group by default                                                |
|`Source RFC Destination`  |  Logical Destination - RFC Destination name of source system                            |
|`Read from Single Client` |  Check this option if data will be read from a single client                                          |
|`Allow Multiple Usage`    |  Check this option if multiple usage is allowed                                             |

### 2b. Create an SLT configuration for the source system using the SLT tools

:::callout{theme="neutral"}
Only one of steps 2a and 2b is required. We recommend using the Post-Installation Wizard detailed in step 2a.
:::

1. To create an SLT configuration, use the `LTRC` transaction code.
2. Create a new configuration.
3. In the **General Data** section, fill in the **Configuration Name** and **Description**.
4. In the Source System section:

   * Select **RFC Connection**.
   * Select the **RFC Destination** connection we created previously (eg, SAP\_SOURCE in our example).

   :::callout{theme="neutral"}
   Do not be confused by the name “RFC Destination” when you are configuring a source – you should select the connection for the source system in this setting.
   :::

   * Enable **Allow Multiple Usage**.

   :::callout{theme="warning"}
   This setting enables multiple subscribers to retrieve replicated data from the source system and cannot be changed after configuration creation. As **Allow Multiple Usage** does not have an impact if a single subscriber is used, we recommend enabling it during the first configuration. To enable multiple usage at a later time requires you to delete the configuration and create a new one.
   :::

   * In the production environment, enable **Read from Single Client**. The client number used will be the one defined in the RFC Connection. This setting will ensure only production data is replicated to Foundry. In existing SLT environments, all configurations should have the same settings. Therefore, check SAP OSS Note `2372636 - Cannot replicate data when different trigger options exist - SLT`.
5. In the Target System section:
   * Select **RFC Connection**.
   * Select **Operational Data Provisioning (ODP)** for **Scenario**. For higher support package levels of SAP\_BASIS, this scenario is listed under **Other** instead of **RFC Connection**.
   * Set **RFC Destination** as `NONE`.
   * Set any alias name as the Queue Alias. It is good practice to name the queue that shows the source system SAP System ID (SID). This queue alias name is used as the context later on, when defining Foundry dataset syncs.
6. In the **Data Transfer Settings** section, set the number of data transfer jobs, initial load jobs and data calculation jobs to be run on the SAP SLT server. Refer to the [SLT Sizing Guide ↗](https://help.sap.com/http.svc/rc/24061ced53984fb0b93e7c98dacef5e4/1702%20YMKT/en-US/SAP_SLT_Guide_21122015.pdf) for the number of jobs needed for complex scenarios.
7. Review and create the connection.
8. Back on the main SLT screen, for transaction code `LTRC`, ensure that BAdI implementation is active on the SLT system for ODP scenarios. To check the setting, open the configuration by selecting the configuration name, and then click the **Expert Functions** tab. Ensure BAdI implementation is active or ODP will not function correctly.
9. Go to `SA38` transaction from the main menu. As described on the SAP OSS note `1660374 - Fetch does not wait long enough; timeout`, run the program `SAP_RSADMIN_MAINTAIN` to set the parameter `RODPS_FETCH_TIMEOUT`. Specify the value in seconds.

### 3. Create an RFC destination connection to the Connector (remote SLT scenario)

The Connector can be deployed on a separate SAP instance which fulfills the requirements. In this case, the Connector communicates with the SLT server via an RFC connection. Therefore, an RFC connection is required to enable the communication channel.

Refer to [RFC connection guide](/docs/foundry/sap/create-sap-rfc-connection/) for setup instruction.

### 4. Configure the Connector to use SAP SLT (remote SLT scenario)

If SLT and the Connector are on separate instances, follow these additional configuration steps:

* Open transaction `/n/PALANTIR/PARAM`
* Enter the following parameter values:
  * Param ID: `SLT`
  * Param Name: `RFC_CONFIGURATION`
  * Param Value: `RFC configuration name created in the beginning of this section (eg, SLT_SERVER_RFC)`

If these parameters are not set in the configuration table, they will default to the following values:

* timestamp: OFF
* fetchOption: XML
* pageSize: 50000

## Performance considerations for large table syncs

The Connector uses SAP's ODP Framework to replicate data to Foundry. ODP replicates the data from the source system to the ODP Queue (table name `ODQDATA_F`). The data is staged in `ODQ`, and once the data is transferred to the ODP queue, the Connector starts to page the requested data to the `/PALANTIR/PAG_01` and `/PALANTIR/PAG_02` tables. After a successful transfer of all pages to Foundry, Foundry sends a close request to housekeep the tables, and this close request deletes entries in `/PALANTIR/PAG*` tables.

When running initial (for instance, historical or bulk) syncs, review database sizing and consider space requirements carefully. Insufficient space may lead to failed SLT replication jobs and transfers to Foundry so first carry out database sizing preparations based on the tables to be replicated.

## Parameters used to address known SAP issues

There are two other parameters which are used as a solution to known issues in SAP.

### Issue: The SAP SLT server does not provide the exact field length of date/time fields

Problem: The SAP SLT server does not provide the exact field length of date/time fields. This has been fixed with an SAP note. However, if you do encounter any issues regarding data type lengths, the following parameter can be set until the note is implemented:

* Param ID = `SLT`
* Param Name = `SLT_DATA_XXX` (`XXX` refers to technical name of the field)
* Param Value = `Length of the data type`

In an earlier support package of SAP\_BASIS (SP 14), `DATS` fields were set as 16 characters by SAP. However, `DATS` fields should have 8 characters (`YYYYMMDD`). `TIMS` fields were also set as 16 characters by SAP; `TIMS` data has 6 characters (`HHMMSS`).

To address this problem, set the following parameters:

|Param Id   |Param Name   |Param Value   |
|---|---|---|
|SLT   |SLT\_DATA\_DATS   |8   |
|SLT   |SLT\_DATA\_TIMS   |6   |

### Issue: SAP QUAN data types that do not have 3 decimal places

Problem: SAP has specific data types to be used for quantity and amount. Quantity data type QUAN contains 3 decimal places by default. When the Connector tries to fetch data which contain QUAN data types, it automatically creates 3 decimal places for these QUAN data types. However, some of the SAP tables which contain QUAN data types have a different number of decimal places but are sent to Foundry as if they have 3 decimal places.

To address this problem, use the following parameter:

* Param ID = `SLT`
* Param Name = `SLT_DTYPE_XXX` (`XXX` refers to data type of the field)
* Param Value = `Data Type Name which will be taken Into account`

Set the parameter as follows to change QUAN data types to decimal data types:

|Param Id   |Param Name   |Param Value   |
|---|---|---|
|SLT   |SLT\_DTYPE\_QUAN   |DEC   |
