<!-- source: https://palantir.com/docs/foundry/sap/install-sap-remote-agent/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Install a Remote Agent

:::callout{theme="neutral" title="Accessing older versions (below SAP_BASIS 7.4 SP5) of SAP systems"}
The Remote Agent is designed to access a remote SAP system from the primary Palantir Foundry Connector 2.0 for SAP Applications ("Connector"). If the SAP\_BASIS (the technical component version, applicable to both SAP NetWeaver and SAP S/4HANA systems) version is below 7.4 SP05, or if you wish to view two or more SAP systems in the landscape as a single Foundry Source, the Remote Agent should be installed. The minimum SAP\_BASIS version for the Remote Agent is 7.00 SP32. For lower product versions or support packages of SAP\_BASIS 7.00, see [Install the Remote Agent for ERP 4.6C/4.7 (620/640)](/docs/foundry/sap/install-sap-remote-agent-620/).
:::

To install the Remote Agent, follow these steps in the remote SAP system:

1. [Download the installation packages](/docs/foundry/sap/download-sap-addon/).
2. Log into the SAP system client `000` with a user authorized to use `SAINT`.
3. Run `SAINT` transaction.
4. Import `FOUNDRY-SAPCONN-INST-SP00SPXX.SAR` to the SAP Server: select **Installation package** > **Load Packages** > **From Front End**.

:::callout{theme="neutral"}
For some SAINT/SPAM versions, SPAM or SAINT settings can impact the installation process. Uncheck the *"Signature check not possible, SAP note 2520826 is not implemented"* item under the *"Checks during import"* section. Also note that for some SPAM versions, this checkbox has no description at all – you should still uncheck this box.
:::

5. Select **Start** for installation.
6. Available packages are listed.

:::callout{theme="neutral"}
If they are not listed, click the filter icon to deactivate the filter.
:::

7. Continue to the next step.
8. For the Connector installation, select **PALANTIR** and **PALAGENT**.
9. Select **Continue** to move onto support package selection.
10. Select highest available support package from the list and ensure both components have the same SP level selected.
11. Confirm the installation queue and click **Continue**.
12. Select **Continue in Dialog mode** for Preparation phase, **Continue in Background Immediately** for other phases, and start installation.

:::callout{theme="neutral"}
There may be some warnings flagged during the installation; follow steps as described in the warning message. In most cases, warning messages can be ignored for the Connector and Remote Agent installations. In particular, the warning message with the heading *"Open Data Extraction Requests"* can be ignored.
:::

13. Select **Finish** to complete the installation
14. Run the `PFCG` transaction code and perform authorization profile generation and user comparison for the following roles:
    * `/PALANTIR/CONTENT_RBEX_ALL`
    * `/PALANTIR/CONTENT_RFUNCT_ALL`
    * `/PALANTIR/CONTENT_RINFOPRV_ALL`
    * `/PALANTIR/CONTENT_RTABLE_ALL`
    * `/PALANTIR/CONTENT_RTCODE_ALL`
    * `/PALANTIR/SERVICE_USER`

## Configuration

The Connector and the Connector Remote Agent communicate via SAP remote function calls (RFCs). Therefore, two RFC connections are needed: one from the Connector to the Remote Agent, and another from the Remote Agent to the Connector. The next section details how to create these RFC connections.

### RFC configuration

The RFC configuration requires four steps:

1. Create an RFC connection to the SAP system.
2. Create an RFC from the Connector to the remote SAP system (`SOURCE`).
3. Create an RFC from the remote SAP system to the Connector (`TARGET`).
4. Test the Connector Remote Agent via a web browser.

#### Create an RFC destination connection to the source/target system

In this section, two RFC connections are needed: one from the Connector to the Remote Agent, and another from the Remote Agent to the Connector. Follow the [Create RFC connection](/docs/foundry/sap/create-sap-rfc-connection/) document to create RFC connections.

:::callout{theme="neutral"}
Repeat the same steps for the target RFC definition from the remote SAP system to the Connector. Instead of calling it SAP\_SOURCE, you may call it SAP\_TARGET. (These names can be freely defined.)
:::

#### Configure Remote Agent and registering the Connector

1. Log into the primary Connector system.
2. Run transaction `/n/PALANTIR/PARAM_A1`.
3. Enter the following parameter values:
   * **Agent ID:** AGENT Identifier (also known as CONTEXT)
   * **Is 4.7 or older:** AGENT Version Flag
   * **Agent Desc:** AGENT Description (for reference use)
4. Run transaction `/n/PALANTIR/PARAM_A2` and enter the following parameters:
   * **Agent ID:** AGENT ID (as defined in the previous step)
   * **Param ID:** PARAM ID (a classification of parameters)
   * **Param Name:** Parameter name (used by the AGENT)
   * **Param Value:** Parameter value (used by the AGENT)

| Param Id | Param Name | Param Values | Description |
| --- | --- | --- | --- |
| `RFC`	| `SOURCE` | | RFC Connection from Connector to remote SAP system. |
| `RFC` | `TARGET` | | RFC Connection from remote SAP system to Connector. |
| `SYSTEM` | `CPU_CHECK` | `TRUE` / `FALSE` | Enables or disables CPU checks. |
| `SYSTEM` | `MEMORY_CHECK` | `TRUE` / `FALSE` | Enables or disables MEMORY checks. |
| `SYSTEM` | `RESOURCE_CHECK` | `TRUE` / `FALSE` | Enables or disables RESOURCE checks. If `FALSE`, *all* checks are disabled; if TRUE, other parameters (`CPU_CHECK` and `MEMORY_CHECK`) are checked. |
| `SYSTEM` | `CONTINUOUS_RESOURCE_CHECK` | `TRUE` / `FALSE` | Enables resource checks for all requests (init and all paging requests). If `FALSE`, resource checks are only carried out for the init request. |
| `SYSTEM` | `PROCESS_CHECK` | `TRUE` / `FALSE` | Enables checks on the minimum number of permitted work processes; works in conjunction with `PROCESS_MIN_BG` and `PROCESS_MIN_DIA`. |
| `SYSTEM_THRESHOLD` | `PROCESS_MIN_BG` | numeric | Minimum required number of background process available on the SAP Application Server. |
| `SYSTEM_THRESHOLD` | `PROCESS_MIN_DIA` | numeric | Minimum required number of dialog process available on the SAP Application Server. |
