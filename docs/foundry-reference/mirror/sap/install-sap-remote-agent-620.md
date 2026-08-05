<!-- source: https://palantir.com/docs/foundry/sap/install-sap-remote-agent-620/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Install a Remote Agent for 4.6C/620/640

The Palantir Foundry Connector 2.0 for SAP Applications ("Connector") Remote Agent for 4.6C/620/640 is shipped as an SAP Request to be transported via the SAP Transport Management System. You can follow these steps in order to import the requests to an SAP system.

## Installation steps

1. [Download the installation packages](/docs/foundry/sap/download-sap-addon/).
2. Extract the Connector Remote Agent for 4.6c, 4.70 (620/640) into a folder. If the SAP system is Unicode, then Unicode requests should be used; otherwise non-Unicode requests should be used. The files will be as follows (request numbers may vary depending on the version to be installed):

* Connector files
  * `K900xxx.C46`
  * `R900xxx.C46`
* Remote Agent files
  * `K900xxx.C46`
  * `R900xxx.C46`

3. Filenames that start with an "R" are **data files**; filenames starting with "K" are **cofiles**. Copy files accordingly to their corresponding folder listed below on the SAP Application Server:

```
    /usr/sap/trans/cofiles
    /usr/sap/trans/data
```

4. Log into the SAP system with a user authorized to use STMS (SAP Transport Management System).
5. Run the `STMS` transaction.
6. Select the target system for the transport.
7. From the toolbar menu, select **Extras** > **Other Requests** > **Add** then type the request number. (The request number is as follows: `C46K9000xx`. The first 3 digits are for the request file extension; the remaining digits are the K filename as seen in the extracted files.)
8. The request is listed on the import queue. Now select the request by clicking the request number and then select **Import** on the toolbar.
9. Go to the **Options** tab, select **Leave Transport Request in Queue for Later Import** and **Ignore Invalid Component Version**. Then start the transport.
10. Check the import logs by clicking the logs button on the toolbar.
11. Check if there are any error messages. A successful import should complete with no errors.
12. Go to `PFCG` transaction code and generate authorization profiles for the following roles:
    * `/PALAGT47/SERVICE_USER`
    * `/PALAGT47/CONTENT_RTABLE_ALL`

## Configuration

The Connector and the Connector Remote Agent communicate via SAP remote function calls (RFCs). Therefore, two RFC connections are needed: one from the Connector to the Remote Agent, and one from the Remote Agent to the Connector. The next section details how to create these RFC connections.

### RFC configuration

The RFC configuration requires four steps:

1. Create an RFC connection to the SAP system.
2. Create an RFC from the Connector to the remote SAP system (SOURCE).
3. Create an RFC from the remote SAP system to the Connector (TARGET).
4. Test the Connector Remote Agent via a web browser.

### Create an RFC destination connection to the source/target system

In this section, two RFC Connects are needed: one from Connector to Remote Agent, and another from Remote Agent to Connector. Review the [Create RFC connection guide](/docs/foundry/sap/create-sap-rfc-connection/).

:::callout{theme="neutral"}
Repeat the same steps for the target RFC definition from the remote SAP system to the Connector. Instead of calling it `SAP\_SOURCE`, you may call it `SAP\_TARGET`. (These names can be freely defined.)
:::

#### Configure Remote Agent and register the Connector

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
| `RFC` | `SOURCE` | | RFC Connection from Connector to remote SAP system. |
| `RFC` | `TARGET` | | RFC Connection from remote SAP system to Connector. |
| `SYSTEM` | `CPU_CHECK` | `TRUE` / `FALSE` | Enables or disables CPU checks. |
| `SYSTEM` | `MEMORY_CHECK` | `TRUE` / `FALSE` | Enables or disables MEMORY checks. |
| `SYSTEM` | `RESOURCE_CHECK` | `TRUE` / `FALSE` | Enables or disables RESOURCE checks. If `FALSE`, *all* checks are disabled; if TRUE, other parameters (`CPU_CHECK` and `MEMORY_CHECK`) are checked. |
| `SYSTEM` | `CONTINUOUS_RESOURCE_CHECK` | `TRUE` / `FALSE` | Enables resource checks for all requests (init and all paging requests). If `FALSE`, resource checks are only carried out for the init request. |
| `SYSTEM` | `PROCESS_CHECK` | `TRUE` / `FALSE` | Enables checks on the minimum number of permitted work processes; works in conjunction with `PROCESS_MIN_BG` and `PROCESS_MIN_DIA`. |
| `SYSTEM_THRESHOLD` | `PROCESS_MIN_BG` | numeric | Minimum required number of background process available on the SAP Application Server. |
| `SYSTEM_THRESHOLD` | `PROCESS_MIN_DIA` | numeric | Minimum required number of dialog process available on the SAP Application Server. |

## Limitations

The Connector Remote Agent for 4.6C/620/640 has the following limitations:

* Only `table` interface is supported.
* Only `single` incremental type is supported.
* `useTsvFormat:true` should be set in the [Data Connection source configuration](/docs/foundry/available-connectors/sap-custom-source/#source-configuration) in Foundry. Therefore, a separate source is recommended for 4.6C/620/640 even if there is already an existing source available in Foundry for the main Connector instance.
