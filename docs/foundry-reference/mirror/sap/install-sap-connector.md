<!-- source: https://palantir.com/docs/foundry/sap/install-sap-connector/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Install the Palantir Foundry Connector 2.0 for SAP Applications

The Palantir Foundry Connector 2.0 for SAP Applications ("Connector") is shipped as an SAP add-on to be installed via `SAINT` (SAP Add-On Installation Tool). The add-on is delivered in SAR format with the following filename pattern: `FOUNDRY-SAPCONN-INST-SP00SPXX.SAR`

`SP00SPXX` represents the installation files from `SP00` to `SPXX` where `XX` is the support package level.

:::callout{theme="neutral"}
If the Connector is being installed on **BW/4HANA** or **S/4HANA**, include Attribute Change Packages in the installation. As of SP22, these packages are included in the installation file.
:::

These are the high-level steps required to setup the Connector:

1. [Download the installation packages](/docs/foundry/sap/download-sap-addon/).
2. [Install the Connector add-on](#install-the-connector-add-on) via `SAINT`.
3. Create a System-type (Type `B`) technical user for Foundry in `SU01`. This user is consumed by the Foundry agent for system-to-system calls and is not used to log into SAP GUI. If you plan to enable [user-attributed writeback via OAuth 2.0](/docs/foundry/sap/oauth2-writeback/) later, the User Type **must** be `System`.
4. [Run the Post Installation Wizard](#run-the-post-installation-wizard).

:::callout{theme="neutral"}
Two distinct SAP users are involved in the installation. They are referred to throughout this page as follows:

| Term | Definition |
|---|---|
| **Performing user** (Basis administrator) | A human SAP administrator (Dialog user) who logs in interactively to run `SAINT`, the Post Installation Wizard, and `PFCG`. Requires `SAINT` / `PFCG` / `SU01` authorizations. |
| **Foundry technical user** | A System-type (Type `B`) user, no interactive logon, used by the Foundry agent for RFC/HTTPS calls. Receives the `/PALANTIR/*` roles assigned by the Post Installation Wizard. |
:::

## Prerequisites

* SAP\_BASIS (the technical component version, applicable to both SAP NetWeaver and SAP S/4HANA systems) 7.4 SP5 or above

or

* SAP\_BASIS 7.5 (no minimum SP level)

These are minimum versions. The Connector supports all higher SAP\_BASIS versions, including SAP S/4HANA releases based on SAP\_BASIS 8.x (for example, SAP\_BASIS 816).

Ensure that the following SAP note has been read and the relevant steps followed where applicable:

* SAP OSS Note `2645739` - *ABAP Add-On OCS package is not digitally signed*

## Install the Connector add-on

1. Log into the SAP system client `000` with a user authorized to use `SAINT`.
2. Run `SAINT` transaction.
3. Import `FOUNDRY-SAPCONN-INST-SP00SPXX.SAR` to the SAP Server; select **Installation package** > **Load Packages** > **From Front End**.

:::callout{theme="neutral"}
For some SAINT/SPAM versions, SPAM or SAINT settings can impact the installation process. Disable the **Signature check not possible, SAP note 2520826 is not implemented** item under the **Checks during import** section. Note that for some SPAM versions, this item has no description at all, but should still be disabled.
:::

4. Select **Start** for installation.
5. The available packages are listed. If not, deactivate the filter by clicking the filter icon.
6. Select **Continue** to go to next step.
7. For Connector installation, select `PALANTIR` and `PALCONN`.
8. Select **Continue** to move onto support package selection.
9. Select the highest available support package from the list and make sure both components have the same SP level selected.
10. Confirm the installation queue and click **Continue**.
11. Select **Continue in Dialog mode** for Preparation phase, **Continue in Background Immediately** for other phases, and start installation.

:::callout{theme="neutral"}
If warnings are flagged during the installation, follow the steps described in the warning message to resolve. In most cases, warning messages can be ignored for Connector and Remote Agent installations. In particular, the warning message with the heading "Open Data Extraction Requests" can be ignored because the installation does not make changes to DDIC structures and therefore will not cause open data extraction requests to terminate.
:::

12. Select **Finish** to complete the installation.

## Run the Post Installation Wizard

The Connector Post Installation Wizard simplifies the setup activities after Connector add-on installation. To perform post-installation and configuration, a Basis administrator (the performing user, **not** the Foundry technical user) logs into the main client (not `000`) via SAP GUI. The Post Installation Wizard runs under that administrator's session and *configures* the Foundry technical user; the Foundry technical user itself never logs in interactively. The Post Installation Wizard can be accessed either using transaction code `/n/PALANTIR/POST_INST` or from the Connector menu (transaction code: `/n/PALANTIR/`).

### Wizard steps

There are 10 steps which can be run together or individually. To finish the installation, all steps need to be enabled. If this is not an SLT installation, disable **Create SLT configuration**. SLT configuration is detailed in step 7.

:::callout{theme="warning"}
The performing user (the Basis administrator running the wizard) needs sufficient authorization to assign required authorization roles to the Foundry technical user. This process is similar to maintaining a user via the `SU01` transaction code. If the user assignment is done separately, disable `Assign Roles to Foundry User` and `Perform Healthcheck`.
:::

#### 1. Run uninstall corrections

This step runs a background program which fixes SAP packages in the Connector Object Directory. This correction program can be run at any time with no adverse side effects.

#### 2. Activate SICF services

This step activates two Connector services that are required for data transfer. Note that this can be done manually with the `SICF` transaction code if desired. The two services are:

* `/default_host/sap/palantir`
* `/default_host/sap/opu/odata/palantir`

#### 3. Generate roles

The Connector has its own set of roles which are imported during installation. These roles stay in an ungenerated status after installation. If desired, mass generation of these roles can be done manually with the `PFCG` transaction code using `Utilities > Mass Generation`.

* `/PALANTIR/CONTENT_BEX_ALL`
* `/PALANTIR/CONTENT_CDS_ALL`
* `/PALANTIR/CONTENT_HANA_ALL`
* `/PALANTIR/CONTENT_DM_ALL`
* `/PALANTIR/CONTENT_EXT_ALL`
* `/PALANTIR/CONTENT_FUNCTION_ALL`
* `/PALANTIR/CONTENT_INFOPROV_ALL`
* `/PALANTIR/CONTENT_SLT_ALL`
* `/PALANTIR/CONTENT_TABLE_ALL`
* `/PALANTIR/CONTENT_TCODE_ALL`
* `/PALANTIR/DEBUG_USER`
* `/PALANTIR/MONITORING`
* `/PALANTIR/OAUTH_CLIENT`
* `/PALANTIR/SERVICE_SLT`
* `/PALANTIR/SERVICE_SLT_740`
* `/PALANTIR/SERVICE_USER`

#### 4. Assign roles to the Foundry technical user

All Palantir roles in step 3 will be assigned to the SAP user that is defined in the selection screen. This should be the System-type Foundry technical user created in step 3 of the high-level steps above, not the performing user.

If this step generates error messages about role assignment, inability to retrieve user details or lack of authorization, this suggests that the performing user does not have sufficient permission. In this case, follow the suggestions in the error messages to correct the performing user's authorization and run the program again.

If this step generates error messages that suggest the Foundry technical user is locked, contact the owner of the lock to have it removed before running the program again.

#### 5. Maintain default parameters

Resource check and continuous resource check parameters can be set via these selections. Default values are in the selection screen and can be changed according to your requirements. When the program is run with this selection, the Connector parameters will be modified according to the selected parameters. These parameters can also be maintained using transaction code `/n/PALANTIR/PARAM`.

Learn about [performance parameters](#performance-parameters).

#### 6. Check ICM Settings

This step verifies ICM settings, hostname and ports (for HTTP and HTTPS), and creates URLs that can be used to test the connection.

#### 7. Create SLT configuration

:::callout{theme="warning"}
This step is only relevant if the connection is [via an SAP SLT Replication Server](/docs/foundry/sap/architecture/#connecting-to-an-sap-erp-system-via-an-sap-slt-replication-server).
:::

If the Connector is installed on top of an SAP SLT instance, a new SLT configuration (ODP) can be created by the Post-Installation Wizard. You can also create an SLT configuration using the `LTRC` transaction code.

The parameters of an SLT configuration are as follows:

| Parameter | Description |
|---|---|
| `Context Name` | Unique configuration name. |
| `Context Description` | Context Description that will be shown to the user in SAP transaction `LTRC` and in Foundry. |
| `Data Transfer Jobs` | Number of data transfer jobs. |
| `Initial Load Jobs` | Number of jobs for initial loads. |
| `Calculation Jobs` | Number of calculation jobs for initial load range calculations. |
| `Authorization Group` | No Authorization Group by default. |
| `Replication Mode` | 1 - Real Time (Default); 2 - Time Interval; 3 - Time Schedule; 4 - On Demand. |
| `Source RFC Destination` | Logical Destination - RFC Destination name of Source System. |
| `Read from Single Client` | Enable if data will be read from a single client. |
| `Allow Multiple Usage` | Enable if multiple usage is allowed. |

#### 8. Perform health checks

The Connector has various metrics to measure health in the installed SAP system. The connector performs health checks in the following categories:

* `AGENT`: Checks RFC connection and source system authorizations. **Only relevant for [remote connections via a gateway](/docs/foundry/sap/architecture/#connecting-to-a-remote-sap-erp-system-via-a-gateway).**
* `AUTHORIZATION`: Checks whether the Foundry user has any missing authorization in `SM53`.
* `CONNECTOR`: Checks whether the Connector housekeeping job is scheduled in the system.
* `ROLE`: Checks the Foundry user's roles and authorization profiles.
* `SLT`: Checks whether SLT configuration is correct and healthy; for example, whether BADI\_Implementation is active, Context is active, SLT housekeeping job is scheduled, or source system connection is working.

#### 9. Browser test URLs

After installation, it is important to check if the Connector is running properly by conducting connectivity tests with a web browser. The required URLs are generated by the Post-Installation Wizard.

There are several different tests available. The first and second test are synchronous calls to the Connector service; the third and fourth are for batch extraction.

* **About:** About page of the Connector.
* **T000 Table:** Direct extraction of T000 table with `table` object type.
* **T000 with Paging-Init:** Initialization of background extraction for T000 table with `table` object type.
* **T000 with Paging-Read Page 1:** First page will be retrieved for the process initialized by the previous URL.

#### 10. Source definition template for Foundry

After running the program with Source Definition in Foundry checked, a new tab, “Source Definition”, will be shown with details for the source configuration in Foundry.

### Security and authorization roles

More details can be found in [Authorization roles](/docs/foundry/sap/authorization-roles/).

### Performance parameters

The Connector has the following performance parameters to avoid unwanted system load when the system resources are insufficient to serve Foundry. These settings are compared with ST06 values.

:::callout{theme="neutral"}
The default parameter values listed below are for a fresh install of the latest connector version.
:::

* **`MEMORY_FREE`:** Free memory percentage. If this percentage is lower than the system default or user-defined value, extraction stops. Connector default is `5%`.
* **`CPU_IDLE`:**  CPU idle percentage. Connector default is `5%`.
* **`CPU_USER`:** CPU utilization by user transactions. Connector default is `80%`.
* **`CPU_LOAD`:** Total CPU utilization. Connector default is `80%`.

:::callout{theme="neutral"}
ST06 key figures are served by SAP to the Connector. If **Enhanced Monitoring for virtualization** is activated, the operating system-specific information is enriched by virtualization-specific information. This may affect ST06 figures and misguide the Connector. Refer to SAP OSS Article 2266266 for further details.
:::

Initial system defaults are deliberately conservative. If you wish to override them to be more permissive, maintain via the **`/n/PALANTIR/PARAM`** transaction.

The following parameters are used to enable or disable resource checks:

| Param Id | Param Name | Param Values | Default | Description |
| --- | --- | --- | --- | --- |
| `SYSTEM` | `CPU_CHECK` | `TRUE` / `FALSE` | `TRUE` | Enables or disables CPU checks. |
| `SYSTEM` | `MEMORY_CHECK` | `TRUE` / `FALSE` | `TRUE` | Enables or disables MEMORY checks. |
| `SYSTEM` | `RESOURCE_CHECK` | `TRUE` / `FALSE` | `TRUE` | Enables or disables RESOURCE checks. If FALSE, *all* checks are disabled; if TRUE, other parameters (CPU\_CHECK and MEMORY\_CHECK) are checked. |
| `SYSTEM` | `CONTINUOUS_RESOURCE_CHECK` | `TRUE` / `FALSE` | `TRUE` | Enables resource checks for all requests (init and all paging requests). If FALSE, resource checks are only carried out for the init request. |
| `SYSTEM` | `PROCESS_CHECK` | `TRUE` / `FALSE` | `TRUE` | Enables checks on the minimum number of permitted work processes; works in conjunction with PROCESS\_MIN\_BG and PROCESS\_MIN\_DIA. |
| `SYSTEM_THRESHOLD` | `PROCESS_MIN_BG` | numeric | `1`| Minimum required number of background process available on the SAP Application Server. |
| `SYSTEM_THRESHOLD` | `PROCESS_MIN_DIA` | numeric | `1` | Minimum required number of dialog process available on the SAP Application Server. |

To check the actual values and parameter values, you can use the system object and resource function from a browser:

```
https://<sap-server>:<port>/sap/palantir/system?obj=resource
```

Note that this URL is an SAP system URL; you should ensure that this resource is accessible.

Output will be of this format:

```
MSGTYP	MSGTXT
S	Current CPU_LOAD value : 0,01 | system threshold value : 95,00
S	Current CPU_USER value : 1,00 | system threshold value : 0,01
S	Current CPU_IDLE value : 99,00 | system threshold value : 5,00
S	Current free memory percentage : 24,22 | system threshold value : 11,00
S	Current PROCESS_MIN_BG value : 5 | system threshold value : 2
S	Current PROCESS_MIN_DIA value : 9 | system threshold value : 2
S	Resource check is Active
S	CPU Load check is Active
S	Memory consumption check is Active
S	Process availability check is Active
```
