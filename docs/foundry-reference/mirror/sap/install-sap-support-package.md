<!-- source: https://palantir.com/docs/foundry/sap/install-sap-support-package/ · mirrored 2026-08-05 from Palantir Foundry docs -->

# Install a Support Package

Support packages are collections of bug fixes and new features delivered after the initial installation package.

The standard support package installation procedure should be followed for the Palantir Foundry Connector 2.0 for SAP Applications ("Connector") via SPAM (Support Package Manager).

:::callout{theme="warning"}
During support package installation, suspend the housekeeping job schedule and all Foundry data syncs that use the Connector. Failing to do so may cause the installation to fail due to database locks held by background processes.
:::

Use the installation file in SAR format (`FOUNDRY-SAPCONN-INST-SP00SPXX.SAR`). `XX` represents the support package level. Depending on the support package level installed on the system, SPAM will load the necessary files to perform the upgrade.

1. [Download the installation packages](/docs/foundry/sap/download-sap-addon/).
2. Log into the SAP system client 000 with a user authorized to use SPAM.
3. Run the SPAM transaction.
4. Import packages from the application server.
5. To import, select **Installation package** > **Load Packages** > **From Front End** from the toolbar menu.
6. Define the queue for support package installation.

:::callout{theme="neutral"}
All Connector components should be upgraded together. Upgrade `PALCONN` and `PALANTIR` or `PALANTIR` and `PALAGENT` components together.
:::

7. Select the application component. To upgrade PALANTIR components together, select **All Components**, then only select PALANTIR components to the desired support package level. Ensure no other component is selected for the upgrade process.
8. On the **SPAM: Import: Queue** dialog, set **Preparation** as *Start in Dialog* and all other steps as *Continue in Background*.

:::callout{theme="neutral"}
Should warnings be flagged during the installation, follow steps as described in the warning message to resolve. In most cases, warning messages can be ignored for Connector and Remote Agent installations. In particular, the warning message with the heading "Open Data Extraction Requests" can be safely ignored.
:::

9. After import completes successfully, confirm the queue.

Keeping `SPAM/SAINT` SP level and `tp/R3Trans` patches up-to-date is critical. In case an issue arises during `DDIC_ACTIVATION`, use mass activation program (`RADMASG0`) from SAP and enable the **Force Activation Flag**.

:::callout{theme="danger"}
There may be SAP security updates between support packages, leading to new authorization objects being added. Therefore, if custom roles are being used, it is highly recommended to compare the content of the `/PALANTIR/*` roles with the custom roles. If `/PALANTIR/*` roles are in use, ensure that all user comparisons are completed, authorization profiles are generated and green.
:::
