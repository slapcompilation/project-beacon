<!-- source: https://palantir.com/docs/foundry/sap/install-sap-fixpack/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Install a fix pack

:::callout{theme="neutral"}
Fix packs are only valid for the SP level specified.
:::

## Installation

Palantir Foundry Connector 2.0 for SAP Applications ("Connector") SPxx Fix Packs are shipped as SAP Requests to be transported via the SAP Transport Management System. Follow the below steps to import the requests to an SAP system.

1. [Download the installation packages](/docs/foundry/sap/download-sap-addon/).
2. Extract the Connector SPxx Fix Packs into a folder. The files will be as follows (request numbers may vary depending on the version to be installed):

* Connector files
  * `K900xxx.D04`
  * `R900xxx.D04`
* Remote Agent files
  * `K900xxx.D02`
  * `R900xxx.D02`

3. Filenames that start with an "R" are **data files**; filenames starting with "K" are **cofiles**. Copy files accordingly to their corresponding folder listed below on the SAP Application Server:

```
    /usr/sap/trans/cofiles
    /usr/sap/trans/data
```

4. Log into the SAP system with a user authorized to use STMS (SAP Transport Management System).
5. Run the `STMS` transaction.
6. Select the target system for the transport.
7. From the toolbar menu, select **Extras** > **Other Requests** > **Add** then type the request number. The request number is in the following format: `D04K9000xx`. The first three digits are for the request file extension; the remaining digits are the K file name as seen in the extracted files.
8. The request is listed on the import queue. Choose the request by selecting the request number, then select **Import** on the toolbar.
9. Go to the **Options** tab and select **Leave Transport Request in Queue for Later Import** and **Ignore Invalid Component Version**. Then, start the transport.
10. Check the import logs by selecting the logs button on the toolbar.
11. Check for any error messages. A successful import should complete with no errors.
